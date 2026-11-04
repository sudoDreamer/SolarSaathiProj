import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../apps/api/src/app.js';
import { JsonRepository } from '../apps/api/src/store.js';
import { seedAccounts } from '../scripts/seed-accounts.js';
import { hashOtp } from '../apps/api/src/drivers.js';
const exampleInput = (units = 300) => ({
  discomCode: 'MSEDCL',
  consumerCategory: 'LT_RESIDENTIAL',
  phaseType: 'SINGLE',
  sanctionedLoadKw: 5,
  monthlyUnits: Array.from({ length: 12 }, (_, i) => ({
    billMonth: `2025-${String(i + 1).padStart(2, '0')}`,
    unitsKwh: units,
  })),
  roofAreaSqM: 100,
  shadowFreePct: 100,
  ownershipType: 'OWN',
  districtCode: 'PUNE',
  expectedAddedLoadKw: 0,
});
const config = {
  LOCAL_MODE: 'true',
  DATA_DRIVER: 'json',
  PORT: 4000,
  WEB_ORIGIN: 'http://127.0.0.1:5173',
  MONGODB_URI: '',
  OTP_MODE: 'console',
  JWT_ACCESS_SECRET: 'test-only-access-secret-at-least-32-characters',
  OTP_PEPPER: 'test-only-otp-pepper-at-least-32-characters',
  FIELD_ENCRYPTION_KEY: 'a'.repeat(64),
  SEED_ADMIN_MOBILE_E164: '+919999999991',
  SEED_ANALYST_MOBILE_E164: '+919999999992',
};
let repo, server;
const headers = { 'X-SS-Client': 'web', 'Content-Type': 'application/json' };
async function login(mobile = '8888888881') {
  const challenge = await request(server.app)
    .post('/api/v1/auth/otp/request')
    .set(headers)
    .send({ mobile });
  expect(challenge.status).toBe(200);
  const result = await request(server.app)
    .post('/api/v1/auth/otp/verify')
    .set(headers)
    .send({ challengeId: challenge.body.challengeId, code: challenge.body.devCode, consent: true });
  expect(result.status).toBe(200);
  return {
    token: result.body.accessToken,
    cookie: String(result.headers['set-cookie'][0]).split(';')[0],
    user: result.body.user,
  };
}
beforeEach(async () => {
  repo = await new JsonRepository(null).init();
  await seedAccounts(repo, config);
  server = createApp(repo, config, { send: async () => undefined });
});
describe('local API ownership, authentication and immutable versions', () => {
  it('calculates anonymously without storing the claim token in plaintext', async () => {
    const r = await request(server.app).post('/api/v1/calculate').send(exampleInput());
    expect(r.status).toBe(201);
    expect(r.body.outputSnapshot.scenarios.CONSUMPTION_CAP.subsidyInr).toBe(60000);
    expect(r.body.claimTokenHash).toBeUndefined();
    const stored = (await repo.read()).calculations[0];
    expect(stored.claimTokenHash).not.toBe(r.body.claimToken);
  });
  it('consumes each OTP only once, with only its HMAC persisted', async () => {
    const r = await request(server.app)
      .post('/api/v1/auth/otp/request')
      .set(headers)
      .send({ mobile: '8888888881' });
    const c = (await repo.read()).otpChallenges[0];
    expect(c.codeHash).toBe(hashOtp(r.body.devCode, c.id, config.OTP_PEPPER));
    const body = { challengeId: c.id, code: r.body.devCode, consent: true };
    expect(
      (await request(server.app).post('/api/v1/auth/otp/verify').set(headers).send(body)).status,
    ).toBe(200);
    expect(
      (await request(server.app).post('/api/v1/auth/otp/verify').set(headers).send(body)).body
        .error,
    ).toBe('OTP_EXPIRED');
  });
  it('persists failed attempts and locks the fifth bad code', async () => {
    const r = await request(server.app)
      .post('/api/v1/auth/otp/request')
      .set(headers)
      .send({ mobile: '8888888881' });
    const wrong = r.body.devCode === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) {
      const v = await request(server.app)
        .post('/api/v1/auth/otp/verify')
        .set(headers)
        .send({ challengeId: r.body.challengeId, code: wrong });
      expect(v.body.error).toBe(i === 4 ? 'OTP_LOCKED' : 'OTP_INVALID');
    }
    expect((await repo.read()).otpChallenges[0].attempts).toBe(5);
    const v = await request(server.app)
      .post('/api/v1/auth/otp/verify')
      .set(headers)
      .send({ challengeId: r.body.challengeId, code: r.body.devCode, consent: true });
    expect(v.body.error).toBe('OTP_LOCKED');
  });
  it('expires codes and enforces resend cooldown', async () => {
    const r = await request(server.app)
      .post('/api/v1/auth/otp/request')
      .set(headers)
      .send({ mobile: '8888888881' });
    expect(
      (
        await request(server.app)
          .post('/api/v1/auth/otp/request')
          .set(headers)
          .send({ mobile: '8888888881' })
      ).status,
    ).toBe(429);
    await repo.update((s) => {
      s.otpChallenges[0].expiresAt = Date.now() - 1;
    });
    expect(
      (
        await request(server.app)
          .post('/api/v1/auth/otp/verify')
          .set(headers)
          .send({ challengeId: r.body.challengeId, code: r.body.devCode, consent: true })
      ).body.error,
    ).toBe('OTP_EXPIRED');
  });
  it('rotates refresh cookies and revokes a reused family', async () => {
    const u = await login();
    const r = await request(server.app)
      .post('/api/v1/auth/refresh')
      .set(headers)
      .set('Cookie', u.cookie)
      .send({});
    expect(r.status).toBe(200);
    expect(r.headers['set-cookie'][0]).not.toContain(u.cookie);
    const reused = await request(server.app)
      .post('/api/v1/auth/refresh')
      .set(headers)
      .set('Cookie', u.cookie)
      .send({});
    expect(reused.status).toBe(401);
    const me = await request(server.app)
      .get('/api/v1/me')
      .auth(r.body.accessToken, { type: 'bearer' });
    expect(me.status).toBe(401);
  });
  it('rejects unsafe refresh requests and foreign origins', async () => {
    expect((await request(server.app).post('/api/v1/auth/refresh').send({})).status).toBe(403);
    expect(
      (
        await request(server.app)
          .post('/api/v1/auth/otp/request')
          .set(headers)
          .set('Origin', 'https://example.com')
          .send({ mobile: '8888888881' })
      ).status,
    ).toBe(403);
  });
  it('claims an anonymous result once and enforces household ownership', async () => {
    const a = await login(),
      b = await login('8888888882');
    const c = await request(server.app).post('/api/v1/calculate').send(exampleInput());
    const body = { claimToken: c.body.claimToken };
    expect(
      (
        await request(server.app)
          .post(`/api/v1/calculations/${c.body.id}/claim`)
          .auth(a.token, { type: 'bearer' })
          .send(body)
      ).status,
    ).toBe(200);
    expect(
      (
        await request(server.app)
          .post(`/api/v1/calculations/${c.body.id}/claim`)
          .auth(b.token, { type: 'bearer' })
          .send(body)
      ).status,
    ).toBe(403);
    const h = await request(server.app)
      .post('/api/v1/households')
      .auth(a.token, { type: 'bearer' })
      .send({ nickname: 'Test home', calculationId: c.body.id });
    expect(h.status).toBe(201);
    expect(
      (
        await request(server.app)
          .get(`/api/v1/households/${h.body.id}/bills`)
          .auth(b.token, { type: 'bearer' })
      ).status,
    ).toBe(404);
    expect(
      (
        await request(server.app)
          .get(`/api/v1/calculations/${c.body.id}`)
          .auth(b.token, { type: 'bearer' })
      ).status,
    ).toBe(404);
  });
  it('prevents duplicate monthly bills and stale overwrites', async () => {
    const u = await login();
    const c = await request(server.app)
      .post('/api/v1/calculate')
      .auth(u.token, { type: 'bearer' })
      .send(exampleInput());
    const h = await request(server.app)
      .post('/api/v1/households')
      .auth(u.token, { type: 'bearer' })
      .send({ nickname: 'Test home', calculationId: c.body.id });
    const path = `/api/v1/households/${h.body.id}/bills`,
      body = { billMonth: '2026-10', unitsKwh: 300, amountInr: 2500 };
    expect(
      (await request(server.app).post(path).auth(u.token, { type: 'bearer' }).send(body)).status,
    ).toBe(201);
    expect(
      (await request(server.app).post(path).auth(u.token, { type: 'bearer' }).send(body)).status,
    ).toBe(409);
    expect(
      (
        await request(server.app)
          .patch(path + '/2026-10')
          .auth(u.token, { type: 'bearer' })
          .set('If-Match', '1')
          .send({ ...body, amountInr: 2300 })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(server.app)
          .patch(path + '/2026-10')
          .auth(u.token, { type: 'bearer' })
          .set('If-Match', '1')
          .send(body)
      ).status,
    ).toBe(409);
  });
  it('requires another admin and step-up, and preserves old snapshots after publish', async () => {
    const analyst = await login('9999999992'),
      admin = await login('9999999991'),
      user = await login();
    const c = await request(server.app)
      .post('/api/v1/calculate')
      .auth(user.token, { type: 'bearer' })
      .send(exampleInput());
    const initial = (await repo.read()).ruleVersions[0];
    const body = {
      rule: { ...initial.snapshot.rule, capFactor: 1.25 },
      baseVersionId: initial.id,
      note: 'Test source update to verify versioned estimates.',
    };
    const d = await request(server.app)
      .post('/api/v1/admin/versions')
      .auth(analyst.token, { type: 'bearer' })
      .send(body);
    expect(d.status).toBe(201);
    expect(
      (
        await request(server.app)
          .post(`/api/v1/admin/versions/${d.body.id}/approve`)
          .auth(admin.token, { type: 'bearer' })
          .send({ revision: 1 })
      ).body.error,
    ).toBe('STEP_UP_REQUIRED');
    await repo.update((s) => {
      s.otpChallenges.forEach((c) => {
        c.createdAt -= 31000;
      });
    });
    const ch = await request(server.app)
      .post('/api/v1/auth/otp/request')
      .auth(admin.token, { type: 'bearer' })
      .set(headers)
      .send({ mobile: '9999999991', purpose: 'STEP_UP' });
    const step = await request(server.app)
      .post('/api/v1/auth/step-up')
      .auth(admin.token, { type: 'bearer' })
      .set(headers)
      .send({ challengeId: ch.body.challengeId, code: ch.body.devCode });
    expect(step.status).toBe(200);
    const published = await request(server.app)
      .post(`/api/v1/admin/versions/${d.body.id}/approve`)
      .auth(step.body.accessToken, { type: 'bearer' })
      .send({ revision: 1 });
    expect(published.status).toBe(200);
    expect((await repo.read()).ruleVersions.filter((v) => v.status === 'ACTIVE')).toHaveLength(1);
    const after = await request(server.app).post('/api/v1/calculate').send(exampleInput());
    expect(after.body.outputSnapshot.scenarios.CONSUMPTION_CAP.capacityKw).toBe(2.5);
    const old = await request(server.app)
      .get(`/api/v1/calculations/${c.body.id}`)
      .auth(user.token, { type: 'bearer' });
    expect(old.body.outputSnapshot.scenarios.CONSUMPTION_CAP.capacityKw).toBe(2);
    await server.jobs.drain();
  });
  it('revokes active access when logging out everywhere', async () => {
    const u = await login();
    expect(
      (
        await request(server.app)
          .post('/api/v1/auth/logout-all')
          .auth(u.token, { type: 'bearer' })
          .set(headers)
          .send({})
      ).status,
    ).toBe(200);
    expect(
      (await request(server.app).get('/api/v1/me').auth(u.token, { type: 'bearer' })).status,
    ).toBe(401);
  });
});
