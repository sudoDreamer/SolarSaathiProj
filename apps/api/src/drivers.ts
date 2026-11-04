import { createHmac, randomInt, timingSafeEqual, createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
export interface OtpSender {
  send(mobile: string, code: string): Promise<void>;
}
export class ConsoleOtpSender implements OtpSender {
  async send(mobile: string, code: string) {
    console.info(`[LOCAL OTP] ${mobile.slice(0, 3)}••••••${mobile.slice(-4)} → ${code}`);
  }
}
export interface FileStore {
  put(name: string, data: Buffer): Promise<string>;
}
export class LocalFileStore implements FileStore {
  async put(name: string, data: Buffer) {
    const safe = basename(name);
    await mkdir('apps/api/uploads', { recursive: true });
    await writeFile(join('apps/api/uploads', safe), data);
    return safe;
  }
}
export interface JobQueue {
  add(job: () => Promise<void>): void;
  drain(): Promise<void>;
}
export class MemoryJobQueue implements JobQueue {
  private queue = Promise.resolve();
  add(job: () => Promise<void>) {
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
export interface RuleCache<T> {
  get(): T | null;
  set(value: T): void;
  invalidate(): void;
}
export class MemoryRuleCache<T> implements RuleCache<T> {
  private value: T | null = null;
  private expiresAt = 0;
  get() {
    return Date.now() < this.expiresAt ? this.value : null;
  }
  set(value: T) {
    this.value = value;
    this.expiresAt = Date.now() + 15000;
  }
  invalidate() {
    this.value = null;
  }
}
export const newOtp = () => String(randomInt(0, 1000000)).padStart(6, '0');
export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export const hashOtp = (code: string, id: string, pepper: string) =>
  createHmac('sha256', pepper)
    .update(code + id)
    .digest('hex');
export function safeEqualHex(a: string, b: string) {
  const x = Buffer.from(a, 'hex'),
    y = Buffer.from(b, 'hex');
  return x.length === y.length && timingSafeEqual(x, y);
}
