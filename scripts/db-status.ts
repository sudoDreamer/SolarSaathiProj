import { mongo } from 'mongoose';
import { config } from 'dotenv';
config({ path: '.env.development' });
const uri =
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/SOLARSAATHIDB?directConnection=true';
const client = new mongo.MongoClient(uri, { serverSelectionTimeoutMS: 4000 });
try {
  await client.connect();
  const hello = await client.db().admin().command({ hello: 1 });
  console.info(
    JSON.stringify(
      {
        reachable: true,
        replicaSet: hello.setName ?? null,
        database: client.db().databaseName,
        collections: (await client.db().listCollections().toArray()).map((c) => c.name),
      },
      null,
      2,
    ),
  );
  if (process.argv.includes('--api')) {
    const response = await fetch(
      `http://127.0.0.1:${Number(process.env.PORT || 4000)}/api/v1/health`,
    );
    if (!response.ok) throw new Error('The app health check failed.');
    const health = (await response.json()) as { ok: boolean; dataDriver: string };
    console.info('Running API:', JSON.stringify(health));
    if (!health.ok || health.dataDriver !== 'mongo')
      throw new Error('The running API is not using MongoDB.');
  }
} catch (error) {
  console.error(
    'MongoDB connection is not ready:',
    error instanceof Error
      ? error.message.replace(/mongodb(?:\+srv)?:\/\/\S+/g, '[connection]')
      : 'Connection failed',
  );
  process.exitCode = 1;
} finally {
  await client.close();
}
