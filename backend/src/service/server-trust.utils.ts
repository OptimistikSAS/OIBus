import crypto from 'node:crypto';

import { DateTime } from 'luxon';

import { ServerTrustCommandDTO, ServerTrustDTO, ServerTrustStateDTO } from '../../shared/model/api/server-identity.model';
import { GetUserInfo } from '../../shared/model/common/types';
import { OIBusObjectAttribute } from '../../shared/model/connector/form.model';
import { OIBusConnectionTestResult } from '../../shared/model/domain/engine.model';
import {
  PresentedServerIdentity,
  ServerIdentity,
  ServerIdentityTrustStatus,
  ServerTrust,
  ServerTrustState,
  TrustedServerIdentity,
  X509ServerIdentityDetails
} from '../../shared/model/domain/server-identity.model';

import { OIBusValidationError } from '../model/types';
import {
  describeServerIdentity,
  getServerIdentityTrustStatus,
  NO_SERVER_TRUST,
  sameFingerprint,
  toTrustedServerIdentity
} from './utils-server-identity';
import { toTlsServerIdentity } from './utils-tls';

/**
 * The trust of a connector saved from a command: an identity other than the one already trusted is trusted by the user
 * saving the connector, now (the identity already trusted keeps who trusted it and when). Omitted (a command predating the
 * trust, from an older client or OIAnalytics), the current trust is kept: `current` is null for a connector created, even
 * as a copy, which then trusts no identity.
 */
export const toServerTrust = (command: ServerTrustCommandDTO | undefined, current: ServerTrust | null, user: string): ServerTrust => {
  if (command === undefined) {
    return current ?? { ...NO_SERVER_TRUST };
  }
  if (!command.identity) {
    return { identity: null, trustOnFirstUse: command.trustOnFirstUse ?? false };
  }
  if (current?.identity && getServerIdentityTrustStatus(command.identity, current.identity) === 'trusted') {
    return { identity: current.identity, trustOnFirstUse: false };
  }
  return { identity: toTrustedServerIdentity(command.identity, user, DateTime.now().toUTC().toISO()!), trustOnFirstUse: false };
};

/**
 * The trust of a connector imported from a configuration: as exported, with who trusted the identity and when.
 */
export const toImportedServerTrust = (command: ServerTrustCommandDTO | undefined, importedBy: string): ServerTrust => {
  if (!command?.identity) {
    return { identity: null, trustOnFirstUse: command?.trustOnFirstUse ?? false };
  }
  return {
    identity: toTrustedServerIdentity(
      command.identity,
      command.identity.trustedBy ?? importedBy,
      command.identity.trustedAt ?? DateTime.now().toUTC().toISO()!
    ),
    trustOnFirstUse: false
  };
};

/**
 * The identity trusted for a connector tested, explored or discovered: the saved one, or the identity of the fingerprint
 * trusted in the form of the connector (not saved yet) when the server presents it. `retrieveServerIdentity` is only called
 * in this last case.
 */
export const resolveTestedServerTrust = async (
  saved: ServerTrust,
  trustedFingerprint: string | null,
  retrieveServerIdentity: () => Promise<ServerIdentity | null>
): Promise<ServerTrust> => {
  if (!trustedFingerprint || sameFingerprint(trustedFingerprint, saved.identity?.fingerprint)) {
    return saved;
  }
  const presented = await retrieveServerIdentity();
  if (presented && sameFingerprint(presented.fingerprint, trustedFingerprint)) {
    return { identity: toTrustedServerIdentity(presented, '', ''), trustOnFirstUse: false };
  }
  return saved;
};

/**
 * Test the connection to a server, after comparing the identity it presents with the trusted one: when it is not trusted,
 * the connection is not tested further, so that no credential is sent to a server the user has not trusted yet. With
 * `withServerIdentity` (a client which shows the identity for the user to review and trust it), the result then carries the
 * identity presented; otherwise the test fails, so that a client which does not know about it does not take it for a
 * success.
 */
