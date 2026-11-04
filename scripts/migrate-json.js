import { JsonRepository, MongoRepository } from '../apps/api/src/store.js';
import { loadConfig } from '../apps/api/src/config.js';
const config = await loadConfig();
if (config.DATA_DRIVER !== 'mongo')
  throw new Error('Set DATA_DRIVER=mongo before importing local JSON data.');
const sourceRepo = await new JsonRepository().init();
const destination = await new MongoRepository().init(config.MONGODB_URI);
try {
  const source = await sourceRepo.read();
  const keys = Object.keys(source);
  const result = await destination.update((target) => {
    const populated = keys.some((key) =>
      key === 'ruleVersions'
        ? target[key].some((row) => row.id !== 'snapshot-v1')
        : target[key].length > 0,
    );
    if (populated) {
      const alreadyPresent = keys.every((key) =>
        source[key].every((row) => target[key].some((other) => other.id === row.id)),
      );
      if (alreadyPresent) return 'Already imported; MongoDB records were preserved.';
      throw new Error(
        'The target database already has app records. No data was overwritten. Import requires a deliberate merge.',
      );
    }
    // The destination is empty apart from its known starter snapshot. Copy the
    // complete state in one transaction so sessions and ownership retain IDs.
    for (const key of keys) Object.assign(target, { [key]: structuredClone(source[key]) });
    return 'Imported the local development data in one MongoDB transaction.';
  });
  console.info(result);
  console.info(
    JSON.stringify(Object.fromEntries(keys.map((key) => [key, source[key].length])), null, 2),
  );
  console.info('The original .local/data.json was retained unchanged.');
} finally {
  await sourceRepo.close();
  await destination.close();
}
