import { calculationInputSchema } from '../schemas/index.js';
const round = (n, digits = 0) => Number(n.toFixed(digits));
export function energyBill(units, tariff) {
  let energy = 0,
    lower = 0;
  for (const slab of tariff.slabs) {
    const upper = slab.upTo ?? Infinity;
    energy += Math.max(0, Math.min(units, upper) - lower) * slab.rate;
    lower = upper;
  }
  const subtotal =
    energy +
    tariff.fixedChargeInr +
    Math.max(0, units) * (tariff.wheelingRateInrPerKwh + tariff.facInrPerKwh);
  return round(subtotal * (1 + tariff.dutyPct / 100), 2);
}
export function subsidyFor(kw, input, snapshot) {
  if (
    input.ownershipType === 'RENTED' ||
    !snapshot.subsidy.eligibleCategories.includes(input.consumerCategory)
  )
    return 0;
  let subsidy = 0,
    lower = 0;
  for (const tier of snapshot.subsidy.tiers) {
    subsidy += Math.max(0, Math.min(kw, tier.upToKw) - lower) * tier.inrPerKw;
    lower = tier.upToKw;
  }
  return round(Math.min(snapshot.subsidy.maxSubsidyInr, subsidy));
}
function scenario(key, kw, input, snapshot, avg) {
  const { tariff, economics } = snapshot;
  const monthly = Array.from({ length: 12 }, (_, i) => {
    const known = input.monthlyUnits.find((m) => Number(m.billMonth.slice(5)) === i + 1);
    const units = known?.unitsKwh ?? avg;
    const generation = kw * snapshot.yields[input.districtCode][i];
    return {
      month: new Date(Date.UTC(2026, i, 1)).toLocaleString('en-IN', {
        month: 'short',
        timeZone: 'UTC',
      }),
      consumptionKwh: round(units),
      generationKwh: round(generation),
      billBeforeInr: energyBill(units, tariff),
      billAfterInr: 0,
    };
  });
  // Credits are banked forward through one Jan–Dec model year. No cash credit
  // is assumed unless the snapshot supplies a verified surplus settlement rate.
  const annualModel = (factor) => {
    let bank = 0,
      savings = 0;
    for (const month of monthly) {
      const generation = month.generationKwh * factor;
      const net = month.consumptionKwh - generation - bank;
      bank = Math.max(0, -net);
      const after = energyBill(Math.max(0, net), tariff);
      if (factor === 1) month.billAfterInr = after;
      savings += month.billBeforeInr - after;
    }
    return savings + bank * tariff.surplusRateInrPerKwh;
  };
  const annualSavings = annualModel(1);
  const subsidyInr = subsidyFor(kw, input, snapshot);
  const grossCostInr =
    kw > 0 ? (input.vendorQuoteInr ?? round(kw * economics.benchmarkPerKwInr)) : 0;
  const netCostInr = Math.max(0, grossCostInr - subsidyInr);
  let cumulative = 0,
    paybackYears = netCostInr === 0 && kw > 0 ? 0 : null;
  const projection = [{ year: 0, savingsInr: 0, netSavingsInr: -netCostInr }];
  for (let year = 1; year <= 25; year++) {
    let savings = annualModel((1 - economics.annualDegradationPct / 100) ** (year - 1));
    if (year === economics.inverterReplacementYear)
      savings -= economics.inverterReplacementPerKwInr * kw;
    const previous = cumulative;
    cumulative += savings;
    if (paybackYears === null && cumulative >= netCostInr && savings > 0)
      paybackYears = round(year - 1 + (netCostInr - previous) / savings, 1);
    projection.push({
      year,
      savingsInr: round(cumulative),
      netSavingsInr: round(cumulative - netCostInr),
    });
  }
  const generation = monthly.reduce((s, m) => s + m.generationKwh, 0);
  return {
    key,
    capacityKw: round(kw, 2),
    subsidyInr,
    grossCostInr,
    netCostInr,
    billBeforeInr: round(monthly.reduce((s, m) => s + m.billBeforeInr, 0) / 12),
    billAfterInr: round(monthly.reduce((s, m) => s + m.billAfterInr, 0) / 12),
    monthlySavingsInr: round(annualSavings / 12),
    annualGenerationKwh: round(generation),
    paybackYears,
    savings25yrInr: round(cumulative - netCostInr),
    co2AvoidedKgPerYear: round(generation * economics.co2KgPerKwh),
    monthly,
    projection,
  };
}
export function calculate(raw, snapshot) {
  const input = calculationInputSchema.parse(raw);
  const avg = input.monthlyUnits.length
    ? input.monthlyUnits.reduce((s, m) => s + m.unitsKwh, 0) / input.monthlyUnits.length
    : 0;
  const roof = (input.roofAreaSqM * input.shadowFreePct) / 100 / snapshot.rule.sqMPerKw;
  const cap = (avg * snapshot.rule.capFactor) / snapshot.rule.genUnitsPerKwMonth;
  const tolerance = 1 + snapshot.rule.capacityTolerancePct / 100;
  // A tolerance never overrides physical roof space or sanctioned-load safety.
  const consumption = Math.min(cap * tolerance, roof, input.sanctionedLoadKw);
  const legal = Math.min(
    input.sanctionedLoadKw * tolerance,
    input.sanctionedLoadKw,
    snapshot.rule.deemedApprovalMaxKw,
    roof,
  );
  const historyStatus = input.monthlyUnits.length === 12 ? 'COMPLETE' : 'INSUFFICIENT';
  const warnings = [];
  if (!snapshot.rule.verified)
    warnings.push(
      'Capacity policy is an unverified PRD assumption. Confirm the current MSEDCL process before applying.',
    );
  if (!snapshot.tariff.verified || !snapshot.economics.verified)
    warnings.push(
      'Tariffs, yield, installation cost and carbon factors are illustrative seed values. Financial and generation estimates are provisional.',
    );
  if (historyStatus === 'INSUFFICIENT')
    warnings.push(
      `Only ${input.monthlyUnits.length} of 12 bills supplied. Capacity is provisional; ask MSEDCL how new or incomplete connections are treated.`,
    );
  if (input.ownershipType === 'RENTED')
    warnings.push(
      'The property owner should be the applicant. No subsidy is assumed for a renter.',
    );
  if (input.ownershipType === 'SHARED')
    warnings.push(
      'A shared roof requires society consent and a separate eligibility check; household results are provisional.',
    );
  if (input.consumerCategory !== 'LT_RESIDENTIAL')
    warnings.push('Central residential subsidy does not apply to a commercial connection.');
  if (input.expectedAddedLoadKw)
    warnings.push(
      'Planned EV/AC load does not increase the present eligibility. Request a sanctioned-load change separately.',
    );
  if (consumption % 1 !== 0 || legal % 1 !== 0)
    warnings.push(
      'Fractional-kW subsidy is modelled pro-rata; confirm the claimable amount on the national portal.',
    );
  const sourceUrl = snapshot.rule.sourceUrl;
  const checklist = [
    {
      code: 'CAPACITY',
      title: 'Confirm the capacity MSEDCL will accept',
      severity: 'CHECK',
      why: 'The two sizing paths can differ while policy is under review.',
      fix: 'Ask MSEDCL to confirm the permissible kW in writing before ordering equipment.',
      sourceUrl,
    },
    {
      code: 'IDENTITY',
      title: 'Match applicant, electricity bill and bank details',
      severity: 'CHECK',
      why: 'Name or account mismatches may delay verification and direct benefit transfer.',
      fix: 'Check your connection name, ownership proof, bank account and IFSC.',
      sourceUrl: snapshot.subsidy.sourceUrl,
    },
    {
      code: 'VENDOR',
      title: 'Use a registered vendor and eligible domestic modules',
      severity: 'CHECK',
      why: 'Subsidy depends on the current scheme and equipment requirements.',
      fix: 'Verify registration and domestic-content documents on PM Surya Ghar before paying.',
      sourceUrl: 'https://pmsuryaghar.gov.in/',
    },
  ];
  if (historyStatus === 'INSUFFICIENT')
    checklist.unshift({
      code: 'HISTORY',
      title: 'Clarify eligibility with fewer than 12 bills',
      severity: 'MUST_FIX',
      why: 'The reported consumption-cap process may require a full year of history.',
      fix: 'Keep all available bills and ask MSEDCL about the new-connection route.',
      sourceUrl,
    });
  if (input.ownershipType !== 'OWN')
    checklist.unshift({
      code: 'OWNERSHIP',
      title:
        input.ownershipType === 'RENTED'
          ? 'Ask the owner to apply'
          : 'Get society and roof-use consent',
      severity: 'MUST_FIX',
      why: 'This tool cannot establish your right to use a shared or rented roof.',
      fix: 'Obtain the required ownership or consent documents and confirm the application route.',
      sourceUrl,
    });
  return {
    engineVersion: '0.1.0',
    historyStatus,
    eligibleApplicant:
      input.ownershipType !== 'RENTED' && input.consumerCategory === 'LT_RESIDENTIAL',
    averageMonthlyUnits: round(avg, 2),
    consumptionCapKw: round(cap, 2),
    roofCapKw: round(roof, 2),
    headlineScenario:
      snapshot.rule.enforcementStatus === 'STAYED' ? 'LEGAL_MAX' : 'CONSUMPTION_CAP',
    scenarios: {
      CONSUMPTION_CAP: scenario('CONSUMPTION_CAP', consumption, input, snapshot, avg),
      LEGAL_MAX: scenario('LEGAL_MAX', legal, input, snapshot, avg),
    },
    warnings,
    checklist,
    versions: {
      ruleVersionId: snapshot.rule.id,
      tariffVersionId: snapshot.tariff.id,
      subsidySchemeId: snapshot.subsidy.id,
    },
  };
}
