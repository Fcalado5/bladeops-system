// ===========================================
// BLADEOPS — Weight & Fuel Calculations
// ===========================================

const MTOW_LBS = 10560;
const BASE_OP_WEIGHT_LBS = 7908; // empty + crew/equip
const PAX_STD_WEIGHT_LBS = 187;
const MAX_DAILY_HOURS_MIN = 480; // 8h in minutes

/**
 * Calculate total weight for a flight
 */
function calcTotalWeight({ passengersOnBoard, passengersWeight, fuelTotalLbs, cargoNetLbs }) {
  const paxWt = passengersWeight || passengersOnBoard * PAX_STD_WEIGHT_LBS;
  const total = BASE_OP_WEIGHT_LBS + paxWt + (cargoNetLbs || 0) + (fuelTotalLbs || 0);
  return {
    base: BASE_OP_WEIGHT_LBS,
    passengers: paxWt,
    cargo: cargoNetLbs || 0,
    fuel: fuelTotalLbs || 0,
    total: Math.round(total),
    percentMTOW: Math.round((total / MTOW_LBS) * 100),
    withinLimit: total <= MTOW_LBS,
    margin: Math.round(MTOW_LBS - total),
  };
}

/**
 * Calculate fuel chain for a flight
 * remain + uplift = total; total - burn = after
 */
function calcFuelChain({ fuelRemain, fuelUplift = 0, fuelBurn = 0 }) {
  const total = fuelRemain + fuelUplift;
  const after = Math.max(0, total - fuelBurn);
  return {
    remain: Math.round(fuelRemain),
    uplift: Math.round(fuelUplift),
    total: Math.round(total),
    burn: Math.round(fuelBurn),
    after: Math.round(after),
  };
}

/**
 * Recalculate all flights in a day when one is edited
 * Ensures fuel chain propagates correctly
 */
function propagateFuelChain(flights) {
  const result = [...flights];
  for (let i = 1; i < result.length; i++) {
    // Previous flight's fuelAfter becomes this flight's fuelRemain
    const prevAfter = result[i - 1].fuel_after_lbs;
    result[i].fuel_remain_lbs = prevAfter;
    const chain = calcFuelChain({
      fuelRemain: prevAfter,
      fuelUplift: result[i].fuel_uplift_lbs,
      fuelBurn: result[i].fuel_burn_lbs,
    });
    result[i].fuel_total_lbs = chain.total;
    result[i].fuel_after_lbs = chain.after;
    // Recalculate total weight
    const wt = calcTotalWeight({
      passengersOnBoard: result[i].passengers_on_board,
      fuelTotalLbs: chain.total,
      cargoNetLbs: result[i].cargo_net_lbs,
    });
    result[i].total_weight_lbs = wt.total;
  }
  return result;
}

/**
 * Calculate block time between two time strings
 */
function calcBlockTime(motorOnTime, motorOffTime) {
  if (!motorOnTime || !motorOffTime) return 0;
  const [h1, m1] = motorOnTime.split(':').map(Number);
  const [h2, m2] = motorOffTime.split(':').map(Number);
  const minutes = (h2 * 60 + m2) - (h1 * 60 + m1);
  return Math.max(0, minutes);
}

/**
 * Calculate flight duration in minutes
 */
function calcFlightDuration(departureTime, arrivalTime) {
  if (!departureTime || !arrivalTime) return 0;
  const [h1, m1] = departureTime.split(':').map(Number);
  const [h2, m2] = arrivalTime.split(':').map(Number);
  return Math.max(0, (h2 * 60 + m2) - (h1 * 60 + m1));
}

/**
 * Format minutes to h:mm string
 */
function formatMinutes(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0
    ? `${h}h ${String(m).padStart(2, '0')}m`
    : `${m}m`;
}

/**
 * Check if pilot is within daily hour limit
 */
function checkPilotHoursLimit(currentMinutes, flightDurationMinutes = 0) {
  const total = currentMinutes + flightDurationMinutes;
  return {
    current: currentMinutes,
    projected: total,
    limit: MAX_DAILY_HOURS_MIN,
    remaining: MAX_DAILY_HOURS_MIN - currentMinutes,
    percentUsed: Math.round((total / MAX_DAILY_HOURS_MIN) * 100),
    atLimit: total >= MAX_DAILY_HOURS_MIN,
    nearLimit: total >= MAX_DAILY_HOURS_MIN * 0.875, // 87.5% = 7h
  };
}

/**
 * Check document expiry status
 */
function checkDocExpiry(expiryDate) {
  if (!expiryDate) return { status: 'missing', daysLeft: null };
  const now = new Date();
  const exp = new Date(expiryDate);
  const daysLeft = Math.floor((exp - now) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0) return { status: 'expired', daysLeft };
  if (daysLeft < 30) return { status: 'expiring_soon', daysLeft };
  return { status: 'valid', daysLeft };
}

/**
 * Check if pilot is apt to fly (all docs valid)
 */
function isPilotAptToFly(pilot) {
  const docs = [
    pilot.license_expiry,
    pilot.medical_class1_expiry,
    pilot.huet_expiry,
    pilot.bosiet_expiry,
    pilot.annual_check_expiry,
  ];
  for (const d of docs) {
    const status = checkDocExpiry(d);
    if (status.status === 'expired' || status.status === 'missing') {
      return false;
    }
  }
  return true;
}

module.exports = {
  MTOW_LBS,
  BASE_OP_WEIGHT_LBS,
  PAX_STD_WEIGHT_LBS,
  MAX_DAILY_HOURS_MIN,
  calcTotalWeight,
  calcFuelChain,
  propagateFuelChain,
  calcBlockTime,
  calcFlightDuration,
  formatMinutes,
  checkPilotHoursLimit,
  checkDocExpiry,
  isPilotAptToFly,
};
