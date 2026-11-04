import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import mongoose, { Schema } from 'mongoose';
import seed from '../../../scripts/data/rules.seed.json' with { type: 'json' };
export const emptyState = () => ({
  users: [],
  sessions: [],
  otpChallenges: [],
  calculations: [],
  households: [],
  billEntries: [],
  applications: [],
  ruleVersions: [
    {
      id: 'snapshot-v1',
      snapshot: structuredClone(seed),
      status: 'ACTIVE',
      draftBy: 'seed',
      createdAt: Date.parse('2026-11-04T00:00:00+05:30'),
      note: 'Local starter data. Capacity, tariffs and yields require verification.',
      revision: 1,
    },
  ],
  auditLogs: [],
  notifications: [],
});
export class JsonRepository {
  file;
  state = emptyState();
  queue = Promise.resolve();
  constructor(file = '.local/data.json') {
    this.file = file;
  }
  async init() {
    if (this.file) {
      await mkdir(dirname(this.file), { recursive: true });
      try {
        this.state = JSON.parse(await readFile(this.file, 'utf8'));
      } catch (e) {
        if (e.code !== 'ENOENT') throw e;
      }
    }
    return this;
  }
  async read() {
    await this.queue;
    return structuredClone(this.state);
  }
  update(fn) {
    const work = this.queue.then(async () => {
      const next = structuredClone(this.state);
      const result = fn(next);
      if (this.file) {
        await writeFile(this.file + '.tmp', JSON.stringify(next, null, 2));
        await rename(this.file + '.tmp', this.file);
      }
      this.state = next;
      return structuredClone(result);
    });
    this.queue = work.catch(() => undefined);
    return work;
  }
  async close() {
    await this.queue;
  }
}
// The Mongo adapter stores one validated domain record per document, across the
// named collections. Transactions serialize writes through a revision document;
// replace-on-diff avoids overwriting unrelated documents with stale snapshots.
export class MongoRepository {
  models = new Map();
  revision = mongoose.model(
    'StoreRevision',
    new Schema({ _id: String, value: Number }),
    'storeRevision',
  );
  async init(uri) {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    if (!hello.setName)
      throw new Error(
        'MongoDB must run as a replica set. Run docker compose up -d, then wait for its health check.',
      );
    for (const key of Object.keys(emptyState())) {
      const schema = new Schema(
        {
          _id: { type: String, required: true },
          payload: { type: Schema.Types.Mixed, required: true },
        },
        // The transaction's global revision document serializes changes.
        // Mongoose's save()-only optimistic concurrency is not used by replaceOne.
        // Empty maps such as application steps are part of the API contract.
        { versionKey: false, minimize: false },
      );
      if (key === 'users') schema.index({ 'payload.mobileE164': 1 }, { unique: true });
      if (key === 'billEntries')
        schema.index({ 'payload.householdId': 1, 'payload.billMonth': 1 }, { unique: true });
      if (key === 'households') schema.index({ 'payload.userId': 1 });
      this.models.set(key, mongoose.model(key, schema, key));
    }
    await Promise.all([...this.models.values()].map((m) => m.init()));
    await this.revision.updateOne(
      { _id: 'global' },
      { $setOnInsert: { value: 0 } },
      { upsert: true },
    );
    if (!(await this.models.get('ruleVersions').countDocuments())) {
      await this.models
        .get('ruleVersions')
        .insertMany(emptyState().ruleVersions.map((row) => ({ _id: row.id, payload: row })));
    }
    return this;
  }
  async load(session) {
    const state = {};
    for (const [key, model] of this.models) {
      const rows = await model
        .find()
        .session(session ?? null)
        .lean();
      Object.assign(state, { [key]: rows.map((row) => row.payload) });
    }
    return state;
  }
  async read() {
    const session = await mongoose.startSession();
    try {
      let state;
      await session.withTransaction(
        async () => {
          state = await this.load(session);
        },
        { readConcern: { level: 'snapshot' } },
      );
      return state;
    } finally {
      await session.endSession();
    }
  }
  async update(fn) {
    const session = await mongoose.startSession();
    let result;
    try {
      await session.withTransaction(async () => {
        await this.revision.updateOne({ _id: 'global' }, { $inc: { value: 1 } }, { session });
        const previous = await this.load(session),
          next = structuredClone(previous);
        result = fn(next);
        for (const [key, model] of this.models) {
          const before = new Map(previous[key].map((row) => [row.id, JSON.stringify(row)]));
          for (const row of next[key]) {
            if (before.get(row.id) !== JSON.stringify(row))
              await model.replaceOne(
                { _id: row.id },
                { _id: row.id, payload: row },
                { upsert: true, session },
              );
            before.delete(row.id);
          }
          if (before.size)
            await model.deleteMany({ _id: { $in: [...before.keys()] } }, { session });
        }
      });
      return result;
    } finally {
      await session.endSession();
    }
  }
  async close() {
    await mongoose.disconnect();
  }
}
