import { describe, expect, test } from 'vitest';

import { ServerTrustDTO } from '@oibus/shared/api/server-identity.model';
import { PresentedServerIdentity } from '@oibus/shared/domain/server-identity.model';

import testData from '../../../test/test-data';
import { mustReviewServerIdentity, serverEndpointOf, toDisplayedServerTrust } from './server-trust';

const { presented, states } = testData.serverTrust;
const { none: noTrust, trustOnFirstUse } = states;

describe('serverEndpointOf', () => {
  test('should only depend on the settings telling which server the connector connects to', () => {
    const settings = { url: 'opc.tcp://server:4840', securityMode: 'sign', securityPolicy: 'basic256', username: 'user' };

    expect(serverEndpointOf(settings)).toBe(serverEndpointOf({ ...settings, username: 'other', timeout: 1000 }));
  });

  test.each([
    'url',
    'host',
    'port',
    'securityMode',
    'securityPolicy',
    'sslMode',
    'useOiaModule',
    'certificateValidation',
    'trustedCertificateId'
  ])('should change when %s changes', key => {
    const settings = { url: 'opc.tcp://server:4840', host: 'server', port: 22, securityMode: 'sign', securityPolicy: 'basic256' };

    expect(serverEndpointOf({ ...settings, [key]: 'changed' })).not.toBe(serverEndpointOf(settings));
  });

  test.each(['specificSettings', 'connectionSettings'])('should change when the server of the %s changes', key => {
    const server = { host: 'server', port: 5432, certificateValidation: 'standard' };
    const settings = { [key]: server, username: 'user' };

    expect(serverEndpointOf({ ...settings, [key]: { ...server, host: 'other' } })).not.toBe(serverEndpointOf(settings));
    expect(serverEndpointOf({ ...settings, [key]: { ...server, username: 'other' } })).toBe(serverEndpointOf(settings));
  });

  test('should consider missing settings as empty', () => {
    expect(serverEndpointOf(null)).toBe(serverEndpointOf({}));
    expect(serverEndpointOf(undefined)).toBe(serverEndpointOf({ specificSettings: null }));
  });
});

describe('mustReviewServerIdentity', () => {
  test.each<{ name: string; presented: PresentedServerIdentity | null; serverTrust: ServerTrustDTO | null; expected: boolean }>([
    { name: 'no identity presented', presented: null, serverTrust: noTrust, expected: false },
    { name: 'a trusted identity', presented: presented.trusted, serverTrust: noTrust, expected: false },
    {
      name: 'an unknown identity trusted at the first connection',
      presented: presented.unknown,
      serverTrust: trustOnFirstUse,
      expected: false
    },
    { name: 'an unknown identity', presented: presented.unknown, serverTrust: noTrust, expected: true },
    { name: 'an unknown identity of a connector being created', presented: presented.unknown, serverTrust: null, expected: true },
    { name: 'a changed identity', presented: presented.changed, serverTrust: noTrust, expected: true },
    {
      name: 'a changed identity, even trusted at the first connection',
      presented: presented.changed,
      serverTrust: trustOnFirstUse,
      expected: true
    }
  ])('should tell whether $name must be reviewed', ({ presented, serverTrust, expected }) => {
    expect(mustReviewServerIdentity(presented, serverTrust)).toBe(expected);
  });
});

describe('toDisplayedServerTrust', () => {
  test('should show nothing before the trust is read', () => {
    expect(toDisplayedServerTrust(null, true)).toBeNull();
  });

  test('should show nothing when no identity is trusted, refused nor to trust at the first connection', () => {
    expect(toDisplayedServerTrust(states.none, true)).toBeNull();
  });

  test('should show the trust of a running connector, with the identity it refused', () => {
    expect(toDisplayedServerTrust(states.changedRefused, true)).toBe(states.changedRefused);
    expect(toDisplayedServerTrust(states.trustOnFirstUse, false)).toEqual(states.trustOnFirstUse);
  });

  test('should not show the identity refused by a stopped connector', () => {
    expect(toDisplayedServerTrust(states.changedRefused, false)).toEqual({ ...states.changedRefused, pending: null });
    expect(toDisplayedServerTrust(states.unknownRefused, false)).toBeNull();
  });
});
