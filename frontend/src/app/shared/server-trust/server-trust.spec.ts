import { describe, expect, test } from 'vitest';

import { ServerTrustDTO } from '@oibus/shared/api/server-identity.model';
import { PresentedServerIdentity, ServerIdentity, ServerIdentityTrustStatus } from '@oibus/shared/domain/server-identity.model';

import { mustReviewServerIdentity, serverEndpointOf } from './server-trust';

const identity: ServerIdentity = {
  type: 'ssh-host-key',
  fingerprint: 'SHA256:uNiVztksCsDhcc0u9e8BujQXVUpKZIDTMczCvj3tD2s',
  details: { keyType: 'ssh-ed25519' }
};

function presented(status: ServerIdentityTrustStatus): PresentedServerIdentity {
  return { identity, status };
}

const noTrust: ServerTrustDTO = { identity: null, trustOnFirstUse: false };
const trustOnFirstUse: ServerTrustDTO = { identity: null, trustOnFirstUse: true };

describe('serverEndpointOf', () => {
  test('should only depend on the settings telling which server the connector connects to', () => {
    const settings = { url: 'opc.tcp://server:4840', securityMode: 'sign', securityPolicy: 'basic256', username: 'user' };

    expect(serverEndpointOf(settings)).toBe(serverEndpointOf({ ...settings, username: 'other', timeout: 1000 }));
    expect(serverEndpointOf(settings)).toBe(JSON.stringify(['opc.tcp://server:4840', null, null, 'sign', 'basic256']));
  });

  test.each(['url', 'host', 'port', 'securityMode', 'securityPolicy'])('should change when %s changes', key => {
    const settings = { url: 'opc.tcp://server:4840', host: 'server', port: 22, securityMode: 'sign', securityPolicy: 'basic256' };

    expect(serverEndpointOf({ ...settings, [key]: 'changed' })).not.toBe(serverEndpointOf(settings));
  });

  test('should consider missing settings as empty', () => {
    const empty = JSON.stringify([null, null, null, null, null]);

    expect(serverEndpointOf(null)).toBe(empty);
    expect(serverEndpointOf(undefined)).toBe(empty);
    expect(serverEndpointOf({})).toBe(empty);
  });
});

describe('mustReviewServerIdentity', () => {
  test.each<{ name: string; presented: PresentedServerIdentity | null; serverTrust: ServerTrustDTO | null; expected: boolean }>([
    { name: 'no identity presented', presented: null, serverTrust: noTrust, expected: false },
    { name: 'a trusted identity', presented: presented('trusted'), serverTrust: noTrust, expected: false },
    {
      name: 'an unknown identity trusted at the first connection',
      presented: presented('unknown'),
      serverTrust: trustOnFirstUse,
      expected: false
    },
    { name: 'an unknown identity', presented: presented('unknown'), serverTrust: noTrust, expected: true },
    { name: 'an unknown identity of a connector being created', presented: presented('unknown'), serverTrust: null, expected: true },
    { name: 'a changed identity', presented: presented('changed'), serverTrust: noTrust, expected: true },
    {
      name: 'a changed identity, even trusted at the first connection',
      presented: presented('changed'),
      serverTrust: trustOnFirstUse,
      expected: true
    }
  ])('should tell whether $name must be reviewed', ({ presented, serverTrust, expected }) => {
    expect(mustReviewServerIdentity(presented, serverTrust)).toBe(expected);
  });
});
