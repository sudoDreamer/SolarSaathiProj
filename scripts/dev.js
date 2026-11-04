import { access, copyFile } from 'node:fs/promises';
import net from 'node:net';
import { loadConfig } from '../apps/api/src/config.js';
import { ensureProjectMongo } from './local-mongo.js';
import { startApi } from '../apps/api/src/index.js';

// One process owns startup and shutdown; data and generated secrets stay on disk.
let database, api, web;
let closing = false;
async function shutdown(code = 0) {
  if (closing) return;
  closing = true;
  await web?.close();
  await api?.shutdown();
  await database?.stop();
  process.exit(code);
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => void shutdown());

async function assertPortFree(port) {
  await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', () =>
      reject(
        new Error(`Port ${port} is already in use. Stop the other app with Ctrl+C, then retry.`),
      ),
    );
    probe.listen(port, '127.0.0.1', () => probe.close(resolve));
  });
}

try {
  if (
    !(await access('.env.development').then(
      () => true,
      () => false,
    ))
  ) {
    await copyFile('.env.example', '.env.development');
    console.info('Created .env.development from the local MongoDB defaults.');
  }
  // loadConfig was imported before the first-run copy; re-read the new file.
  const { config: dotenv } = await import('dotenv');
  dotenv({ path: '.env.development' });
  const config = await loadConfig();
  const built = process.argv.includes('--built');
  await assertPortFree(config.PORT);
  if (!built) await assertPortFree(5173);
  if (built)
    await access('dist/index.html').catch(() => {
      throw new Error('Run npm.cmd run build before npm.cmd start.');
    });
  const target = new URL(config.MONGODB_URI);
  if (
    config.DATA_DRIVER === 'mongo' &&
    ['127.0.0.1', 'localhost'].includes(target.hostname) &&
    target.port === '27018'
  ) {
    database = await ensureProjectMongo();
  }
  api = await startApi(config, built);
  if (!built) {
    const { createServer } = await import('vite');
    web = await createServer();
    await web.listen();
  }
  console.info(`\nSolarSaathi ready: http://127.0.0.1:${built ? config.PORT : 5173}`);
  console.info('MongoDB + Express + React + Node.js · JavaScript');
  console.info('Keep this window open. Ctrl+C stops services started here; saved data remains.');
  if (!built)
    console.info('React changes reload automatically. Restart this command after backend changes.');
} catch (error) {
  console.error(
    'Startup failed:',
    error.message.replace(/mongodb(?:\+srv)?:\/\/\S+/g, '[database connection]'),
  );
  await shutdown(1);
}
