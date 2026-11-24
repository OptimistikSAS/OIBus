import { DateTime } from 'luxon';

import { ServerTrustCommandDTO, ServerTrustDTO, ServerTrustStateDTO } from '../../shared/model/api/server-identity.model';
import { GetUserInfo } from '../../shared/model/common/types';
import { OIBusConnectionTestResult } from '../../shared/model/domain/engine.model';
import { ServerIdentity, ServerTrust, ServerTrustState, TrustedServerIdentity } from '../../shared/model/domain/server-identity.model';

import { OIBusValidationError } from '../model/types';
import { describeServerIdentity, getServerIdentityTrustStatus, NO_SERVER_TRUST, toTrustedServerIdentity } from './utils-server-identity';

/**
 * The trust of a connector saved from a command: an identity other than the one already trusted is trusted by the user
 * saving the connector, now (the identity already trusted keeps who trusted it and when). Omitted (a command predating the
 * trust, from an older client or OIAnalytics), the current trust is kept.
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
  if (!trustedFingerprint || trustedFingerprint === saved.identity?.fingerprint) {
    return saved;
  }
  const presented = await retrieveServerIdentity();
  if (presented?.fingerprint === trustedFingerprint) {
    return { identity: toTrustedServerIdentity(presented, '', ''), trustOnFirstUse: false };
  }
  return saved;
};

/**
 * Test the connection to a server, after comparing the identity it presents with the trusted one: when it is not trusted,
 * the connection is not tested further, so that no credential is sent to a server the user has not trusted yet. The result
 * carries the identity presented, for the user to review and trust it.
 */
export const testConnectionWithServerIdentity = async (
  connector: {
    retrieveServerIdentity(): Promise<ServerIdentity | null>;
    testConnection(): Promise<OIBusConnectionTestResult>;
  },
  trusted: TrustedServerIdentity | null
): Promise<OIBusConnectionTestResult> => {
  const presented = await connector.retrieveServerIdentity();
  if (!presented) {
    return await connector.testConnection();
  }
  const status = getServerIdentityTrustStatus(presented, trusted);
  if (status !== 'trusted') {
    return { items: [], serverIdentity: { identity: presented, status } };
  }
  return { ...(await connector.testConnection()), serverIdentity: { identity: presented, status } };
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
  if (presented.fingerprint !== fingerprint) {
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
