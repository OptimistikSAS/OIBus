import { Instant, UserInfo } from '../common/types';
import { PresentedServerIdentity, ServerIdentity } from '../domain/server-identity.model';

/**
 * An identity trusted for a connector, with who trusted it and when.
 */
export interface TrustedServerIdentityDTO extends ServerIdentity {
  /**
   * The user who trusted the identity (`system` for an identity trusted at the first connection after an upgrade).
   */
  trustedBy: UserInfo;

  /**
   * When the identity was trusted.
   * @example "2026-01-01T00:00:00.000Z"
   */
  trustedAt: Instant;
}

/**
 * The trust of a connector in the identity of its server.
 */
export interface ServerTrustDTO {
  /**
   * The identity trusted, `null` when none is.
   */
  identity: TrustedServerIdentityDTO | null;

  /**
   * Whether the connector trusts the identity it receives at its next connection, when none is trusted: set on the
   * connectors which worked before the identity of their server was checked, so that their connection keeps working.
   * @example false
   */
  trustOnFirstUse: boolean;
}

/**
 * The trust of a connector in the identity of its server, with the identity its server presented when the connector refused
 * it.
 */
export interface ServerTrustStateDTO extends ServerTrustDTO {
  /**
   * The identity the server presented at the last connection the connector refused (the connector waits for a user to
   * trust it), `null` when it did not refuse any.
   */
  pending: PresentedServerIdentity | null;
}

/**
 * An identity trusted for a connector, as a connector is created or updated. Who trusted it and when are only kept by a
 * configuration import: otherwise, an identity other than the one already trusted is trusted by the user saving the
 * connector.
 */
export interface ServerIdentityCommandDTO extends ServerIdentity {
  /**
   * The user who trusted the identity, kept by a configuration import.
   * @example "admin"
   */
  trustedBy?: string;

  /**
   * When the identity was trusted, kept by a configuration import.
   * @example "2026-01-01T00:00:00.000Z"
   */
  trustedAt?: Instant;
}

/**
 * The trust of a connector in the identity of its server, as a connector is created or updated.
 */
export interface ServerTrustCommandDTO {
  /**
   * The identity to trust, `null` to trust none.
   */
  identity: ServerIdentityCommandDTO | null;

  /**
   * Whether the connector trusts the identity it receives at its next connection, when none is trusted (see
   * `ServerTrust.trustOnFirstUse`). False when omitted.
   * @example false
   */
  trustOnFirstUse?: boolean;
}

/**
 * Trust the identity the server of a connector presents.
 */
export interface TrustServerIdentityCommandDTO {
  /**
   * The SHA-256 fingerprint of the identity to trust, as the connection test showed it: the server is asked for its
   * identity again, which is trusted only if its fingerprint is this one.
   * @example "SHA256:uNiVztksCsDhcc0u9e8BujQXVUpKZIDTMczCvj3tD2s"
   */
  fingerprint: string;
}
