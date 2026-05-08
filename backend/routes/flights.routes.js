// ===========================================
// BLADEOPS — Flights Routes (FIXED)
// ===========================================

const express = require('express');
const { query, transaction } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { validateUUID } = require('../middleware/auth');
const {
  calcTotalWeight,
  calcFuelChain,
  calcFlightDuration,
  propagateFuelChain,
  MTOW_LBS,
} = require('../utils/calculations');

const router = express.Router();
router.use(authenticate);

// ── POST /api/flights ─────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const {
      dayOpId, fromDestId, toDestId, departureTime,
      passengersOnBoard, passengersDrop, passengersPickup,
      fuelRemainLbs, fuelUpliftLbs = 0, fuelBurnLbs = 0,
      cargoOnLbs = 0, cargoOffLbs = 0, notes,
    } = req.body;

    // Required fields
    if (!dayOpId || !fromDestId || !toDestId || !departureTime) {
      return res.status(400).json({ error: 'dayOpId, fromDestId, toDestId and departureTime are required' });
    }

    // FIXED: Partida igual ao destino
    if (fromDestId === toDestId) {
      return res.status(400).json({ error: 'Departure and destination cannot be the same' });
    }

    // FIXED: PAX não pode ser negativo
    if ((passengersOnBoard || 0) < 0) {
      return res.status(400).json({ error: 'Passengers cannot be negative' });
    }

    // FIXED: Burn não pode ser maior que o fuel total
    const totalFuel = (fuelRemainLbs || 0) + (fuelUpliftLbs || 0);
    if ((fuelBurnLbs || 0) > totalFuel && totalFuel > 0) {
      return res.status(400).json({ error: `Fuel burn (${fuelBurnLbs} lbs) cannot exceed total fuel (${totalFuel} lbs)` });
    }

    const dayResult = await query('SELECT * FROM day_operations WHERE id = $1', [dayOpId]);
    if (!dayResult.rows[0]) return res.status(404).json({ error: 'Day operation not found' });
    if (['closed', 'signed'].includes(dayResult.rows[0].status)) {
      return res.status(400).json({ error: 'Day operation is already closed' });
    }

    // Use the most recent fuel_after from last flight (not from frontend — prevents stale data)
    const lastFlightResult = await query(
      'SELECT fuel_after_lbs FROM flights WHERE day_op_id = $1 ORDER BY flight_number DESC LIMIT 1',
      [dayOpId]
    );
    const actualFuelRemain = lastFlightResult.rows[0]
      ? lastFlightResult.rows[0].fuel_after_lbs
      : (fuelRemainLbs || dayResult.rows[0].initial_fuel_lbs || 0);

    const countResult = await query('SELECT COUNT(*) FROM flights WHERE day_op_id = $1', [dayOpId]);
    const flightNumber = parseInt(countResult.rows[0].count) + 1;

    const distResult = await query(
      `SELECT distance_nm FROM distances
       WHERE (from_dest_id = $1 AND to_dest_id = $2)
          OR (from_dest_id = $2 AND to_dest_id = $1)
       LIMIT 1`,
      [fromDestId, toDestId]
    );
    const distanceNm = distResult.rows[0]?.distance_nm || 0;

    const fuel = calcFuelChain({
      fuelRemain: actualFuelRemain,
      fuelUplift: fuelUpliftLbs || 0,
      fuelBurn: fuelBurnLbs || 0,
    });

    const cargoNet = Math.max(0, (cargoOnLbs || 0) - (cargoOffLbs || 0));
    const wt = calcTotalWeight({
      passengersOnBoard: passengersOnBoard || 0,
      fuelTotalLbs: fuel.total,
      cargoNetLbs: cargoNet,
    });

    // FIXED: usa MTOW_LBS importado correctamente
    if (!wt.withinLimit) {
      return res.status(400).json({
        error: `Total weight ${wt.total.toLocaleString()} lbs exceeds MTOW ${MTOW_LBS.toLocaleString()} lbs`,
        weight: wt,
      });
    }

    const result = await query(
      `INSERT INTO flights (
         day_op_id, flight_number, from_dest_id, to_dest_id, departure_time,
         distance_nm, passengers_on_board, passengers_drop, passengers_pickup,
         passengers_weight_lbs, fuel_remain_lbs, fuel_uplift_lbs, fuel_total_lbs,
         fuel_burn_lbs, fuel_after_lbs, cargo_on_lbs, cargo_off_lbs, cargo_net_lbs,
         total_weight_lbs, notes
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
       RETURNING id`,
      [
        dayOpId, flightNumber, fromDestId, toDestId, departureTime,
        distanceNm,
        passengersOnBoard || 0, passengersDrop || 0, passengersPickup || 0,
        (passengersOnBoard || 0) * 187,
        fuel.remain, fuel.uplift, fuel.total,
        fuel.burn, fuel.after,
        cargoOnLbs || 0, cargoOffLbs || 0, cargoNet,
        wt.total, notes || null,
      ]
    );

    await query(
      `UPDATE day_operations SET
         total_fuel_burn_lbs = total_fuel_burn_lbs + $1,
         total_passengers = total_passengers + $2,
         total_nm = total_nm + $3,
         updated_at = NOW()
       WHERE id = $4`,
      [fuel.burn, passengersOnBoard || 0, distanceNm, dayOpId]
    );

    res.status(201).json({ id: result.rows[0].id, flightNumber, fuel, weight: wt, distanceNm, message: 'Flight created' });
  } catch (err) {
    console.error('Create flight error:', err.message);
    res.status(500).json({ error: 'Failed to create flight' });
  }
});

