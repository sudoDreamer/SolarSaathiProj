import { expect, it } from 'vitest';
import { JsonRepository } from '../apps/api/src/store.js';
import { runMaintenance } from '../apps/api/src/maintenance.js';
it('purges deleted accounts after the grace period without removing active users', async () => {
  const repo = await new JsonRepository(null).init(),
    now = Date.now();
  await repo.update((s) => {
    for (const [id, age] of [
      ['expired', 31],
      ['recent', 1],
    ])
      s.users.push({
        id,
        mobileE164: '+918888888881',
        role: 'USER',
        displayName: id,
        consentVersion: 'test',
        consentAt: '',
        preferredLang: 'en',
        marketingOptIn: false,
        failures: [],
        deletedAt: new Date(now - age * 86400000).toISOString(),
      });
    s.notifications.push({ id: 'n', userId: 'expired', message: 'old', at: now });
  });
  await runMaintenance(repo, now);
  const state = await repo.read();
  expect(state.users.map((u) => u.id)).toEqual(['recent']);
  expect(state.notifications).toHaveLength(0);
});
