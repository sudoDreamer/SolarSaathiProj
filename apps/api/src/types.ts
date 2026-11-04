import type {
  BillInput,
  CalculationInput,
  CalculationOutput,
  RuleSnapshot,
} from '../../../packages/schemas';
export type Role = 'USER' | 'ANALYST' | 'ADMIN';
export interface User {
  id: string;
  mobileE164: string;
  role: Role;
  displayName: string;
  consentVersion: string;
  consentAt: string;
  marketingOptIn: boolean;
  preferredLang: string;
  deletedAt?: string;
  lockedUntil?: number;
  failures: number[];
}
export interface Session {
  id: string;
  userId: string;
  familyId: string;
  refreshTokenHash: string;
  expiresAt: number;
  usedAt?: number;
  revokedAt?: number;
  deviceLabel: string;
  lastSeenAt: number;
}
export interface Challenge {
  id: string;
  mobileE164: string;
  purpose: 'LOGIN' | 'STEP_UP';
  codeHash: string;
  expiresAt: number;
  createdAt: number;
  attempts: number;
  consumedAt?: number;
}
export interface SavedCalculation {
  id: string;
  userId?: string;
  claimTokenHash: string;
  createdAt: number;
  inputSnapshot: CalculationInput;
  outputSnapshot: CalculationOutput;
  ruleSnapshot: RuleSnapshot;
}
export interface Household {
  id: string;
  userId: string;
  nickname: string;
  input: CalculationInput;
  calculationId: string;
  createdAt: number;
  solarStatus: 'NONE' | 'APPLIED' | 'SANCTIONED' | 'COMMISSIONED';
}
export interface Bill extends BillInput {
  id: string;
  householdId: string;
  userId: string;
  version: number;
}
export interface Application {
  id: string;
  householdId: string;
  userId: string;
  stage: number;
  nationalPortalAppNo: string;
  discomAppNo: string;
  sanctionedOn: string;
  steps: Record<string, string>;
  checklistProgress: string[];
  version: number;
}
export interface RuleVersion {
  id: string;
  snapshot: RuleSnapshot;
  status: 'ACTIVE' | 'SUPERSEDED' | 'PENDING_REVIEW' | 'REJECTED';
  draftBy: string;
  baseVersionId?: string;
  approvedBy?: string;
  createdAt: number;
  note: string;
  revision: number;
}
export interface Audit {
  id: string;
  actorUserId: string;
  action: string;
  docId: string;
  at: number;
  detail: string;
}
export interface Notification {
  id: string;
  userId: string;
  message: string;
  at: number;
  readAt?: number;
}
export interface State {
  users: User[];
  sessions: Session[];
  otpChallenges: Challenge[];
  calculations: SavedCalculation[];
  households: Household[];
  billEntries: Bill[];
  applications: Application[];
  ruleVersions: RuleVersion[];
  auditLogs: Audit[];
  notifications: Notification[];
}
export type Identity = { id: string; role: Role; sid: string; stepUpAt?: number };
declare global {
  namespace Express {
    interface Request {
      identity?: Identity;
    }
  }
}
