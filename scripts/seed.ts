import { loadConfig } from '../apps/api/src/config';
import { JsonRepository, MongoRepository } from '../apps/api/src/store';
import { seedAccounts } from './seed-accounts';
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
