// ===========================================
// BLADEOPS — Flights Routes
// ===========================================

const express = require('express');
const { query, transaction } = require('../config/database');
const { authenticate, validateUUID } = require('../middleware/auth');
const { calcFlightDuration } = require('../utils/calculations');

const router = express.Router();
router.use(authenticate);

// ── POST /api/flights — PARTIR ────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const {
      dayOpId, tripId,
      fromDestId, toDestId,
      passengersOnBoard    = 0,
      passengersWeightLbs  = 0,
      cargoOnLbs           = 0,
      notes,
    } = req.body;

    if (!dayOpId || !fromDestId || !toDestId)
      return res.status(400).json({ error: 'dayOpId, fromDestId e toDestId são obrigatórios' });
    if (fromDestId === toDestId)
      return res.status(400).json({ error: 'Origem e destino não podem ser iguais' });

    const dayResult = await query(
      `SELECT d.*, a.mtow_lbs, a.operating_weight_lbs
       FROM day_operations d JOIN aircraft a ON d.aircraft_id = a.id
       WHERE d.id = $1`, [dayOpId]
    );
    if (!dayResult.rows[0]) return res.status(404).json({ error: 'Day operation not found' });
    const dayOp = dayResult.rows[0];
    if (['closed','signed'].includes(dayOp.status))
      return res.status(400).json({ error: 'Day operation is already closed' });

    if (tripId) {
      const tr = await query('SELECT * FROM trips WHERE id = $1', [tripId]);
      if (!tr.rows[0]) return res.status(404).json({ error: 'Trip not found' });
      if (tr.rows[0].rotor_off_time) return res.status(400).json({ error: 'Este trip já tem Rotor OFF' });
    }

    const active = await query(
      `SELECT id FROM flights WHERE day_op_id = $1 AND arrival_time IS NULL LIMIT 1`, [dayOpId]
    );
    if (active.rows[0]) return res.status(409).json({ error: 'Há uma leg em curso — regista a chegada primeiro' });

    const fuelBefore = dayOp.current_fuel_lbs > 0 ? dayOp.current_fuel_lbs : (dayOp.initial_fuel_lbs || 0);

    const countRes  = await query('SELECT COUNT(*) FROM flights WHERE day_op_id = $1', [dayOpId]);
    const flightNum = parseInt(countRes.rows[0].count) + 1;

    const distRes = await query(
      `SELECT distance_nm FROM distances
       WHERE (from_dest_id=$1 AND to_dest_id=$2) OR (from_dest_id=$2 AND to_dest_id=$1) LIMIT 1`,
      [fromDestId, toDestId]
    );
    const distNm = distRes.rows[0]?.distance_nm || 0;

    const departureTime = new Date().toTimeString().slice(0, 8);

    const mtow         = dayOp.mtow_lbs            || 0;
    const acOEW        = dayOp.operating_weight_lbs || 0;
    const crewWt       = dayOp.crew_weight_lbs      || 0;
    const payloadAvail = Math.max(0, mtow - acOEW - crewWt - fuelBefore);
    const payloadUsed  = (parseInt(passengersWeightLbs)||0) + (parseInt(cargoOnLbs)||0);

    if (payloadUsed > payloadAvail)
      return res.status(400).json({
        error: `Peso total (${payloadUsed} lbs) excede payload disponível (${payloadAvail} lbs)`,
        payloadAvail, payloadUsed,
      });

    const result = await query(
      `INSERT INTO flights (
         day_op_id, trip_id, flight_number,
         from_dest_id, to_dest_id, distance_nm,
         departure_time, fuel_remain_lbs,
         passengers_on_board, passengers_weight_lbs, cargo_on_lbs, notes
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [
        dayOpId, tripId||null, flightNum,
        fromDestId, toDestId, distNm,
        departureTime, fuelBefore,
        parseInt(passengersOnBoard)||0,
        parseInt(passengersWeightLbs)||0,
        parseInt(cargoOnLbs)||0,
        notes||null,
      ]
    );

    await query(
      `UPDATE day_operations SET total_nm = total_nm + $1, updated_at = NOW() WHERE id = $2`,
      [distNm, dayOpId]
    );

    res.status(201).json({
      id: result.rows[0].id, flightNumber: flightNum,
      departureTime, fuelBefore, distanceNm: distNm,
      payloadAvail, payloadUsed, payloadFree: payloadAvail - payloadUsed,
      message: `Leg #${flightNum} iniciada às ${departureTime.slice(0,5)}`,
    });

  } catch (err) {
    console.error('Depart error:', err.message);
    res.status(500).json({ error: 'Failed to register departure' });
  }
});

