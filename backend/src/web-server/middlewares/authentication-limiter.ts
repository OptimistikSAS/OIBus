import { isLocalhostAddress } from '../../service/utils';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES_PER_IP = 10;
const MAX_FAILURES_PER_LOGIN = 100;
const PRUNE_INTERVAL_MS = 60 * 1000;

interface Failures {
  count: number;
  windowEnd: number;
}

/**
 * Limits the failed password authentications, to slow down password guessing and bound the cost of verifying passwords
 * (each argon2 verification takes CPU time and 64 MiB of memory).
 *
 * Only failures are counted, so a client authenticating successfully is never throttled, unless its address or its login
 * is blocked. An address may fail 10 times and a login 100 times in 15 minutes, counted from their first failure: the
 * limit on a login, higher, bounds a guessing spread over many addresses without letting a few of them lock an account out.
 * The local addresses are only limited by login: a reverse proxy on the host makes all its clients come from them.
 */
export default class AuthenticationLimiter {
  private readonly failuresByIp = new Map<string, Failures>();
  private readonly failuresByLogin = new Map<string, Failures>();
  private nextPrune = 0;

  /**
   * Returns how many seconds the address or the login must wait before authenticating again, 0 when they may now.
   */
  retryAfter(ip: string, login: string): number {
    const now = Date.now();
    const blockedUntil = Math.max(
      this.blockedUntil(this.failuresByIp.get(ip), MAX_FAILURES_PER_IP, now),
      this.blockedUntil(this.failuresByLogin.get(login), MAX_FAILURES_PER_LOGIN, now)
    );
    return Math.ceil((blockedUntil - now) / 1000);
  }

  recordFailure(ip: string, login: string): void {
    const now = Date.now();
    this.prune(now);
    if (!isLocalhostAddress(ip)) {
      this.increment(this.failuresByIp, ip, now);
    }
    this.increment(this.failuresByLogin, login, now);
  }

  private blockedUntil(failures: Failures | undefined, maxFailures: number, now: number): number {
    return failures && failures.windowEnd > now && failures.count >= maxFailures ? failures.windowEnd : now;
  }

  private increment(failuresByKey: Map<string, Failures>, key: string, now: number): void {
    const failures = failuresByKey.get(key);
    if (failures && failures.windowEnd > now) {
      failures.count++;
    } else {
      failuresByKey.set(key, { count: 1, windowEnd: now + WINDOW_MS });
    }
  }

  // Forget the windows ended, at most once a minute, so that the failures of many addresses and logins do not pile up
  private prune(now: number): void {
    if (now < this.nextPrune) {
      return;
    }
    this.nextPrune = now + PRUNE_INTERVAL_MS;
    for (const failuresByKey of [this.failuresByIp, this.failuresByLogin]) {
      for (const [key, failures] of failuresByKey) {
        if (failures.windowEnd <= now) {
          failuresByKey.delete(key);
        }
      }
    }
  }
}
