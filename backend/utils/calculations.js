// ===========================================
// BLADEOPS — Weight & Fuel Calculations
// ===========================================

const MTOW_LBS             = 10560;
const BASE_OP_WEIGHT_LBS   = 7908;
const CREW_STD_WEIGHT_LBS  = 374;
const AIRCRAFT_BASE_LBS    = BASE_OP_WEIGHT_LBS - CREW_STD_WEIGHT_LBS; // 7534
const PAX_STD_WEIGHT_LBS   = 187;
const MAX_DAILY_HOURS_MIN  = 480;

/**
 * Calcula o peso total de um voo.
 * Aceita pesos específicos da aeronave — se não fornecidos usa os padrões.
 */
function calcTotalWeight({ passengersOnBoard, passengersWeight, fuelTotalLbs, cargoNetLbs, crewWeightLbs, paxStdWeight, aircraftBaseLbs, mtowLbs }) {
  const crew   = crewWeightLbs   != null ? crewWeightLbs   : CREW_STD_WEIGHT_LBS;
  const acBase = aircraftBaseLbs != null ? aircraftBaseLbs : AIRCRAFT_BASE_LBS;
  const mtow   = mtowLbs         || MTOW_LBS;
  const paxStd = paxStdWeight    || PAX_STD_WEIGHT_LBS;
  const base   = acBase + crew;
  const paxWt  = passengersWeight || (passengersOnBoard || 0) * paxStd;
  const total  = base + paxWt + (cargoNetLbs || 0) + (fuelTotalLbs || 0);
  return {
    base, crew, passengers: paxWt,
    cargo: cargoNetLbs || 0, fuel: fuelTotalLbs || 0,
    total: Math.round(total),
    percentMTOW: Math.round((total / mtow) * 100),
    withinLimit: total <= mtow,
    margin: Math.round(mtow - total),
  };
}

function calcFuelChain({ fuelRemain, fuelUplift = 0, fuelBurn = 0 }) {
  const total = fuelRemain + fuelUplift;
  const after = Math.max(0, total - fuelBurn);
  return {
    remain: Math.round(fuelRemain), uplift: Math.round(fuelUplift),
    total: Math.round(total), burn: Math.round(fuelBurn), after: Math.round(after),
  };
}

function propagateFuelChain(flights) {
  const result = [...flights];
  for (let i = 1; i < result.length; i++) {
    const prevAfter = result[i - 1].fuel_after_lbs;
    result[i].fuel_remain_lbs = prevAfter;
    const chain = calcFuelChain({
      fuelRemain: prevAfter,
      fuelUplift: result[i].fuel_uplift_lbs,
      fuelBurn:   result[i].fuel_burn_lbs,
    });
    result[i].fuel_total_lbs = chain.total;
    result[i].fuel_after_lbs = chain.after;
    const wt = calcTotalWeight({
      passengersOnBoard: result[i].passengers_on_board,
      fuelTotalLbs:      chain.total,
      cargoNetLbs:       result[i].cargo_net_lbs,
      crewWeightLbs:     result[i].crew_weight_lbs || null,
    });
    result[i].total_weight_lbs = wt.total;
  }
  return result;
}

function calcBlockTime(motorOnTime, motorOffTime) {
  if (!motorOnTime || !motorOffTime) return 0;
  const [h1, m1] = motorOnTime.split(':').map(Number);
  const [h2, m2] = motorOffTime.split(':').map(Number);
  return Math.max(0, (h2 * 60 + m2) - (h1 * 60 + m1));
}

function calcFlightDuration(departureTime, arrivalTime) {
  if (!departureTime || !arrivalTime) return 0;
  const [h1, m1] = departureTime.split(':').map(Number);
  const [h2, m2] = arrivalTime.split(':').map(Number);
  return Math.max(0, (h2 * 60 + m2) - (h1 * 60 + m1));
}

function formatMinutes(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

function checkPilotHoursLimit(currentMinutes, flightDurationMinutes = 0) {
  const total = currentMinutes + flightDurationMinutes;
  return {
    current: currentMinutes, projected: total, limit: MAX_DAILY_HOURS_MIN,
    remaining: MAX_DAILY_HOURS_MIN - currentMinutes,
    percentUsed: Math.round((total / MAX_DAILY_HOURS_MIN) * 100),
    atLimit: total >= MAX_DAILY_HOURS_MIN,
    nearLimit: total >= MAX_DAILY_HOURS_MIN * 0.875,
  };
}

function checkDocExpiry(expiryDate) {
  if (!expiryDate) return { status: 'missing', daysLeft: null };
  const now = new Date();
  const exp = new Date(expiryDate);
  const daysLeft = Math.floor((exp - now) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0)  return { status: 'expired',       daysLeft };
  if (daysLeft < 30) return { status: 'expiring_soon', daysLeft };
  return { status: 'valid', daysLeft };
}

function isPilotAptToFly(pilot) {
  const docs = [
    pilot.license_expiry, pilot.medical_class1_expiry,
    pilot.huet_expiry, pilot.bosiet_expiry, pilot.annual_check_expiry,
  ];
  for (const d of docs) {
    const s = checkDocExpiry(d);
    if (s.status === 'expired' || s.status === 'missing') return false;
  }
  return true;
}

module.exports = {
  MTOW_LBS, BASE_OP_WEIGHT_LBS, AIRCRAFT_BASE_LBS,
  CREW_STD_WEIGHT_LBS, PAX_STD_WEIGHT_LBS, MAX_DAILY_HOURS_MIN,
  calcTotalWeight, calcFuelChain, propagateFuelChain,
  calcBlockTime, calcFlightDuration, formatMinutes,
  checkPilotHoursLimit, checkDocExpiry, isPilotAptToFly,
};