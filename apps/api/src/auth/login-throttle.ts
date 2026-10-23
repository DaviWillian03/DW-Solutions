import { createHash } from 'node:crypto';
import type { Redis } from 'ioredis';

/**
 * Bloqueio por conta (complementa o limite por IP do Better Auth): após MAX falhas de senha para o
 * mesmo e-mail em WINDOW segundos, novas tentativas são recusadas — mesmo vindas de IPs diferentes.
 * O e-mail é guardado só como hash.
 */
export class LoginThrottle {
  static readonly MAX = 10;
  static readonly WINDOW = 15 * 60;

  constructor(private readonly redis: Redis) {}

  private key(email: string) {
    return `dw:login-fail:${createHash('sha256').update(email.trim().toLowerCase()).digest('hex')}`;
  }

  private async ready() {
    if (this.redis.status === 'wait' || this.redis.status === 'end') await this.redis.connect();
  }

  async isBlocked(email: string): Promise<boolean> {
    await this.ready();
    const n = Number(await this.redis.get(this.key(email)));
    return n >= LoginThrottle.MAX;
  }

  async fail(email: string): Promise<void> {
    await this.ready();
    const k = this.key(email);
    const n = await this.redis.incr(k);
    if (n === 1) await this.redis.expire(k, LoginThrottle.WINDOW);
  }

  async reset(email: string): Promise<void> {
    await this.ready();
    await this.redis.del(this.key(email));
  }
}