export const testConnectionWithServerIdentity = async (
  connector: {
    retrieveServerIdentity(): Promise<ServerIdentity | null>;
    getServerIdentityTrustStatus?(presented: ServerIdentity): ServerIdentityTrustStatus;
    testConnection(): Promise<OIBusConnectionTestResult>;
  },
  trusted: TrustedServerIdentity | null,
  withServerIdentity: boolean
): Promise<OIBusConnectionTestResult> => {
  const presented = await connector.retrieveServerIdentity();
  if (!presented) {
    return await connector.testConnection();
  }
  const status = connector.getServerIdentityTrustStatus?.(presented) ?? getServerIdentityTrustStatus(presented, trusted);
  if (status !== 'trusted') {
    if (!withServerIdentity) {
      throw new Error(
        `The server presents the ${describeServerIdentity(presented)}, which is ${status === 'changed' ? 'not the trusted one' : 'not trusted'}: the connection was not tested further. Review its identity and trust it to connect`
      );
    }
    return { items: [], serverIdentity: { identity: presented, status } };
  }
  return { ...(await connector.testConnection()), serverIdentity: { identity: presented, status } };
};

/**
 * The identity the server presents and how it compares with the trusted one, without connecting further: no credential
 * is sent. `null` when the connector does not check the identity of its server.
 */
export const retrievePresentedServerIdentity = async (
  connector: {
    retrieveServerIdentity(): Promise<ServerIdentity | null>;
    getServerIdentityTrustStatus?(presented: ServerIdentity): ServerIdentityTrustStatus;
  },
  trusted: TrustedServerIdentity | null
): Promise<PresentedServerIdentity | null> => {
  const presented = await connector.retrieveServerIdentity();
  return presented
    ? {
        identity: presented,
        status: connector.getServerIdentityTrustStatus?.(presented) ?? getServerIdentityTrustStatus(presented, trusted)
      }
    : null;
};

/**
 * The identity presented by the server, checked against the fingerprint a user asked to trust (as a connection test
 * showed it): the server is asked again, so that only the identity it presents is trusted, never details sent by the
 * client.
 */
export const retrieveServerIdentityToTrust = async (
  connector: { retrieveServerIdentity(): Promise<ServerIdentity | null> },
  fingerprint: string
): Promise<ServerIdentity> => {
  const presented = await connector.retrieveServerIdentity();
  if (!presented) {
    throw new OIBusValidationError('The connector does not check the identity of its server with its current settings');
  }
  if (!sameFingerprint(presented.fingerprint, fingerprint)) {
    throw new OIBusValidationError(
      `The server presents the ${describeServerIdentity(presented)}, not the one to trust (${fingerprint}): test the connection again`
    );
  }
  return presented;
};

/**
 * The error of a connection refused because the server is not trusted, telling the user how to trust it, or the error as it
 * is.
 */
export const toServerNotTrustedError = (
  connector: { isServerNotTrusted(): boolean; getPendingServerIdentity(): { identity: ServerIdentity } | null },
  error: unknown
): unknown => {
  const pending = connector.getPendingServerIdentity();
  if (!connector.isServerNotTrusted() || !pending) {
    return error;
  }
  return new Error(
    `The server presents the ${describeServerIdentity(pending.identity)}, which is not trusted: test the connection to review its identity and trust it`
  );
};

export const toServerTrustDTO = (serverTrust: ServerTrust, getUserInfo: GetUserInfo): ServerTrustDTO => ({
  identity: serverTrust.identity ? { ...serverTrust.identity, trustedBy: getUserInfo(serverTrust.identity.trustedBy) } : null,
  trustOnFirstUse: serverTrust.trustOnFirstUse
});

export const toServerTrustStateDTO = (state: ServerTrustState, getUserInfo: GetUserInfo): ServerTrustStateDTO => ({
  ...toServerTrustDTO(state, getUserInfo),
  pending: state.pending
});

