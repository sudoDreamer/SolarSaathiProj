import express from 'express';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadConfig } from './config.js';
import { JsonRepository, MongoRepository } from './store.js';
import { createApp } from './app.js';
import { runMaintenance } from './maintenance.js';
import { seedAccounts } from '../../../scripts/seed-accounts.js';
export async function startApi(config, built = false) {
  config ??= await loadConfig();
  const repo =
    config.DATA_DRIVER === 'mongo'
      ? await new MongoRepository().init(config.MONGODB_URI)
      : await new JsonRepository().init();
  await seedAccounts(repo, config);
  await runMaintenance(repo);
  const maintenance = setInterval(
    () =>
      void runMaintenance(repo).catch((error) =>
        console.error('Local maintenance:', error instanceof Error ? error.message : 'failed'),
      ),
    60000,
  );
  maintenance.unref();
  const { app, jobs } = createApp(repo, config);
  if (built) {
    app.use(express.static(resolve('dist')));
    app.get('*', (_req, res) => res.sendFile(resolve('dist/index.html')));
  }
  const server = app.listen(config.PORT, '127.0.0.1', () =>
    console.info(
      `SolarSaathi API: http://127.0.0.1:${config.PORT} · LOCAL MODE · ${config.DATA_DRIVER} data driver`,
    ),
  );
  let closing = false;
  async function shutdown() {
    if (closing) return;
    closing = true;
    clearInterval(maintenance);
    server.close();
    server.closeAllConnections();
    await jobs.drain();
    await repo.close();
  }
  return { shutdown };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const api = await startApi(undefined, process.argv.includes('--production-assets'));
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.on(signal, () => void api.shutdown().finally(() => process.exit(0)));
}