// ── PATCH /api/flights/:id/arrive — REGISTAR CHEGADA ─────────────────────
router.patch('/:id/arrive', validateUUID, async (req, res) => {
  try {
    const {
      fuelRemainingAfter,
      passengersDrop            = 0,
      passengersPickup          = 0,
      passengersPickupWeightLbs = 0,   // peso dos PAX que entraram
      cargoOffLbs               = 0,
    } = req.body;

    if (fuelRemainingAfter === undefined || fuelRemainingAfter === null || fuelRemainingAfter === '')
      return res.status(400).json({ error: 'fuelRemainingAfter é obrigatório' });

    const flightRes = await query('SELECT * FROM flights WHERE id = $1', [req.params.id]);
    if (!flightRes.rows[0]) return res.status(404).json({ error: 'Leg not found' });
    const flight = flightRes.rows[0];

    if (flight.arrival_time)
      return res.status(400).json({ error: 'Esta leg já tem chegada registada' });

    // ── Cálculo de peso médio por PAX ──────────────────────────────
    const paxOnBoard     = Math.max(1, flight.passengers_on_board || 1);
    const paxWeightTotal = flight.passengers_weight_lbs || 0;
    const avgPaxWeight   = paxWeightTotal > 0 ? Math.round(paxWeightTotal / paxOnBoard) : 0;

    // Peso removido pelos PAX que desembarcaram
    const weightDropped = (parseInt(passengersDrop) || 0) * avgPaxWeight;

    // Peso PAX que ficam + peso dos PAX que embarcaram neste destino
    const paxWeightAfter = Math.max(0,
      paxWeightTotal
      - weightDropped
      + (parseInt(passengersPickupWeightLbs) || 0)
    );

    // ── Hora, duração, fuel ───────────────────────────────────────
    const arrivalTime  = new Date().toTimeString().slice(0, 8);
    const durationMin  = calcFlightDuration(
      flight.departure_time?.slice(0,5),
      arrivalTime.slice(0,5)
    );
    const fuelAfterInt = parseInt(fuelRemainingAfter) || 0;
    const fuelBurnCalc = Math.max(0, (flight.fuel_remain_lbs || 0) - fuelAfterInt);
    const cargoNetLbs  = Math.max(0, (flight.cargo_on_lbs || 0) - (parseInt(cargoOffLbs) || 0));

    await query(
      `UPDATE flights SET
         arrival_time                = $1,
         duration_minutes            = $2,
         fuel_remaining_after        = $3,
         fuel_after_lbs              = $3,
         fuel_burn_lbs               = $4,
         passengers_drop             = $5,
         passengers_pickup           = $6,
         cargo_off_lbs               = $7,
         cargo_net_lbs               = $8,
         passengers_weight_after_lbs = $9,
         updated_at                  = NOW()
       WHERE id = $10`,
      [
        arrivalTime, durationMin,
        fuelAfterInt, fuelBurnCalc,
        parseInt(passengersDrop)   || 0,
        parseInt(passengersPickup) || 0,
        parseInt(cargoOffLbs)      || 0,
        cargoNetLbs,
        paxWeightAfter,
        req.params.id,
      ]
    );

    await query(
      `UPDATE day_operations SET
         total_fuel_burn_lbs = total_fuel_burn_lbs + $1,
         total_passengers    = total_passengers    + $2,
         current_fuel_lbs    = $3,
         updated_at          = NOW()
       WHERE id = $4`,
      [fuelBurnCalc, parseInt(passengersDrop)||0, fuelAfterInt, flight.day_op_id]
    );

    res.json({
      arrivalTime:     arrivalTime.slice(0,5),
      durationMinutes: durationMin,
      fuelBurn:        fuelBurnCalc,
      fuelRemaining:   fuelAfterInt,
      avgPaxWeight,
      weightDropped,
      pickupWeight:    parseInt(passengersPickupWeightLbs) || 0,
      paxWeightAfter,
      message: `Chegada às ${arrivalTime.slice(0,5)} — ${fuelBurnCalc} lbs queimados`,
    });

  } catch (err) {
    console.error('Arrive error:', err.message);
    res.status(500).json({ error: 'Failed to register arrival' });
  }
});

