import { createHmac, randomInt, timingSafeEqual, createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
export class ConsoleOtpSender {
  async send(mobile, code) {
    console.info(`[LOCAL OTP] ${mobile.slice(0, 3)}••••••${mobile.slice(-4)} → ${code}`);
  }
}
export class LocalFileStore {
  async put(name, data) {
    const safe = basename(name);
    await mkdir('apps/api/uploads', { recursive: true });
    await writeFile(join('apps/api/uploads', safe), data);
    return safe;
  }
}
export class MemoryJobQueue {
  queue = Promise.resolve();
  add(job) {
    this.queue = this.queue
      .then(job)
      .catch((error) =>
        console.error(
          'Local worker failed:',
          error instanceof Error ? error.message : 'unknown error',
        ),
      );
  }
  async drain() {
    await this.queue;
  }
}
export class MemoryRuleCache {
  value = null;
  expiresAt = 0;
  get() {
    return Date.now() < this.expiresAt ? this.value : null;
  }
  set(value) {
    this.value = value;
    this.expiresAt = Date.now() + 15000;
  }
  invalidate() {
    this.value = null;
  }
}
export const newOtp = () => String(randomInt(0, 1000000)).padStart(6, '0');
export const hash = (value) => createHash('sha256').update(value).digest('hex');
export const hashOtp = (code, id, pepper) =>
  createHmac('sha256', pepper)
    .update(code + id)
    .digest('hex');
export function safeEqualHex(a, b) {
  const x = Buffer.from(a, 'hex'),
    y = Buffer.from(b, 'hex');
  return x.length === y.length && timingSafeEqual(x, y);
}