/**
 * The settings in which a connector trusting a certificate of the store (`serverTrustInCertificateStore`) tells how it
 * validates the certificate of its server: its settings, or their object attribute named by `serverTrustSettingsKey` while
 * it is enabled. `null` for another connector, or when this attribute is disabled (an OIAnalytics connector using the
 * registration of OIBus, whose certificate validation applies).
 */
export const getCertificateStoreTrustSettings = (
  manifest: { serverTrustInCertificateStore?: boolean; serverTrustSettingsKey?: string; settings: OIBusObjectAttribute },
  settings: object
): Record<string, unknown> | null => {
  if (!manifest.serverTrustInCertificateStore) {
    return null;
  }
  const key = manifest.serverTrustSettingsKey;
  if (!key) {
    return settings as Record<string, unknown>;
  }
  const values = settings as Record<string, unknown>;
  const enabled = manifest.settings.enablingConditions
    .filter(condition => condition.targetPathFromRoot === key)
    .every(condition => condition.values.includes(values[condition.referralPathFromRoot] as string | number | boolean | null));
  const trustSettings = values[key];
  return enabled && trustSettings && typeof trustSettings === 'object' ? (trustSettings as Record<string, unknown>) : null;
};

/**
 * For a connector trusting a certificate of the store (`serverTrustInCertificateStore`): the identity trusted in its form
 * (the certificate a connection test showed) is added to the store and selected in its settings, its own trust keeping no
 * identity but whether it trusts the certificate received at its first connection. Other connectors keep their trust.
 * `trustSettings` are where the connector selects the certificate (see `getCertificateStoreTrustSettings`).
 */
export const trustFormCertificateInStore = (
  trustSettings: object | null,
  serverTrust: ServerTrust,
  command: ServerTrustCommandDTO | undefined,
  inCertificateStore: boolean,
  trustCertificate: (certificatePem: string) => { id: string }
): ServerTrust => {
  if (!inCertificateStore) {
    return serverTrust;
  }
  const certificate = command?.identity?.type === 'x509' ? (command.identity.details as X509ServerIdentityDetails).certificate : undefined;
  if (!certificate || !trustSettings) {
    // the certificate received at the first connection is only trusted while the settings ask for one without selecting it
    const { certificateValidation, trustedCertificateId } = (trustSettings ?? {}) as Record<string, unknown>;
    return {
      identity: null,
      trustOnFirstUse: serverTrust.trustOnFirstUse && certificateValidation === 'trusted' && !trustedCertificateId
    };
  }
  Object.assign(trustSettings, { certificateValidation: 'trusted', trustedCertificateId: trustCertificate(certificate).id });
  return { identity: null, trustOnFirstUse: false };
};

/**
 * The trust of a connector trusting a certificate of the store, as the trust of its identity: the certificate it selected,
 * trusted by the user who added it to the store, when it validates the certificate of its server against one
 */
export const toCertificateStoreServerTrust = (
  trustSettings: object | null,
  serverTrust: ServerTrust,
  findCertificate: (certificateId: string) => { certificate: string; createdBy: string; createdAt: string }
): ServerTrust => {
  const { certificateValidation, trustedCertificateId } = (trustSettings ?? {}) as {
    certificateValidation?: unknown;
    trustedCertificateId?: unknown;
  };
  if (certificateValidation !== 'trusted' || typeof trustedCertificateId !== 'string') {
    return { identity: null, trustOnFirstUse: serverTrust.trustOnFirstUse };
  }
  const certificate = findCertificate(trustedCertificateId);
  const x509 = new crypto.X509Certificate(certificate.certificate);
  const identity = toTlsServerIdentity(x509.raw);
  return {
    identity: toTrustedServerIdentity(
      // a certification authority validates the certificate of the server, it is not the certificate of the server
      x509.ca ? { ...identity, details: { ...(identity.details as X509ServerIdentityDetails), certificationAuthority: true } } : identity,
      certificate.createdBy,
      certificate.createdAt
    ),
    trustOnFirstUse: false
  };
};
