import { spawn, type ChildProcess } from 'node:child_process';
import { access, mkdir, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { mongo } from 'mongoose';

const port = 27018;
const replicaSet = 'solarsaathi-rs';
const dataPath = resolve('.local/mongodb');
const uri = `mongodb://127.0.0.1:${port}/SOLARSAATHIDB?directConnection=true&replicaSet=${replicaSet}`;
const wait = (ms: number) => new Promise<void>((done) => setTimeout(done, ms));
let owned: ChildProcess | undefined;
let stopping = false;

async function findBinary() {
  if (process.env.MONGOD_BINARY) return process.env.MONGOD_BINARY;
  const directory = join(process.env.ProgramFiles || 'C:/Program Files', 'MongoDB/Server');
  const versions = (await readdir(directory)).sort((a, b) =>
    b.localeCompare(a, undefined, { numeric: true }),
  );
  for (const version of versions) {
    const binary = join(directory, version, 'bin/mongod.exe');
    if (
      await access(binary).then(
        () => true,
        () => false,
      )
    )
      return binary;
  }
  throw new Error('mongod was not found. Set MONGOD_BINARY to your installed mongod executable.');
}
async function connect() {
  const client = new mongo.MongoClient(uri, {
    serverSelectionTimeoutMS: 1000,
    directConnection: true,
  });
  try {
    await client.connect();
    return client;
  } catch (error) {
    await client.close();
    throw error;
  }
}
async function stop() {
  if (stopping) return;
  stopping = true;
  if (owned && owned.exitCode === null) {
    // Only shut down the process this invocation started, on the project port.
    const client = new mongo.MongoClient(uri, { serverSelectionTimeoutMS: 1000 });
    try {
      await client.connect();
      await client.db().admin().command({ shutdown: 1 });
    } catch {
      /* A successful shutdown closes the command connection. */
    } finally {
      await client.close();
    }
  }
}
process.on('SIGINT', () => void stop().finally(() => process.exit(0)));
process.on('SIGTERM', () => void stop().finally(() => process.exit(0)));

await mkdir(dataPath, { recursive: true });
let client: mongo.MongoClient | undefined;
try {
  client = await connect();
} catch {
  /* Start only the dedicated project instance. */
}
if (!client) {
  const binary = await findBinary();
  owned = spawn(
    binary,
    [
      '--dbpath',
      dataPath,
      '--port',
      String(port),
      '--bind_ip',
      '127.0.0.1',
      '--replSet',
      replicaSet,
      '--oplogSize',
      '128',
      '--wiredTigerCacheSizeGB',
      '0.25',
      '--logpath',
      resolve('.local/mongod.log'),
      '--logappend',
    ],
    { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] },
  );
  let spawnError: Error | undefined;
  owned.on('error', (error) => {
    spawnError = error;
  });
  owned.stderr?.on('data', (data) => process.stderr.write(data));
  const deadline = Date.now() + 30000;
  while (!client && Date.now() < deadline) {
    if (spawnError) throw spawnError;
    if (owned.exitCode !== null)
      throw new Error(`mongod exited (${owned.exitCode}). See .local/mongod.log.`);
    try {
      client = await connect();
    } catch {
      await wait(400);
    }
  }
  if (!client) throw new Error('Project MongoDB startup timed out. See .local/mongod.log.');
}
try {
  const options = await client.db().admin().command({ getCmdLineOpts: 1 });
  const actualPath = String(options.parsed?.storage?.dbPath || '');
  if (resolve(actualPath).toLowerCase() !== dataPath.toLowerCase())
    throw new Error('Port 27018 belongs to another MongoDB data directory. It was not modified.');
  let hello = await client.db().admin().command({ hello: 1 });
  if (!hello.setName) {
    await client
      .db()
      .admin()
      .command({
        replSetInitiate: { _id: replicaSet, members: [{ _id: 0, host: `127.0.0.1:${port}` }] },
      });
  } else if (hello.setName !== replicaSet)
    throw new Error('Port 27018 uses another replica set. It was not modified.');
  const deadline = Date.now() + 30000;
  while (!hello.isWritablePrimary && Date.now() < deadline) {
    await wait(400);
    hello = await client.db().admin().command({ hello: 1 });
  }
  if (!hello.isWritablePrimary) throw new Error('Project replica set did not elect a primary.');
  console.info(`SolarSaathi MongoDB ready: ${uri}`);
  console.info(`Data directory: ${dataPath}`);
  console.info(
    owned
      ? 'Keep this PowerShell session running. Ctrl+C shuts down this project instance.'
      : 'The existing project instance is ready; its owning session manages shutdown.',
  );
} catch (error) {
  await stop();
  throw error;
} finally {
  await client.close();
}
