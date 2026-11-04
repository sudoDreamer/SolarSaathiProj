import type { Repository } from './store';
export async function runMaintenance(repo: Repository, now = Date.now()) {
  await repo.update((s) => {
    const removed = new Set(
      s.users
        .filter((u) => u.deletedAt && Date.parse(u.deletedAt) + 30 * 86400000 <= now)
        .map((u) => u.id),
    );
    const mobiles = new Set(s.users.filter((u) => removed.has(u.id)).map((u) => u.mobileE164));
    s.users = s.users.filter((u) => !removed.has(u.id));
    s.sessions = s.sessions.filter((row) => !removed.has(row.userId) && row.expiresAt > now);
    s.otpChallenges = s.otpChallenges.filter(
      (row) => !mobiles.has(row.mobileE164) && row.createdAt + 86400000 > now,
    );
    s.households = s.households.filter((row) => !removed.has(row.userId));
    s.billEntries = s.billEntries.filter((row) => !removed.has(row.userId));
    s.applications = s.applications.filter((row) => !removed.has(row.userId));
    for (const application of s.applications) {
      application.steps ??= {};
      application.checklistProgress ??= [];
    }
    s.notifications = s.notifications.filter((row) => !removed.has(row.userId));
    s.calculations = s.calculations.filter((row) =>
      row.userId ? !removed.has(row.userId) : row.createdAt + 7 * 86400000 > now,
    );
    s.auditLogs = s.auditLogs.filter((row) => row.at + 90 * 86400000 > now);
  });
}
