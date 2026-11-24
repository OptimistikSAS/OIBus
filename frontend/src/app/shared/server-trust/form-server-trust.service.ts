import { HttpParams } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';

import { ServerTrustCommandDTO } from '@oibus/shared/api/server-identity.model';
import { ServerIdentity } from '@oibus/shared/domain/server-identity.model';

import { serverEndpointOf } from './server-trust';

/** What a form tests: a connector, or a side of a history query */
export type ServerTrustTarget = 'south' | 'north' | 'history-south' | 'history-north';

/**
 * The identities of the servers trusted in the form being edited, not saved yet: they are saved with the connector (or the
 * history query), while the connection tests, explore sessions, item tests and discoveries of the form already trust them
 * (the services send their fingerprint, see `withTrustedFingerprint`). One form is edited at a time: the form clears them
 * when it is left.
 */
@Injectable({ providedIn: 'root' })
export class FormServerTrustService {
  private readonly trusted = signal<Partial<Record<ServerTrustTarget, ServerIdentity>>>({});

  /** The identity trusted in the form for this target, null when none is */
  get(target: ServerTrustTarget): ServerIdentity | null {
    return this.trusted()[target] ?? null;
  }

  set(target: ServerTrustTarget, identity: ServerIdentity | null) {
    this.trusted.update(trusted => {
      const { [target]: _removed, ...others } = trusted;
      return identity ? { ...others, [target]: identity } : others;
    });
  }

  clear() {
    this.trusted.set({});
  }

  /** Tracks the identity trusted in a form for this target, starting with none */
  track(target: ServerTrustTarget): FormServerTrust {
    return new FormServerTrust(this, target);
  }

  /** The params of a request, with the fingerprint of the identity trusted in the form for this target */
  withTrustedFingerprint(target: ServerTrustTarget, params: Record<string, string>): HttpParams {
    const identity = this.get(target);
    return new HttpParams({ fromObject: identity ? { ...params, trustedFingerprint: identity.fingerprint } : params });
  }
}

/**
 * The identity of a server trusted in a form, not saved yet: tied to the server the settings connected to when it was
 * trusted, it is dropped when they connect to another one.
 */
export class FormServerTrust {
  private endpoint: string | null = null;

  constructor(
    private readonly store: FormServerTrustService,
    private readonly target: ServerTrustTarget
  ) {
    this.store.set(target, null);
  }

  get identity(): ServerIdentity | null {
    return this.store.get(this.target);
  }

  /** Trusts the identity the server of these settings presented */
  trust(identity: ServerIdentity, settings: object) {
    this.store.set(this.target, identity);
    this.endpoint = serverEndpointOf(settings);
  }

  /** Drops the identity trusted when the settings now connect to another server */
  settingsChanged(settings: object | null | undefined) {
    if (this.identity && serverEndpointOf(settings) !== this.endpoint) {
      this.store.set(this.target, null);
    }
  }

  /** The trust to save with the connector: omitted (the saved one is kept) when no identity is trusted in the form */
  command(): ServerTrustCommandDTO | undefined {
    const identity = this.identity;
    return identity ? { identity, trustOnFirstUse: false } : undefined;
  }

  /** Forgets the identity trusted, when the form is left */
  destroy() {
    this.store.set(this.target, null);
  }
}
