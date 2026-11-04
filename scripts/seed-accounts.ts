import { randomUUID } from 'node:crypto';
import type { Repository } from '../apps/api/src/store';
import type { Config } from '../apps/api/src/config';
export async function seedAccounts(repo: Repository, config: Config) {
  await repo.update((s) => {
    for (const account of [
      { mobile: config.SEED_ADMIN_MOBILE_E164, role: 'ADMIN' as const, name: 'Local admin' },
      { mobile: config.SEED_ANALYST_MOBILE_E164, role: 'ANALYST' as const, name: 'Local analyst' },
    ]) {
      if (!s.users.some((u) => u.mobileE164 === account.mobile))
        s.users.push({
          id: randomUUID(),
          mobileE164: account.mobile,
          role: account.role,
          displayName: account.name,
          consentVersion: '',
          consentAt: '',
          marketingOptIn: false,
          preferredLang: 'en',
          failures: [],
        });
    }
  });
}
