import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { randomBytes, randomUUID } from 'node:crypto';
import { z, ZodError } from 'zod';
import { EventEmitter } from 'node:events';
import { calculate } from '../../../packages/engine/index.js';
import {
  billSchema,
  calculationInputSchema,
  ruleSchema,
  tariffEditSchema,
  subsidyEditSchema,
} from '../../../packages/schemas/index.js';
import {
  ConsoleOtpSender,
  MemoryJobQueue,
  hash,
  hashOtp,
  newOtp,
  safeEqualHex,
} from './drivers.js';
class AppError extends Error {
  code;
  status;
  constructor(code, status = 400, message = code) {
    super(message);
    this.code = code;
    this.status = status;
  }
}
const id = () => randomUUID();
const publicUser = (user) => ({
  id: user.id,
  displayName: user.displayName,
  role: user.role,
  mobileMasked: `+91 •••••• ${user.mobileE164.slice(-4)}`,
  preferredLang: user.preferredLang,
});
const active = (s) => s.ruleVersions.find((v) => v.status === 'ACTIVE');
const wrap = (fn) => (req, res, next) => {
  void fn(req, res).catch(next);
};
const mobileSchema = z
  .string()
  .transform((s) => s.replace(/[\s()-]/g, ''))
  .transform((s) => (s.length === 10 ? '+91' + s : s))
  .pipe(z.string().regex(/^\+91[6-9]\d{9}$/, 'Enter a valid Indian mobile number'));
