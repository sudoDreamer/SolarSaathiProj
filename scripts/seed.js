import { loadConfig } from '../apps/api/src/config.js';
import { JsonRepository, MongoRepository } from '../apps/api/src/store.js';
import { seedAccounts } from './seed-accounts.js';
const config = await loadConfig();
const repo =
  config.DATA_DRIVER === 'mongo'
    ? await new MongoRepository().init(config.MONGODB_URI)
    : await new JsonRepository().init();
await seedAccounts(repo, config);
console.info(
  `SolarSaathi local data ready (${config.DATA_DRIVER}). Existing records preserved. Tariff/yield/capacity seeds require verification.`,
);
await repo.close();
