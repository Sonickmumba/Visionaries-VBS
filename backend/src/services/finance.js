function decimalFactor(scale = 2) {
  return 10 ** Number(scale || 0);
}

function roundHalfEven(value) {
  const floor = Math.floor(value);
  const difference = value - floor;
  if (difference < 0.5) return floor;
  if (difference > 0.5) return floor + 1;
  return floor % 2 === 0 ? floor : floor + 1;
}

export function money(value, { scale = 2, mode = "HALF_UP" } = {}) {
  const numeric = Number(value || 0);
  const factor = decimalFactor(scale);
  const scaled = numeric * factor;
  const sign = Math.sign(scaled) || 1;
  const absolute = Math.abs(scaled);
  let rounded;
  switch (String(mode || "HALF_UP").toUpperCase()) {
    case "DOWN":
      rounded = Math.floor(absolute);
      break;
    case "UP":
      rounded = Math.ceil(absolute);
      break;
    case "HALF_EVEN":
      rounded = roundHalfEven(absolute);
      break;
    case "HALF_UP":
    default:
      rounded = Math.round(absolute + Number.EPSILON);
      break;
  }
  return (sign * rounded) / factor;
}

export function roundingPolicyFromCycle(cycle = {}) {
  return {
    scale: Number.isInteger(Number(cycle.rounding_scale)) ? Number(cycle.rounding_scale) : 2,
    mode: cycle.rounding_mode || "HALF_UP",
  };
}

export function calculateSavingsInterest({ broughtForward, deposit, rate, roundingPolicy = {} }) {
  const base = money(Number(broughtForward || 0) + Number(deposit || 0), roundingPolicy);
  const interest = money(base * Number(rate || 0), roundingPolicy);
  return {
    base,
    interest,
    carriedForward: money(base + interest, roundingPolicy),
  };
}

export function calculateLoanInterest({ broughtForward, newLoan, principalRepaid, interestRepaid, rate, roundingPolicy = {} }) {
  const interest = money(Number(broughtForward || 0) * Number(rate || 0), roundingPolicy);
  const beforeNewLoan = money(
    Number(broughtForward || 0) + interest - Number(principalRepaid || 0) - Number(interestRepaid || 0),
    roundingPolicy
  );
  return {
    interest,
    beforeNewLoan,
    carriedForward: money(beforeNewLoan + Number(newLoan || 0), roundingPolicy),
  };
}

export function classifyBorrowing(cumulativeBorrowed, minimumBorrowing) {
  const borrowed = Number(cumulativeBorrowed || 0);
  const minimum = Number(minimumBorrowing || 0);
  if (borrowed <= 0) {
    return {
      status: "NEVER_BORROWED",
      shortfall: money(minimum),
    };
  }
  if (borrowed < minimum) {
    return {
      status: "BORROWED_BELOW_MINIMUM",
      shortfall: money(minimum - borrowed),
    };
  }
  return {
    status: "AT_OR_ABOVE_MINIMUM",
    shortfall: 0,
  };
}

export function allocateCommonInterest({ members, unborrowedMoney, rate, method, roundingPolicy = {} }) {
  const base = money(unborrowedMoney, roundingPolicy);
  const commonInterestPool = money(base * Number(rate || 0), roundingPolicy);
  const eligible = members.filter((member) => {
    if (method === "ONLY_NON_BORROWERS_EQUAL") return member.status === "NEVER_BORROWED";
    if (method === "NON_BORROWERS_AND_BELOW_MINIMUM_PROPORTIONAL") return member.shortfall > 0;
    return true;
  });

  if (!eligible.length || base <= 0) {
    return { commonInterestPool, allocations: [] };
  }

  let allocations;
  if (method === "NON_BORROWERS_AND_BELOW_MINIMUM_PROPORTIONAL") {
    const totalShortfall = eligible.reduce((sum, member) => sum + Number(member.shortfall || 0), 0);
    let assignedSoFar = 0;
    allocations = eligible.map((member, index) => {
      const weight = totalShortfall > 0 ? Number(member.shortfall || 0) / totalShortfall : 0;
      const assignedBase = index === eligible.length - 1
        ? money(base - assignedSoFar, roundingPolicy)
        : money(base * weight, roundingPolicy);
      assignedSoFar = money(assignedSoFar + assignedBase, roundingPolicy);
      return { ...member, weight, assignedBase, charge: money(assignedBase * Number(rate || 0), roundingPolicy) };
    });
  } else {
    const weight = 1 / eligible.length;
    let assignedSoFar = 0;
    allocations = eligible.map((member, index) => {
      const assignedBase = index === eligible.length - 1
        ? money(base - assignedSoFar, roundingPolicy)
        : money(base * weight, roundingPolicy);
      assignedSoFar = money(assignedSoFar + assignedBase, roundingPolicy);
      return { ...member, weight, assignedBase, charge: money(assignedBase * Number(rate || 0), roundingPolicy) };
    });
  }

  const chargeTotal = money(allocations.reduce((sum, item) => sum + Number(item.charge || 0), 0), roundingPolicy);
  const chargeResidual = money(commonInterestPool - chargeTotal, roundingPolicy);
  if (chargeResidual !== 0 && allocations.length) {
    const last = allocations[allocations.length - 1];
    allocations[allocations.length - 1] = {
      ...last,
      charge: money(Number(last.charge || 0) + chargeResidual, roundingPolicy),
    };
  }

  return { commonInterestPool, allocations };
}
