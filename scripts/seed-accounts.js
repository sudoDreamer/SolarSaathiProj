import { randomUUID } from 'node:crypto';
export async function seedAccounts(repo, config) {
  await repo.update((s) => {
    for (const account of [
      { mobile: config.SEED_ADMIN_MOBILE_E164, role: 'ADMIN', name: 'Local admin' },
      { mobile: config.SEED_ANALYST_MOBILE_E164, role: 'ANALYST', name: 'Local analyst' },
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
