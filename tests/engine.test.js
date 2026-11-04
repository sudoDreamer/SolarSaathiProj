import { describe, expect, it } from 'vitest';
import { calculate, energyBill } from '../packages/engine/index.js';
import { calculationInputSchema } from '../packages/schemas/index.js';
import seed from '../scripts/data/rules.seed.json' with { type: 'json' };
const snapshot = () => structuredClone(seed);
export const exampleInput = (units = 300) => ({
  discomCode: 'MSEDCL',
  consumerCategory: 'LT_RESIDENTIAL',
  phaseType: 'SINGLE',
  sanctionedLoadKw: 5,
  monthlyUnits: Array.from({ length: 12 }, (_, i) => ({
    billMonth: `2025-${String(i + 1).padStart(2, '0')}`,
    unitsKwh: units,
  })),
  roofAreaSqM: 100,
  shadowFreePct: 100,
  ownershipType: 'OWN',
  districtCode: 'PUNE',
  expectedAddedLoadKw: 0,
});
describe('deterministic versioned engine', () => {
  it.each([
    [300, 1, 2, 60000],
    [450, 1, 3, 78000],
    [300, 1.25, 2.5, 69000],
  ])('golden: %i units at %f multiplier', (units, factor, kw, subsidy) => {
    const s = snapshot();
    s.rule.capFactor = factor;
    const o = calculate(exampleInput(units), s);
    expect(o.scenarios.CONSUMPTION_CAP.capacityKw).toBe(kw);
    expect(o.scenarios.CONSUMPTION_CAP.subsidyInr).toBe(subsidy);
  });
  it('caps legal-path subsidy at the scheme maximum', () => {
    const o = calculate(exampleInput(), snapshot());
    expect(o.scenarios.LEGAL_MAX.capacityKw).toBe(5);
    expect(o.scenarios.LEGAL_MAX.subsidyInr).toBe(78000);
  });
  it('flags zero bill history without inventing consumption', () => {
    const input = exampleInput();
    input.monthlyUnits = [];
    const o = calculate(input, snapshot());
    expect(o.historyStatus).toBe('INSUFFICIENT');
    expect(o.averageMonthlyUnits).toBe(0);
    expect(o.scenarios.CONSUMPTION_CAP.capacityKw).toBe(0);
    expect(o.checklist.some((c) => c.code === 'HISTORY')).toBe(true);
  });
  it('uses available history for a provisional result', () => {
    const i = exampleInput(450);
    i.monthlyUnits = i.monthlyUnits.slice(0, 3);
    const o = calculate(i, snapshot());
    expect(o.historyStatus).toBe('INSUFFICIENT');
    expect(o.scenarios.CONSUMPTION_CAP.capacityKw).toBe(3);
  });
  it('limits both scenarios by usable roof and load', () => {
    const i = exampleInput(1500);
    i.roofAreaSqM = 20;
    i.shadowFreePct = 50;
    const o = calculate(i, snapshot());
    expect(o.roofCapKw).toBe(1);
    expect(o.scenarios.LEGAL_MAX.capacityKw).toBe(1);
    expect(o.scenarios.CONSUMPTION_CAP.capacityKw).toBe(1);
    i.sanctionedLoadKw = 0.5;
    expect(calculate(i, snapshot()).scenarios.CONSUMPTION_CAP.capacityKw).toBe(0.5);
  });
  it('never uses planned load as approved capacity', () => {
    const i = exampleInput(1500);
    i.expectedAddedLoadKw = 10;
    const o = calculate(i, snapshot());
    expect(o.scenarios.LEGAL_MAX.capacityKw).toBe(5);
    expect(o.warnings.some((w) => w.includes('Planned'))).toBe(true);
  });
  it.each(['RENTED', 'COMMERCIAL'])('does not grant household subsidy for %s', (kind) => {
    const i = exampleInput();
    if (kind === 'RENTED') i.ownershipType = 'RENTED';
    else i.consumerCategory = 'COMMERCIAL';
    const o = calculate(i, snapshot());
    expect(o.eligibleApplicant).toBe(false);
    expect(o.scenarios.LEGAL_MAX.subsidyInr).toBe(0);
  });
  it('has no savings or payback when roof cannot generate', () => {
    const i = exampleInput();
    i.shadowFreePct = 0;
    const r = calculate(i, snapshot()).scenarios.CONSUMPTION_CAP;
    expect(r.capacityKw).toBe(0);
    expect(r.monthlySavingsInr).toBe(0);
    expect(r.paybackYears).toBeNull();
    expect(r.billAfterInr).toBe(r.billBeforeInr);
  });
  it('preserves fixed charges and models slabs independently', () => {
    expect(energyBill(100, snapshot().tariff)).toBe(730.8);
    expect(energyBill(150, snapshot().tariff)).toBe(1252.8);
    expect(energyBill(0, snapshot().tariff)).toBe(150.8);
  });
  it('treats a free quote as zero rather than ignoring it', () => {
    const i = exampleInput();
    i.vendorQuoteInr = 0;
    const r = calculate(i, snapshot()).scenarios.CONSUMPTION_CAP;
    expect(r.grossCostInr).toBe(0);
    expect(r.netCostInr).toBe(0);
  });
  it('includes degradation and replacement in net projection', () => {
    const r = calculate(exampleInput(), snapshot()).scenarios.CONSUMPTION_CAP;
    expect(r.projection).toHaveLength(26);
    expect(r.projection[0].netSavingsInr).toBe(-r.netCostInr);
    expect(r.projection[12].savingsInr - r.projection[11].savingsInr).toBeLessThan(
      r.projection[11].savingsInr - r.projection[10].savingsInr,
    );
    expect(r.savings25yrInr).toBe(r.projection[25].netSavingsInr);
  });
  it('replays the same snapshot without mutation', () => {
    const i = exampleInput(),
      s = snapshot(),
      copy = structuredClone(s);
    expect(calculate(i, s)).toEqual(calculate(i, s));
    expect(s).toEqual(copy);
  });
  it('switches the headline only when the enforced flag says stayed', () => {
    const s = snapshot();
    s.rule.enforcementStatus = 'STAYED';
    expect(calculate(exampleInput(), s).headlineScenario).toBe('LEGAL_MAX');
  });
  it('rejects negative input and duplicate bill months', () => {
    const i = exampleInput();
    i.monthlyUnits[0].unitsKwh = -1;
    expect(calculationInputSchema.safeParse(i).success).toBe(false);
    i.monthlyUnits[0] = { ...i.monthlyUnits[1] };
    expect(calculationInputSchema.safeParse(i).success).toBe(false);
  });
});