// ── PATCH /api/flights/:id/arrive ─────────────────────────────────────────
router.patch('/:id/arrive', validateUUID, async (req, res) => {
  try {
    const { arrivalTime } = req.body;
    if (!arrivalTime) return res.status(400).json({ error: 'arrivalTime required' });

    const flightResult = await query('SELECT * FROM flights WHERE id = $1', [req.params.id]);
    if (!flightResult.rows[0]) return res.status(404).json({ error: 'Flight not found' });

    const flight = flightResult.rows[0];
    const durationMin = calcFlightDuration(flight.departure_time, arrivalTime);

    if (durationMin < 0) {
      return res.status(400).json({ error: 'Arrival time cannot be before departure time' });
    }

    // If flight already had arrival, subtract old duration before adding new
    if (flight.arrival_time && flight.duration_minutes) {
      await query(
        `UPDATE day_operations SET
           total_block_minutes = total_block_minutes - $1 + $2, updated_at = NOW()
         WHERE id = $3`,
        [flight.duration_minutes, durationMin, flight.day_op_id]
      );
    } else {
      await query(
        `UPDATE day_operations SET
           total_block_minutes = total_block_minutes + $1, updated_at = NOW()
         WHERE id = $2`,
        [durationMin, flight.day_op_id]
      );
    }

    await query(
      `UPDATE flights SET arrival_time = $1, duration_minutes = $2, updated_at = NOW() WHERE id = $3`,
      [arrivalTime, durationMin, req.params.id]
    );

    res.json({ arrivalTime, durationMinutes: durationMin });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record arrival' });
  }
});

