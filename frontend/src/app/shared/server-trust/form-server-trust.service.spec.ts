import { TestBed } from '@angular/core/testing';

import { beforeEach, describe, expect, test } from 'vitest';

import { ServerIdentity } from '@oibus/shared/domain/server-identity.model';

import { FormServerTrust, FormServerTrustService } from './form-server-trust.service';

const identity: ServerIdentity = {
  type: 'ssh-host-key',
  fingerprint: 'SHA256:uNiVztksCsDhcc0u9e8BujQXVUpKZIDTMczCvj3tD2s',
  details: { keyType: 'ssh-ed25519' }
};
const otherIdentity: ServerIdentity = {
  type: 'ssh-host-key',
  fingerprint: 'SHA256:otherFingerprint',
  details: { keyType: 'ssh-rsa' }
};

describe('FormServerTrustService', () => {
  let service: FormServerTrustService;

  beforeEach(() => {
    service = TestBed.inject(FormServerTrustService);
  });

  test('should hold no identity at first', () => {
    expect(service.get('south')).toBeNull();
    expect(service.get('north')).toBeNull();
    expect(service.get('history-south')).toBeNull();
    expect(service.get('history-north')).toBeNull();
  });

  test('should hold an identity per target', () => {
    service.set('south', identity);
    service.set('history-north', otherIdentity);

    expect(service.get('south')).toEqual(identity);
    expect(service.get('history-north')).toEqual(otherIdentity);
    expect(service.get('north')).toBeNull();
    expect(service.get('history-south')).toBeNull();
  });

  test('should replace and remove the identity of a target only', () => {
    service.set('south', identity);
    service.set('north', identity);

    service.set('south', otherIdentity);
    expect(service.get('south')).toEqual(otherIdentity);

    service.set('south', null);
    expect(service.get('south')).toBeNull();
    expect(service.get('north')).toEqual(identity);
  });

  test('should clear every identity', () => {
    service.set('south', identity);
    service.set('history-south', identity);

    service.clear();

    expect(service.get('south')).toBeNull();
    expect(service.get('history-south')).toBeNull();
  });

  describe('withTrustedFingerprint', () => {
    test('should keep the params when no identity is trusted for the target', () => {
      service.set('north', identity);

      const params = service.withTrustedFingerprint('south', { southType: 'opcua', itemName: 'item' });

      expect(params.keys()).toEqual(['southType', 'itemName']);
      expect(params.get('southType')).toBe('opcua');
      expect(params.get('itemName')).toBe('item');
    });

    test('should add the fingerprint of the identity trusted for the target', () => {
      service.set('history-south', identity);

      const params = service.withTrustedFingerprint('history-south', { southType: 'sftp', fromSouth: 'southId1' });

      expect(params.keys()).toEqual(['southType', 'fromSouth', 'trustedFingerprint']);
      expect(params.get('southType')).toBe('sftp');
      expect(params.get('fromSouth')).toBe('southId1');
      expect(params.get('trustedFingerprint')).toBe(identity.fingerprint);
    });
  });

  describe('FormServerTrust', () => {
    const settings = {
      url: 'opc.tcp://server:4840',
      host: 'server',
      port: 4840,
      securityMode: 'sign',
      securityPolicy: 'basic256',
      username: 'user'
    };
    let tracker: FormServerTrust;

    beforeEach(() => {
      tracker = service.track('south');
    });

    test('should start with no identity, forgetting the one of a previous form', () => {
      service.set('north', identity);

      const northTracker = service.track('north');

      expect(northTracker.identity).toBeNull();
      expect(service.get('north')).toBeNull();
      expect(northTracker.command()).toBeUndefined();
    });

    test('should trust an identity for its target', () => {
      tracker.trust(identity, settings);

      expect(tracker.identity).toEqual(identity);
      expect(service.get('south')).toEqual(identity);
      expect(service.get('north')).toBeNull();
      expect(tracker.command()).toEqual({ identity, trustOnFirstUse: false });
    });

    test('should keep the identity when the settings still connect to the same server', () => {
      tracker.trust(identity, settings);

      tracker.settingsChanged({ ...settings, username: 'other user', timeout: 30 });

      expect(tracker.identity).toEqual(identity);
    });

    test.each(['url', 'host', 'port', 'securityMode', 'securityPolicy'])(
      'should drop the identity when the settings connect to another server (%s changed)',
      key => {
        tracker.trust(identity, settings);

        tracker.settingsChanged({ ...settings, [key]: 'changed' });

        expect(tracker.identity).toBeNull();
        expect(service.get('south')).toBeNull();
        expect(tracker.command()).toBeUndefined();
      }
    );

    test('should drop the identity when the settings are gone', () => {
      tracker.trust(identity, settings);

      tracker.settingsChanged(null);

      expect(tracker.identity).toBeNull();
    });

    test('should do nothing when settings change without an identity trusted', () => {
      service.set('north', identity);

      tracker.settingsChanged({ ...settings, url: 'opc.tcp://other:4840' });

      expect(tracker.identity).toBeNull();
      expect(service.get('north')).toEqual(identity);
    });

    test('should forget the identity when the form is built again', () => {
      tracker.trust(identity, settings);

      tracker.reset();

      expect(tracker.identity).toBeNull();
      expect(service.get('south')).toBeNull();
      // and the settings it was trusted for
      tracker.settingsChanged(settings);
      expect(tracker.identity).toBeNull();
    });

    test('should forget the identity when destroyed', () => {
      tracker.trust(identity, settings);

      tracker.destroy();

      expect(tracker.identity).toBeNull();
      expect(service.get('south')).toBeNull();
    });
  });
});