// ── PUT /api/flights/:id — EDITAR ─────────────────────────────────────────
router.put('/:id', validateUUID, async (req, res) => {
  try {
    const {
      fuelRemainingAfter, passengersDrop, passengersPickup,
      passengersOnBoard, passengersWeightLbs,
      passengersPickupWeightLbs,
      cargoOnLbs, cargoOffLbs,
      departureTime, arrivalTime, notes, editReason,
    } = req.body;

    if (!editReason?.trim()) return res.status(400).json({ error: 'editReason is required' });

    const oldRes = await query('SELECT * FROM flights WHERE id = $1', [req.params.id]);
    if (!oldRes.rows[0]) return res.status(404).json({ error: 'Flight not found' });
    const old = oldRes.rows[0];

    const fuelAfterInt = fuelRemainingAfter !== undefined ? parseInt(fuelRemainingAfter) : (old.fuel_remaining_after || 0);
    const fuelBurnCalc = Math.max(0, (old.fuel_remain_lbs || 0) - fuelAfterInt);
    const cargoNet     = Math.max(0,
      (parseInt(cargoOnLbs  ?? old.cargo_on_lbs)  || 0) -
      (parseInt(cargoOffLbs ?? old.cargo_off_lbs) || 0)
    );
    const depTime = departureTime || old.departure_time;
    const arrTime = arrivalTime   || old.arrival_time;
    const durMin  = (depTime && arrTime)
      ? calcFlightDuration(depTime.slice(0,5), arrTime.slice(0,5))
      : old.duration_minutes;

    // Recalcula peso PAX após chegada
    const newPaxOnBoard     = passengersOnBoard   !== undefined ? parseInt(passengersOnBoard)   : (old.passengers_on_board  || 0);
    const newPaxWeightTotal = passengersWeightLbs !== undefined ? parseInt(passengersWeightLbs) : (old.passengers_weight_lbs || 0);
    const newPaxDrop        = passengersDrop      !== undefined ? parseInt(passengersDrop)      : (old.passengers_drop       || 0);
    const newPickupWeight   = passengersPickupWeightLbs !== undefined ? parseInt(passengersPickupWeightLbs) : 0;
    const newAvgPaxWeight   = newPaxOnBoard > 0 && newPaxWeightTotal > 0
      ? Math.round(newPaxWeightTotal / newPaxOnBoard) : 0;
    const newPaxWeightAfter = Math.max(0,
      newPaxWeightTotal - (newPaxDrop * newAvgPaxWeight) + newPickupWeight
    );

    const changes = [];
    const track = (field, oldVal, newVal) => {
      if (newVal !== undefined && String(newVal) !== String(oldVal))
        changes.push({ field, old: String(oldVal), new: String(newVal) });
    };
    track('fuel_remaining_after',   old.fuel_remaining_after,   fuelRemainingAfter);
    track('passengers_on_board',    old.passengers_on_board,    passengersOnBoard);
    track('passengers_weight_lbs',  old.passengers_weight_lbs,  passengersWeightLbs);
    track('passengers_drop',        old.passengers_drop,        passengersDrop);
    track('passengers_pickup',      old.passengers_pickup,      passengersPickup);
    track('cargo_on_lbs',           old.cargo_on_lbs,           cargoOnLbs);
    track('cargo_off_lbs',          old.cargo_off_lbs,          cargoOffLbs);
    track('departure_time',         old.departure_time,         departureTime);
    track('arrival_time',           old.arrival_time,           arrivalTime);

    await transaction(async (client) => {
      await client.query(
        `UPDATE flights SET
           fuel_remaining_after        = COALESCE($1, fuel_remaining_after),
           fuel_after_lbs              = COALESCE($1, fuel_after_lbs),
           fuel_burn_lbs               = $2,
           passengers_on_board         = COALESCE($3, passengers_on_board),
           passengers_weight_lbs       = COALESCE($4, passengers_weight_lbs),
           passengers_drop             = COALESCE($5, passengers_drop),
           passengers_pickup           = COALESCE($6, passengers_pickup),
           passengers_weight_after_lbs = $7,
           cargo_on_lbs                = COALESCE($8, cargo_on_lbs),
           cargo_off_lbs               = COALESCE($9, cargo_off_lbs),
           cargo_net_lbs               = $10,
           departure_time              = COALESCE($11, departure_time),
           arrival_time                = COALESCE($12, arrival_time),
           duration_minutes            = COALESCE($13, duration_minutes),
           notes                       = COALESCE($14, notes),
           updated_at                  = NOW()
         WHERE id = $15`,
        [
          fuelRemainingAfter !== undefined ? fuelAfterInt : null,
          fuelBurnCalc,
          passengersOnBoard   !== undefined ? parseInt(passengersOnBoard)   : null,
          passengersWeightLbs !== undefined ? parseInt(passengersWeightLbs) : null,
          passengersDrop      !== undefined ? parseInt(passengersDrop)      : null,
          passengersPickup    !== undefined ? parseInt(passengersPickup)    : null,
          newPaxWeightAfter,
          cargoOnLbs  !== undefined ? parseInt(cargoOnLbs)  : null,
          cargoOffLbs !== undefined ? parseInt(cargoOffLbs) : null,
          cargoNet,
          departureTime||null, arrivalTime||null, durMin||null,
          notes||null,
          req.params.id,
        ]
      );

      for (const c of changes) {
        await client.query(
          `INSERT INTO edit_logs (user_id, user_name, entity_type, entity_id, field_name, old_value, new_value, reason)
           VALUES ($1,$2,'flight',$3,$4,$5,$6,$7)`,
          [req.user.id, req.user.name, req.params.id, c.field, c.old, c.new, editReason.trim()]
        );
      }

      const totals = await client.query(
        `SELECT COALESCE(SUM(fuel_burn_lbs),0) AS tb,
                COALESCE(SUM(passengers_drop),0) AS tp,
                COALESCE(SUM(distance_nm),0) AS tn
         FROM flights WHERE day_op_id = $1`, [old.day_op_id]
      );
      const t = totals.rows[0];
      await client.query(
        `UPDATE day_operations SET
           total_fuel_burn_lbs=$1, total_passengers=$2, total_nm=$3, updated_at=NOW()
         WHERE id=$4`,
        [t.tb, t.tp, t.tn, old.day_op_id]
      );
    });

    res.json({ message: 'Leg actualizada', fuelBurn: fuelBurnCalc, paxWeightAfter: newPaxWeightAfter });
  } catch (err) {
    console.error('Update flight error:', err.message);
    res.status(500).json({ error: 'Failed to update flight' });
  }
});

// ── GET /api/flights/:id ──────────────────────────────────────────────────
router.get('/:id', validateUUID, async (req, res) => {
  try {
    const result = await query(
      `SELECT f.*, fd.name AS from_name, td.name AS to_name
       FROM flights f
       LEFT JOIN destinations fd ON f.from_dest_id = fd.id
       LEFT JOIN destinations td ON f.to_dest_id   = td.id
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