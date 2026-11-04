import { z } from 'zod';

export const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
export const calculationInputSchema = z.object({
  discomCode: z.literal('MSEDCL').default('MSEDCL'),
  consumerCategory: z.enum(['LT_RESIDENTIAL', 'COMMERCIAL']).default('LT_RESIDENTIAL'),
  phaseType: z.enum(['SINGLE', 'THREE']).default('SINGLE'),
  sanctionedLoadKw: z.number().finite().positive().max(100),
  monthlyUnits: z
    .array(z.object({ billMonth: monthSchema, unitsKwh: z.number().finite().min(0).max(50000) }))
    .max(12)
    .refine(
      (v) => new Set(v.map((m) => m.billMonth)).size === v.length,
      'Each bill month must be unique',
    ),
  roofAreaSqM: z.number().finite().min(0).max(10000),
  shadowFreePct: z.number().finite().min(0).max(100),
  ownershipType: z.enum(['OWN', 'SHARED', 'RENTED']),
  districtCode: z.enum([
    'PUNE',
    'MUMBAI',
    'THANE',
    'NASHIK',
    'NAGPUR',
    'KOLHAPUR',
    'SAMBHAJINAGAR',
    'SOLAPUR',
  ]),
  expectedAddedLoadKw: z.number().finite().min(0).max(100).default(0),
  vendorQuoteInr: z.number().finite().min(0).max(10000000).optional(),
});
export type CalculationInput = z.infer<typeof calculationInputSchema>;
export const billSchema = z.object({
  billMonth: monthSchema,
  unitsKwh: z.number().finite().min(0).max(50000),
  amountInr: z.number().finite().min(0).max(1000000),
  fixedChargeInr: z.number().min(0).default(0),
  facInr: z.number().min(0).default(0),
  dutyInr: z.number().min(0).default(0),
  unitsImportedKwh: z.number().min(0).optional(),
  unitsExportedKwh: z.number().min(0).optional(),
  bankedUnitsKwh: z.number().min(0).optional(),
});
export type BillInput = z.infer<typeof billSchema>;
export const ruleSchema = z.object({
  id: z.string(),
  version: z.number().int().positive(),
  capFactor: z.number().positive().max(3),
  genUnitsPerKwMonth: z.number().positive().max(300),
  sqMPerKw: z.number().positive(),
  capacityTolerancePct: z.number().min(0).max(10),
  deemedApprovalMaxKw: z.number().positive().max(100),
  enforcementStatus: z.enum(['ENFORCED', 'STAYED', 'UNDER_REVIEW']),
  plainLanguageSummary: z.string().min(10),
  sourceUrl: z
    .string()
    .url()
    .regex(/^https?:\/\//),
  verifiedOn: z.string().nullable(),
  effectiveFrom: z.string().date(),
  verified: z.boolean(),
});
export type CapacityRule = z.infer<typeof ruleSchema>;
export interface Tariff {
  id: string;
  version: number;
  slabs: { upTo: number | null; rate: number }[];
  fixedChargeInr: number;
  wheelingRateInrPerKwh: number;
  facInrPerKwh: number;
  dutyPct: number;
  surplusRateInrPerKwh: number;
  sourceUrl: string;
  verified: boolean;
  verifiedOn: string | null;
}
export interface SubsidyScheme {
  id: string;
  version: number;
  tiers: { upToKw: number; inrPerKw: number }[];
  maxSubsidyInr: number;
  eligibleCategories: string[];
  sourceUrl: string;
  verifiedOn: string | null;
}
export interface RuleSnapshot {
  rule: CapacityRule;
  tariff: Tariff;
  subsidy: SubsidyScheme;
  yields: Record<string, number[]>;
  economics: {
    benchmarkPerKwInr: number;
    annualDegradationPct: number;
    inverterReplacementYear: number;
    inverterReplacementPerKwInr: number;
    co2KgPerKwh: number;
    co2SourceUrl: string;
    verified: boolean;
  };
}
export const tariffEditSchema = z.object({
  slabs: z
    .array(z.object({ upTo: z.number().positive().nullable(), rate: z.number().min(0).max(100) }))
    .min(1)
    .max(10)
    .refine(
      (slabs) =>
        slabs[slabs.length - 1].upTo === null &&
        slabs
          .slice(0, -1)
          .every((s, i) => s.upTo !== null && (i === 0 || s.upTo! > slabs[i - 1].upTo!)),
      'Use increasing slab bounds and a final unlimited slab',
    ),
  fixedChargeInr: z.number().min(0).max(10000),
  wheelingRateInrPerKwh: z.number().min(0).max(50),
  facInrPerKwh: z.number().min(0).max(50),
  dutyPct: z.number().min(0).max(100),
  surplusRateInrPerKwh: z.number().min(0).max(50),
  sourceUrl: z
    .string()
    .url()
    .regex(/^https?:\/\//),
  verified: z.boolean(),
  verifiedOn: z.string().nullable(),
});
export const subsidyEditSchema = z.object({
  tiers: z
    .array(
      z.object({ upToKw: z.number().positive().max(100), inrPerKw: z.number().min(0).max(100000) }),
    )
    .min(1)
    .max(10)
    .refine(
      (tiers) => tiers.every((t, i) => i === 0 || t.upToKw > tiers[i - 1].upToKw),
      'Tier limits must increase',
    ),
  maxSubsidyInr: z.number().min(0).max(10000000),
  eligibleCategories: z.array(z.enum(['LT_RESIDENTIAL', 'COMMERCIAL'])).min(1),
  sourceUrl: z
    .string()
    .url()
    .regex(/^https?:\/\//),
  verifiedOn: z.string().nullable(),
});
export type ScenarioKey = 'CONSUMPTION_CAP' | 'LEGAL_MAX';
export interface ChecklistEntry {
  code: string;
  title: string;
  severity: 'MUST_FIX' | 'CHECK';
  why: string;
  fix: string;
  sourceUrl: string;
}
export interface Scenario {
  key: ScenarioKey;
  capacityKw: number;
  subsidyInr: number;
  grossCostInr: number;
  netCostInr: number;
  billBeforeInr: number;
  billAfterInr: number;
  monthlySavingsInr: number;
  annualGenerationKwh: number;
  paybackYears: number | null;
  savings25yrInr: number;
  co2AvoidedKgPerYear: number;
  monthly: {
    month: string;
    consumptionKwh: number;
    generationKwh: number;
    billBeforeInr: number;
    billAfterInr: number;
  }[];
  projection: { year: number; savingsInr: number; netSavingsInr: number }[];
}
export interface CalculationOutput {
  engineVersion: string;
  historyStatus: 'COMPLETE' | 'INSUFFICIENT';
  eligibleApplicant: boolean;
  averageMonthlyUnits: number;
  consumptionCapKw: number;
  roofCapKw: number;
  headlineScenario: ScenarioKey;
  scenarios: Record<ScenarioKey, Scenario>;
  warnings: string[];
  checklist: ChecklistEntry[];
  versions: { ruleVersionId: string; tariffVersionId: string; subsidySchemeId: string };
}
