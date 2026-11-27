import { DateTime } from 'luxon';

import {
  PresentedServerIdentity,
  ServerIdentity,
  ServerIdentityTrustStatus,
  ServerTrust,
  TrustedServerIdentity
} from '../../shared/model/domain/server-identity.model';

import type { ILogger } from '../model/logger.model';
import TypedEventEmitter from './typed-event-emitter';
import { describeServerIdentity, getServerIdentityTrustStatus, toTrustedServerIdentity } from './utils-server-identity';

/** Events published by a {@link ServerIdentityVerifier}. */
export interface ServerTrustEvents {
  /** The connector trusted the identity it received at its first connection (see `ServerTrust.trustOnFirstUse`): to be saved. */
  'trusted-on-first-use': TrustedServerIdentity;
  /**
   * A connector trusting a certificate of the store trusted the certificate its server presented at its first connection
   * (see `refuseCertificate`): to be added to the store and selected in its settings.
   */
  'certificate-trusted-on-first-use': ServerIdentity;
}

/**
 * Compares the identity a server presents with the one the connector trusts, at each connection, and keeps the identity the
 * connector refused (pending, until a user trusts it). Shared by the South and North connectors, which only extract the
 * identity their protocol presents.
 */
export default class ServerIdentityVerifier {
  readonly events = new TypedEventEmitter<ServerTrustEvents>();
  private pending: PresentedServerIdentity | null = null;

  constructor(
    private readonly getTrust: () => ServerTrust,
    private readonly setTrust: (trust: ServerTrust) => void,
    private readonly getLogger: () => ILogger
  ) {}

  /**
   * Whether the connection can go on with a server presenting this identity: the trusted identity, or the first identity
   * received by a connector trusting it on first use. Otherwise, the identity is kept as pending, and the connection must be
   * refused before any credential is sent.
   */
  verify(presented: ServerIdentity): boolean {
    const trust = this.getTrust();
    const status = getServerIdentityTrustStatus(presented, trust.identity);
    if (status === 'trusted') {
      this.pending = null;
      return true;
    }
    if (status === 'unknown' && trust.trustOnFirstUse) {
      const identity = toTrustedServerIdentity(presented, 'system', DateTime.now().toUTC().toISO()!);
      this.setTrust({ identity, trustOnFirstUse: false });
      this.pending = null;
      this.getLogger().info(`Server ${describeServerIdentity(presented)} trusted at the first connection`);
      this.events.emit('trusted-on-first-use', identity);
      return true;
    }
    this.refuse(presented, status, trust.identity);
    return false;
  }

  /**
   * Keeps the identity a server presented as pending, the connection having been refused: by `verify`, or by the TLS
   * validation of a connector trusting a certificate of the store (which the identity does not validate against).
   */
  refuse(presented: ServerIdentity, status: Exclude<ServerIdentityTrustStatus, 'trusted'>, trusted: ServerIdentity | null = null): void {
    this.pending = { identity: presented, status };
    this.getLogger().error(
      status === 'changed' && trusted
        ? `Connection refused: the server presents the ${describeServerIdentity(presented)}, which is not the trusted one (${describeServerIdentity(trusted)}). Review it and trust it to connect`
        : status === 'changed'
          ? `Connection refused: the server presents the ${describeServerIdentity(presented)}, which does not validate against the trusted certificate. Review it and trust it to connect`
          : `Connection refused: the server presents the ${describeServerIdentity(presented)}, which is not trusted. Review it and trust it to connect`
    );
  }

  /**
   * For a connector trusting a certificate of the store, whose TLS validation refused the certificate of its server: the
   * certificate is trusted when the connector trusts the one received at its first connection and its settings ask for a
   * trusted certificate without selecting one yet (`awaitingCertificate`: a connector which accepted any certificate
   * before), else refused (see `refuse`). Whether it is trusted.
   */
  refuseCertificate(
    presented: ServerIdentity,
    status: Exclude<ServerIdentityTrustStatus, 'trusted'>,
    awaitingCertificate: boolean
  ): boolean {
    if (status === 'unknown' && awaitingCertificate && this.getTrust().trustOnFirstUse) {
      this.setTrust({ identity: null, trustOnFirstUse: false });
      this.pending = null;
      this.getLogger().info(`Server ${describeServerIdentity(presented)} trusted at the first connection`);
      this.events.emit('certificate-trusted-on-first-use', presented);
      return true;
    }
    this.refuse(presented, status);
    return false;
  }

  /** The identity the server presented at the last connection refused, `null` when the last connection was not refused. */
  get pendingIdentity(): PresentedServerIdentity | null {
    return this.pending;
  }

  /** Forget the identity refused, before a new connection attempt (a restart of the connector). */
  reset(): void {
    this.pending = null;
  }
}