// ── PUT /api/flights/:id — update + propagate fuel chain ──────────────────
router.put('/:id', validateUUID, async (req, res) => {
  try {
    const {
      fuelRemainLbs, fuelUpliftLbs, fuelBurnLbs,
      passengersOnBoard, passengersDrop, passengersPickup,
      cargoOnLbs, cargoOffLbs,
      departureTime, arrivalTime, notes,
      editReason,
    } = req.body;

    if (!editReason || !editReason.trim()) {
      return res.status(400).json({ error: 'editReason is required for all flight updates' });
    }

    const oldResult = await query('SELECT * FROM flights WHERE id = $1', [req.params.id]);
    if (!oldResult.rows[0]) return res.status(404).json({ error: 'Flight not found' });
    const old = oldResult.rows[0];

    const fuel = calcFuelChain({
      fuelRemain: fuelRemainLbs ?? old.fuel_remain_lbs,
      fuelUplift: fuelUpliftLbs ?? old.fuel_uplift_lbs,
      fuelBurn:   fuelBurnLbs   ?? old.fuel_burn_lbs,
    });

    // Validate burn vs total
    if (fuel.burn > fuel.total) {
      return res.status(400).json({ error: `Fuel burn (${fuel.burn} lbs) cannot exceed total fuel (${fuel.total} lbs)` });
    }

    const pax      = passengersOnBoard ?? old.passengers_on_board;
    const cargoOn  = cargoOnLbs  ?? old.cargo_on_lbs;
    const cargoOff = cargoOffLbs ?? old.cargo_off_lbs;
    const cargoNet = Math.max(0, cargoOn - cargoOff);
    const depTime  = departureTime || old.departure_time;
    const arrTime  = arrivalTime   || old.arrival_time;
    const durationMin = arrTime ? calcFlightDuration(depTime, arrTime) : old.duration_minutes;

    const wt = calcTotalWeight({ passengersOnBoard: pax, fuelTotalLbs: fuel.total, cargoNetLbs: cargoNet });

    // FIXED: log ALL changed fields, not just 3
    const changes = [];
    const track = (field, oldVal, newVal) => {
      if (newVal !== undefined && String(newVal) !== String(oldVal)) {
        changes.push({ field, old: String(oldVal), new: String(newVal) });
      }
    };
    track('fuel_burn_lbs',       old.fuel_burn_lbs,       fuelBurnLbs);
    track('fuel_uplift_lbs',     old.fuel_uplift_lbs,     fuelUpliftLbs);
    track('passengers_on_board', old.passengers_on_board, passengersOnBoard);
    track('passengers_drop',     old.passengers_drop,     passengersDrop);
    track('passengers_pickup',   old.passengers_pickup,   passengersPickup);
    track('cargo_on_lbs',        old.cargo_on_lbs,        cargoOnLbs);
    track('cargo_off_lbs',       old.cargo_off_lbs,       cargoOffLbs);
    track('departure_time',      old.departure_time,      departureTime);
    track('arrival_time',        old.arrival_time,        arrivalTime);

    await transaction(async (client) => {
      await client.query(
        `UPDATE flights SET
           fuel_remain_lbs=$1, fuel_uplift_lbs=$2, fuel_total_lbs=$3,
           fuel_burn_lbs=$4, fuel_after_lbs=$5,
           passengers_on_board=$6, passengers_drop=$7, passengers_pickup=$8,
           passengers_weight_lbs=$9, cargo_on_lbs=$10, cargo_off_lbs=$11,
           cargo_net_lbs=$12, total_weight_lbs=$13,
           departure_time=COALESCE($14, departure_time),
           arrival_time=COALESCE($15, arrival_time),
           duration_minutes=COALESCE($16, duration_minutes),
           notes=COALESCE($17, notes), updated_at=NOW()
         WHERE id=$18`,
        [
          fuel.remain, fuel.uplift, fuel.total, fuel.burn, fuel.after,
          pax, passengersDrop ?? old.passengers_drop, passengersPickup ?? old.passengers_pickup,
          pax * 187, cargoOn, cargoOff, cargoNet, wt.total,
          departureTime || null, arrivalTime || null, durationMin || null,
          notes || null, req.params.id,
        ]
      );

      // Log all changes
      for (const change of changes) {
        await client.query(
          `INSERT INTO edit_logs (user_id, user_name, entity_type, entity_id, field_name, old_value, new_value, reason)
           VALUES ($1,$2,'flight',$3,$4,$5,$6,$7)`,
          [req.user.id, req.user.name, req.params.id, change.field, change.old, change.new, editReason.trim()]
        );
      }

      // Propagate fuel chain to subsequent flights
      const allFlights = await client.query(
        'SELECT * FROM flights WHERE day_op_id = $1 ORDER BY flight_number',
        [old.day_op_id]
      );
      const updated = propagateFuelChain(allFlights.rows);
      for (const f of updated) {
        if (f.id !== req.params.id) {
          await client.query(
            `UPDATE flights SET
               fuel_remain_lbs=$1, fuel_total_lbs=$2, fuel_after_lbs=$3,
               total_weight_lbs=$4, updated_at=NOW()
             WHERE id=$5`,
            [f.fuel_remain_lbs, f.fuel_total_lbs, f.fuel_after_lbs, f.total_weight_lbs, f.id]
          );
        }
      }

      // Recalculate day totals
      const totals = await client.query(
        `SELECT
           COALESCE(SUM(fuel_burn_lbs),0)     AS total_burn,
           COALESCE(SUM(passengers_on_board),0) AS total_pax,
           COALESCE(SUM(distance_nm),0)       AS total_nm,
           COALESCE(SUM(duration_minutes),0)  AS total_block
         FROM flights WHERE day_op_id = $1`,
        [old.day_op_id]
      );
      const t = totals.rows[0];
      const lastFlight = updated[updated.length - 1];
      await client.query(
        `UPDATE day_operations SET
           total_fuel_burn_lbs=$1, total_passengers=$2, total_nm=$3,
           total_block_minutes=$4, final_fuel_lbs=$5, updated_at=NOW()
         WHERE id=$6`,
        [t.total_burn, t.total_pax, t.total_nm, t.total_block, lastFlight?.fuel_after_lbs || 0, old.day_op_id]
      );
    });

    res.json({ message: 'Flight updated and fuel chain propagated', fuel, weight: wt });
  } catch (err) {
    console.error('Update flight error:', err.message);
    res.status(500).json({ error: 'Failed to update flight' });
  }
});

// ── GET /api/flights/:id ──────────────────────────────────────────────────
router.get('/:id', validateUUID, async (req, res) => {
  try {
    const result = await query(
      `SELECT f.*,
              fd.name AS from_name, fd.coordinates AS from_coords,
              td.name AS to_name, td.coordinates AS to_coords
       FROM flights f
       LEFT JOIN destinations fd ON f.from_dest_id = fd.id
       LEFT JOIN destinations td ON f.to_dest_id = td.id
       WHERE f.id = $1`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Flight not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch flight' });
  }
});

module.exports = router;