const secureClient = (req, _res, next) => {
  if (req.headers['x-ss-client'] !== 'web' || !req.is('application/json'))
    return next(new AppError('CLIENT_HEADER_REQUIRED', 403));
  next();
};
export function createApp(repo, config, sender = new ConsoleOtpSender()) {
  const app = express(),
    stream = new EventEmitter(),
    jobs = new MemoryJobQueue();
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(express.json({ limit: '100kb' }), cookieParser());
  app.use((req, _res, next) => {
    if (
      req.headers.origin &&
      req.headers.origin !== config.WEB_ORIGIN &&
      req.headers.origin !== `http://127.0.0.1:${config.PORT}`
    )
      return next(new AppError('ORIGIN_NOT_ALLOWED', 403));
    next();
  });
  // Optional bearer parsing must explicitly continue after its async work.
  app.use((req, res, next) => {
    if (!req.headers.authorization) return next();
    Promise.resolve(
      (async () => {
        const token = req.headers.authorization.replace(/^Bearer /, '');
        let identity;
        try {
          identity = jwt.verify(token, config.JWT_ACCESS_SECRET, {
            algorithms: ['HS256'],
          });
        } catch (e) {
          throw new AppError(
            e instanceof jwt.TokenExpiredError ? 'TOKEN_EXPIRED' : 'AUTH_REQUIRED',
            401,
          );
        }
        const state = await repo.read(),
          user = state.users.find((u) => u.id === identity.id && !u.deletedAt);
        if (
          !user ||
          !state.sessions.some(
            (s) =>
              s.id === identity.sid &&
              s.userId === user.id &&
              !s.revokedAt &&
              s.expiresAt > Date.now(),
          )
        )
          throw new AppError('SESSION_REVOKED', 401);
        req.identity = { ...identity, role: user.role };
      })(),
    ).then(() => next(), next);
  });
  const requireAuth = (req, _res, next) =>
    req.identity ? next() : next(new AppError('AUTH_REQUIRED', 401));
  const staff = (req, _res, next) =>
    req.identity && ['ADMIN', 'ANALYST'].includes(req.identity.role)
      ? next()
      : next(new AppError('FORBIDDEN', 403));
  const stepUp = (req, _res, next) =>
    req.identity?.stepUpAt && Date.now() - req.identity.stepUpAt < 600000
      ? next()
      : next(new AppError('STEP_UP_REQUIRED', 401));
  const audit = (s, actor, action, docId, detail = '') =>
    s.auditLogs.unshift({ id: id(), actorUserId: actor, action, docId, detail, at: Date.now() });
  const household = (s, req) => {
    const h = s.households.find(
      (h) => h.id === req.params.householdId && h.userId === req.identity.id,
    );
    if (!h) throw new AppError('NOT_FOUND', 404);
    return h;
  };
  function tokenFor(user, session, stepUpAt) {
    return jwt.sign(
      {
        id: user.id,
        sub: user.id,
        role: user.role,
        sid: session.id,
        ...(stepUpAt ? { stepUpAt } : {}),
      },
      config.JWT_ACCESS_SECRET,
      { algorithm: 'HS256', expiresIn: '15m' },
    );
  }
  function issueSession(s, user, req, familyId = id()) {
    const refresh = randomBytes(48).toString('base64url');
    const session = {
      id: id(),
      userId: user.id,
      familyId,
      refreshTokenHash: hash(refresh),
      expiresAt: Date.now() + 30 * 86400000,
      deviceLabel: req.headers['user-agent']?.slice(0, 100) || 'Local browser',
      lastSeenAt: Date.now(),
    };
    s.sessions.push(session);
    return { session, refresh };
  }
  const cookie = (res, refresh) =>
    res.cookie('ss_refresh', refresh, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/api/v1/auth',
      maxAge: 30 * 86400000,
    });
  app.get('/api/v1/health', (_req, res) =>
    res.json({ ok: true, localMode: true, dataDriver: config.DATA_DRIVER }),
  );
  app.get(
    '/api/v1/rules/active',
    wrap(async (_req, res) => res.json(active(await repo.read()).snapshot)),
  );
  app.get(
    '/api/v1/rules/history',
    wrap(async (_req, res) =>
      res.json(
        (await repo.read()).ruleVersions
          .filter((v) => ['ACTIVE', 'SUPERSEDED'].includes(v.status))
          .map((v) => ({
            id: v.id,
            status: v.status,
            note: v.note,
            createdAt: v.createdAt,
            snapshot: v.snapshot,
          })),
      ),
    ),
  );
  app.get('/api/v1/stream/rules', (req, res) => {
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.flushHeaders();
    res.write(': connected\n\n');
    const listener = (versionId) =>
      res.write(`event: rules\ndata: ${JSON.stringify({ versionId })}\n\n`);
    stream.on('rules', listener);
    const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 25000);
    req.on('close', () => {
      clearInterval(heartbeat);
      stream.off('rules', listener);
    });
  });
  app.post(
    '/api/v1/calculate',
    rateLimit({ windowMs: 60000, limit: 40, standardHeaders: 'draft-7', legacyHeaders: false }),
    wrap(async (req, res) => {
      const input = calculationInputSchema.parse(req.body),
        claimToken = randomBytes(32).toString('base64url');
      const result = await repo.update((s) => {
        const snapshot = active(s).snapshot;
        const row = {
          id: id(),
          userId: req.identity?.id,
          claimTokenHash: hash(claimToken),
          createdAt: Date.now(),
          inputSnapshot: input,
          outputSnapshot: calculate(input, snapshot),
          ruleSnapshot: structuredClone(snapshot),
        };
        s.calculations.push(row);
        return row;
      });
      res.status(201).json({ ...result, claimToken, claimTokenHash: undefined });
    }),
  );
  app.get(
    '/api/v1/calculations/:calculationId',
    wrap(async (req, res) => {
      const row = (await repo.read()).calculations.find(
        (c) => c.id === req.params.calculationId && (!c.userId || c.userId === req.identity?.id),
      );
      if (!row || (!row.userId && row.createdAt + 7 * 86400000 < Date.now()))
        throw new AppError('NOT_FOUND', 404);
      res.json({ ...row, claimTokenHash: undefined });
    }),
  );
  app.post(
    '/api/v1/calculations/:calculationId/claim',
    requireAuth,
    wrap(async (req, res) => {
      const { claimToken } = z.object({ claimToken: z.string().min(20) }).parse(req.body);
      await repo.update((s) => {
        const row = s.calculations.find((c) => c.id === req.params.calculationId);
        if (
          !row ||
          row.userId ||
          row.createdAt + 7 * 86400000 < Date.now() ||
          !safeEqualHex(row.claimTokenHash, hash(claimToken))
        )
          throw new AppError('CLAIM_INVALID', 403);
        row.userId = req.identity.id;
        row.claimTokenHash = '';
      });
      res.json({ ok: true });
    }),
  );
  app.use(
    '/api/v1/auth',
    rateLimit({ windowMs: 3600000, limit: 100, standardHeaders: 'draft-7', legacyHeaders: false }),
  );
  app.post(
    '/api/v1/auth/otp/request',
    secureClient,
    rateLimit({ windowMs: 3600000, limit: 20 }),
    wrap(async (req, res) => {
      const { mobile, purpose } = z
        .object({ mobile: mobileSchema, purpose: z.enum(['LOGIN', 'STEP_UP']).default('LOGIN') })
        .parse(req.body);
      const code = newOtp(),
        challengeId = id();
      await repo.update((s) => {
        const now = Date.now(),
          user = s.users.find((u) => u.mobileE164 === mobile);
        if (purpose === 'STEP_UP' && (!req.identity || req.identity.id !== user?.id))
          throw new AppError('AUTH_REQUIRED', 401);
        const recent = s.otpChallenges.filter(
          (c) => c.mobileE164 === mobile && now - c.createdAt < 3600000,
        );
        if (recent.some((c) => now - c.createdAt < 30000))
          throw new AppError(
            'OTP_COOLDOWN',
            429,
            'Wait 30 seconds before requesting another code.',
          );
        if (recent.length >= 5 || (user?.lockedUntil ?? 0) > now)
          throw new AppError('OTP_RATE_LIMITED', 429);
        s.otpChallenges.push({
          id: challengeId,
          mobileE164: mobile,
          purpose,
          codeHash: hashOtp(code, challengeId, config.OTP_PEPPER),
          createdAt: now,
          expiresAt: now + 300000,
          attempts: 0,
        });
      });
      await sender.send(mobile, code);
      res.json({
        challengeId,
        resendAfterSeconds: 30,
        ...(config.LOCAL_MODE === 'true' && config.OTP_MODE === 'console' ? { devCode: code } : {}),
      });
    }),
  );
  const verify = (req, isStepUp) =>
    repo.update((s) => {
      const { challengeId, code, consent } = z
        .object({
          challengeId: z.string(),
          code: z.string().regex(/^\d{6}$/),
          consent: z.boolean().optional(),
        })
        .parse(req.body);
      const challenge = s.otpChallenges.find((c) => c.id === challengeId);
      if (!challenge || challenge.consumedAt || challenge.expiresAt < Date.now())
        return { error: 'OTP_EXPIRED' };
      if (challenge.attempts >= 5) return { error: 'OTP_LOCKED' };
      if ((isStepUp ? 'STEP_UP' : 'LOGIN') !== challenge.purpose) return { error: 'OTP_INVALID' };
      const existing = s.users.find((u) => u.mobileE164 === challenge.mobileE164);
      if ((existing?.lockedUntil ?? 0) > Date.now()) return { error: 'OTP_LOCKED' };
      if (!safeEqualHex(challenge.codeHash, hashOtp(code, challenge.id, config.OTP_PEPPER))) {
        challenge.attempts++;
        if (existing) {
          existing.failures = [
            ...existing.failures.filter((t) => Date.now() - t < 3600000),
            Date.now(),
          ];
          if (existing.failures.length >= 10) existing.lockedUntil = Date.now() + 1800000;
        }
        return {
          error: challenge.attempts >= 5 ? 'OTP_LOCKED' : 'OTP_INVALID',
          attemptsLeft: 5 - challenge.attempts,
        };
      }
      if (isStepUp) {
        if (!existing || req.identity?.id !== existing.id) return { error: 'AUTH_REQUIRED' };
        challenge.consumedAt = Date.now();
        const session = s.sessions.find((s) => s.id === req.identity.sid);
        audit(s, existing.id, 'STEP_UP', session.id);
        return { accessToken: tokenFor(existing, session, Date.now()), user: publicUser(existing) };
      }
      if ((!existing || !existing.consentVersion) && !consent) return { error: 'CONSENT_REQUIRED' };
      challenge.consumedAt = Date.now();
      const user = existing ?? {
        id: id(),
        mobileE164: challenge.mobileE164,
        role: 'USER',
        displayName: 'Solar explorer',
        consentVersion: '2026-11-04',
        consentAt: new Date().toISOString(),
        marketingOptIn: false,
        preferredLang: 'en',
        failures: [],
      };
      if (user.deletedAt) return { error: 'SESSION_REVOKED' };
      if (!existing) s.users.push(user);
      user.failures = [];
      if (!user.consentVersion) {
        user.consentVersion = '2026-11-04';
        user.consentAt = new Date().toISOString();
      }
      const issued = issueSession(s, user, req);
      audit(s, user.id, 'LOGIN', issued.session.id);
      return {
        accessToken: tokenFor(user, issued.session),
        user: publicUser(user),
        refresh: issued.refresh,
      };
    });
  app.post(
    '/api/v1/auth/otp/verify',
    secureClient,
    wrap(async (req, res) => {
      const result = await verify(req, false);
      if ('error' in result) return res.status(400).json(result);
      if ('refresh' in result && result.refresh) cookie(res, result.refresh);
      res.json({ accessToken: result.accessToken, user: result.user });
    }),
  );
  app.post(
    '/api/v1/auth/step-up',
    secureClient,
    requireAuth,
    wrap(async (req, res) => {
      const result = await verify(req, true);
      if ('error' in result) return res.status(400).json(result);
      res.json(result);
    }),
  );
  app.post(
    '/api/v1/auth/refresh',
    secureClient,
    wrap(async (req, res) => {
      const result = await repo.update((s) => {
        const previous = s.sessions.find(
          (row) => row.refreshTokenHash === hash(String(req.cookies.ss_refresh ?? '')),
        );
        if (!previous || previous.revokedAt || previous.expiresAt < Date.now())
          return { error: 'SESSION_REVOKED' };
        if (previous.usedAt) {
          s.sessions
            .filter((row) => row.familyId === previous.familyId)
            .forEach((row) => {
              row.revokedAt = Date.now();
            });
          audit(s, previous.userId, 'REFRESH_REUSE_DETECTED', previous.id);
          return { error: 'SESSION_REVOKED' };
        }
        const user = s.users.find((u) => u.id === previous.userId && !u.deletedAt);
        if (!user) return { error: 'SESSION_REVOKED' };
        previous.usedAt = Date.now();
        const issued = issueSession(s, user, req, previous.familyId);
        return {
          accessToken: tokenFor(user, issued.session),
          user: publicUser(user),
          refresh: issued.refresh,
        };
      });
      if ('error' in result) return res.status(401).json(result);
      cookie(res, result.refresh);
      res.json({ accessToken: result.accessToken, user: result.user });
    }),
  );
  app.post(
    '/api/v1/auth/logout',
    secureClient,
    wrap(async (req, res) => {
      await repo.update((s) => {
        const session = s.sessions.find(
          (row) => row.refreshTokenHash === hash(String(req.cookies.ss_refresh ?? '')),
        );
        if (session)
          s.sessions
            .filter((row) => row.familyId === session.familyId)
            .forEach((row) => {
              row.revokedAt = Date.now();
            });
      });
      res.clearCookie('ss_refresh', { path: '/api/v1/auth' }).json({ ok: true });
    }),
  );
  app.post(
    '/api/v1/auth/logout-all',
    secureClient,
    requireAuth,
    wrap(async (req, res) => {
      await repo.update((s) => {
        s.sessions
          .filter((row) => row.userId === req.identity.id)
          .forEach((row) => {
            row.revokedAt = Date.now();
          });
      });
      res.clearCookie('ss_refresh', { path: '/api/v1/auth' }).json({ ok: true });
    }),
  );
  app.get(
    '/api/v1/auth/sessions',
    requireAuth,
    wrap(async (req, res) =>
      res.json(
        (await repo.read()).sessions
          .filter(
            (row) =>
              row.userId === req.identity.id &&
              !row.usedAt &&
              !row.revokedAt &&
              row.expiresAt > Date.now(),
          )
          .map(({ id, deviceLabel, lastSeenAt }) => ({ id, deviceLabel, lastSeenAt })),
      ),
    ),
  );
  app.delete(
    '/api/v1/auth/sessions/:sessionId',
    requireAuth,
    wrap(async (req, res) => {
      await repo.update((s) => {
        const session = s.sessions.find(
          (row) => row.id === req.params.sessionId && row.userId === req.identity.id,
        );
        if (session)
          s.sessions
            .filter((row) => row.familyId === session.familyId)
            .forEach((row) => {
              row.revokedAt = Date.now();
            });
      });
      res.json({ ok: true });
    }),
  );
  app.get(
    '/api/v1/me',
    requireAuth,
    wrap(async (req, res) =>
      res.json(publicUser((await repo.read()).users.find((u) => u.id === req.identity.id))),
    ),
  );
  app.patch(
    '/api/v1/me',
    requireAuth,
    wrap(async (req, res) => {
      const body = z
        .object({
          displayName: z.string().trim().min(1).max(60),
          preferredLang: z.enum(['en', 'mr', 'hi']).optional(),
        })
        .parse(req.body);
      res.json(
        await repo.update((s) => {
          const user = s.users.find((u) => u.id === req.identity.id);
          Object.assign(user, body);
          return publicUser(user);
        }),
      );
    }),
  );
  app.delete(
    '/api/v1/me',
    requireAuth,
    wrap(async (req, res) => {
      await repo.update((s) => {
        s.users.find((u) => u.id === req.identity.id).deletedAt = new Date().toISOString();
        s.sessions
          .filter((row) => row.userId === req.identity.id)
          .forEach((row) => {
            row.revokedAt = Date.now();
          });
        audit(s, req.identity.id, 'ACCOUNT_DELETION_REQUESTED', req.identity.id);
      });
      res
        .clearCookie('ss_refresh', { path: '/api/v1/auth' })
        .json({ ok: true, purgeAfterDays: 30 });
    }),
  );
  app.get(
    '/api/v1/households',
    requireAuth,
    wrap(async (req, res) => {
      const s = await repo.read();
      res.json(
        s.households
          .filter((h) => h.userId === req.identity.id)
          .map((h) => ({
            ...h,
            calculation: s.calculations.find((c) => c.id === h.calculationId)?.outputSnapshot,
          })),
      );
    }),
  );
  app.post(
    '/api/v1/households',
    requireAuth,
    wrap(async (req, res) => {
      const body = z
        .object({ nickname: z.string().trim().min(1).max(60), calculationId: z.string() })
        .parse(req.body);
      const result = await repo.update((s) => {
        const calculation = s.calculations.find(
          (c) => c.id === body.calculationId && c.userId === req.identity.id,
        );
        if (!calculation) throw new AppError('NOT_FOUND', 404);
        const existing = s.households.find(
          (h) => h.calculationId === calculation.id && h.userId === req.identity.id,
        );
        if (existing) return existing;
        const row = {
          id: id(),
          userId: req.identity.id,
          nickname: body.nickname,
          input: calculation.inputSnapshot,
          calculationId: calculation.id,
          createdAt: Date.now(),
          solarStatus: 'NONE',
        };
        s.households.push(row);
        return row;
      });
      res.status(201).json(result);
    }),
  );
  app.get(
    '/api/v1/households/:householdId',
    requireAuth,
    wrap(async (req, res) => {
      const s = await repo.read(),
        h = household(s, req);
      res.json({ ...h, calculation: s.calculations.find((c) => c.id === h.calculationId) });
    }),
  );
  app.get(
    '/api/v1/households/:householdId/bills',
    requireAuth,
    wrap(async (req, res) => {
      const s = await repo.read();
      household(s, req);
      res.json(
        s.billEntries
          .filter((b) => b.householdId === req.params.householdId)
          .sort((a, b) => a.billMonth.localeCompare(b.billMonth)),
      );
    }),
  );
  app.post(
    '/api/v1/households/:householdId/bills',
    requireAuth,
    wrap(async (req, res) => {
      const bill = billSchema.parse(req.body);
      const result = await repo.update((s) => {
        const h = household(s, req);
        if (s.billEntries.some((b) => b.householdId === h.id && b.billMonth === bill.billMonth))
          throw new AppError(
            'BILL_EXISTS',
            409,
            'A bill already exists for this month. Edit it instead.',
          );
        const row = { ...bill, id: id(), householdId: h.id, userId: h.userId, version: 1 };
        s.billEntries.push(row);
        return row;
      });
      res.status(201).json(result);
    }),
  );
  app.patch(
    '/api/v1/households/:householdId/bills/:billMonth',
    requireAuth,
    wrap(async (req, res) => {
      const body = billSchema.parse(req.body);
      res.json(
        await repo.update((s) => {
          household(s, req);
          const row = s.billEntries.find(
            (b) => b.householdId === req.params.householdId && b.billMonth === req.params.billMonth,
          );
          if (!row) throw new AppError('NOT_FOUND', 404);
          if (req.headers['if-match'] !== String(row.version))
            throw new AppError('EDIT_CONFLICT', 409);
          if (body.billMonth !== row.billMonth) throw new AppError('MONTH_IMMUTABLE');
          Object.assign(row, body);
          row.version++;
          return row;
        }),
      );
    }),
  );
  app.delete(
    '/api/v1/households/:householdId/bills/:billMonth',
    requireAuth,
    wrap(async (req, res) => {
      await repo.update((s) => {
        household(s, req);
        s.billEntries = s.billEntries.filter(
          (b) =>
            !(b.householdId === req.params.householdId && b.billMonth === req.params.billMonth),
        );
      });
      res.json({ ok: true });
    }),
  );
  app.get(
    '/api/v1/households/:householdId/checklist',
    requireAuth,
    wrap(async (req, res) => {
      const s = await repo.read(),
        h = household(s, req);
      res.json(
        s.calculations.find((c) => c.id === h.calculationId)?.outputSnapshot.checklist ?? [],
      );
    }),
  );
  app.get(
    '/api/v1/households/:householdId/application',
    requireAuth,
    wrap(async (req, res) => {
      const s = await repo.read(),
        h = household(s, req);
      res.json(
        s.applications.find((a) => a.householdId === h.id) ?? {
          id: '',
          householdId: h.id,
          userId: h.userId,
          stage: 0,
          nationalPortalAppNo: '',
          discomAppNo: '',
          sanctionedOn: '',
          steps: {},
          checklistProgress: [],
          version: 0,
        },
      );
    }),
  );
  app.put(
    '/api/v1/households/:householdId/application',
    requireAuth,
    wrap(async (req, res) => {
      const body = z
        .object({
          stage: z.number().int().min(0).max(7),
          nationalPortalAppNo: z.string().max(100),
          discomAppNo: z.string().max(100),
          sanctionedOn: z.string().refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v)),
          steps: z.record(z.string(), z.string().max(30)),
          checklistProgress: z.array(z.string()).max(50),
          version: z.number().int().min(0),
        })
        .parse(req.body);
      res.json(
        await repo.update((s) => {
          const h = household(s, req);
          let row = s.applications.find((a) => a.householdId === h.id);
          if (row && row.version !== body.version) throw new AppError('EDIT_CONFLICT', 409);
          if (!row) {
            row = { ...body, id: id(), userId: h.userId, householdId: h.id };
            s.applications.push(row);
          }
          Object.assign(row, body, { version: body.version + 1 });
          h.solarStatus =
            body.stage >= 6
              ? 'COMMISSIONED'
              : body.stage >= 3
                ? 'SANCTIONED'
                : body.stage
                  ? 'APPLIED'
                  : 'NONE';
          return row;
        }),
      );
    }),
  );
  app.get(
    '/api/v1/notifications',
    requireAuth,
    wrap(async (req, res) =>
      res.json((await repo.read()).notifications.filter((n) => n.userId === req.identity.id)),
    ),
  );
  app.get(
    '/api/v1/admin/overview',
    requireAuth,
    staff,
    wrap(async (_req, res) => {
      const s = await repo.read();
      res.json({
        versions: s.ruleVersions,
        auditLogs: s.auditLogs.slice(0, 100),
        households: s.households.length,
        users: s.users.length,
      });
    }),
  );
  app.post(
    '/api/v1/admin/versions',
    requireAuth,
    staff,
    wrap(async (req, res) => {
      const body = z
        .object({
          rule: ruleSchema.omit({ id: true, version: true }),
          tariff: tariffEditSchema.optional(),
          subsidy: subsidyEditSchema.optional(),
          yields: z.record(z.string(), z.array(z.number().min(0).max(300)).length(12)).optional(),
          note: z.string().trim().min(10).max(2000),
          baseVersionId: z.string(),
        })
        .parse(req.body);
      if (body.rule.verified && !body.rule.verifiedOn)
        throw new AppError('VERIFICATION_DATE_REQUIRED');
      res.status(201).json(
        await repo.update((s) => {
          const previous = active(s);
          if (previous.id !== body.baseVersionId)
            throw new AppError(
              'EDIT_CONFLICT',
              409,
              'Active rules changed. Reload before drafting.',
            );
          const version = Math.max(...s.ruleVersions.map((v) => v.snapshot.rule.version)) + 1;
          const versionId = id();
          const snapshot = structuredClone(previous.snapshot);
          snapshot.rule = {
            ...body.rule,
            id: `capacity-v${version}-${versionId.slice(0, 8)}`,
            version,
          };
          if (body.tariff)
            snapshot.tariff = {
              ...body.tariff,
              id: `tariff-v${version}-${versionId.slice(0, 8)}`,
              version,
            };
          if (body.subsidy)
            snapshot.subsidy = {
              ...body.subsidy,
              id: `subsidy-v${version}-${versionId.slice(0, 8)}`,
              version,
            };
          if (body.yields) {
            for (const district of Object.keys(snapshot.yields)) {
              if (!body.yields[district]) throw new AppError('YIELD_DISTRICT_MISSING');
            }
            snapshot.yields = body.yields;
          }
          const row = {
            id: versionId,
            snapshot,
            status: 'PENDING_REVIEW',
            draftBy: req.identity.id,
            baseVersionId: body.baseVersionId,
            createdAt: Date.now(),
            note: body.note,
            revision: 1,
          };
          s.ruleVersions.push(row);
          audit(s, req.identity.id, 'RULE_SUBMITTED', row.id, body.note);
          return row;
        }),
      );
    }),
  );
  app.post(
    '/api/v1/admin/versions/:versionId/approve',
    requireAuth,
    staff,
    stepUp,
    wrap(async (req, res) => {
      if (req.identity.role !== 'ADMIN') throw new AppError('FORBIDDEN', 403);
      const { revision } = z.object({ revision: z.number().int() }).parse(req.body);
      const row = await repo.update((s) => {
        const row = s.ruleVersions.find((v) => v.id === req.params.versionId);
        if (!row || row.status !== 'PENDING_REVIEW' || row.revision !== revision)
          throw new AppError('EDIT_CONFLICT', 409);
        if (row.draftBy === req.identity.id)
          throw new AppError(
            'FOUR_EYES_REQUIRED',
            403,
            'A different admin must review this draft.',
          );
        const old = active(s);
        if (row.baseVersionId && row.baseVersionId !== old.id)
          throw new AppError(
            'EDIT_CONFLICT',
            409,
            'The active snapshot changed after this draft was made. Submit a new draft against the current version.',
          );
        const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(
          new Date(),
        );
        if (row.snapshot.rule.effectiveFrom > today)
          throw new AppError(
            'FUTURE_EFFECTIVE_DATE',
            409,
            'Future-dated publication is not scheduled in this local build. Publish on or after the effective date.',
          );
        old.status = 'SUPERSEDED';
        row.status = 'ACTIVE';
        row.approvedBy = req.identity.id;
        row.revision++;
        audit(s, req.identity.id, 'RULE_PUBLISHED', row.id, row.note);
        return row;
      });
      stream.emit('rules', row.id);
      jobs.add(async () => {
        await repo.update((s) => {
          for (const h of s.households) {
            const old = s.calculations.find((c) => c.id === h.calculationId)?.outputSnapshot;
            if (!old) continue;
            const next = calculate(h.input, row.snapshot);
            const before = old.scenarios[old.headlineScenario],
              after = next.scenarios[next.headlineScenario];
            if (before.capacityKw !== after.capacityKw || before.subsidyInr !== after.subsidyInr)
              s.notifications.unshift({
                id: id(),
                userId: h.userId,
                at: Date.now(),
                message: `${h.nickname}: the new rule estimate is ${after.capacityKw} kW (previously ${before.capacityKw} kW). Your saved result preserves its original version.`,
              });
          }
        });
      });
      res.json(row);
    }),
  );
  app.post(
    '/api/v1/admin/versions/:versionId/reject',
    requireAuth,
    staff,
    wrap(async (req, res) => {
      const { note } = z.object({ note: z.string().min(5).max(2000) }).parse(req.body);
      await repo.update((s) => {
        const row = s.ruleVersions.find(
          (v) => v.id === req.params.versionId && v.status === 'PENDING_REVIEW',
        );
        if (!row) throw new AppError('EDIT_CONFLICT', 409);
        if (row.draftBy === req.identity.id) throw new AppError('FOUR_EYES_REQUIRED', 403);
        row.status = 'REJECTED';
        row.revision++;
        audit(s, req.identity.id, 'RULE_REJECTED', row.id, note);
      });
      res.json({ ok: true });
    }),
  );
  app.use('/api', (_req, res) => res.status(404).json({ error: 'NOT_FOUND' }));
  app.use((error, _req, res, _next) => {
    if (error instanceof ZodError)
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      });
    if (error instanceof AppError)
      return res.status(error.status).json({ error: error.code, message: error.message });
    console.error(error instanceof Error ? error.message : 'Internal error');
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'The request could not be completed. Please retry.',
    });
  });
  return { app, jobs, stream };
}
