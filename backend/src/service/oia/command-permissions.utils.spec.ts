import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { COMMAND_PERMISSIONS, RegistrationCommandPermissions } from '../../../shared/model/domain/engine.model';
import { OIBUS_COMMAND_TYPES } from '../../../shared/model/oia/command.model';

import { applyRemoteCommandPermissions, getAllowedCommands, isCommandAllowed } from './command-permissions.utils';

const ALL_GRANTED = Object.fromEntries(COMMAND_PERMISSIONS.map(permission => [permission, true])) as Record<
  keyof RegistrationCommandPermissions,
  boolean
>;

describe('Command permissions', () => {
  describe('isCommandAllowed', () => {
    it('should allow every command when every permission is granted', () => {
      assert.ok(OIBUS_COMMAND_TYPES.every(type => isCommandAllowed(type, ALL_GRANTED)));
    });

    it('should allow a command when its permission is granted', () => {
      assert.ok(isCommandAllowed('create-south', { ...ALL_GRANTED, setpoint: false }));
    });

    it('should not allow a command when its permission is revoked', () => {
      assert.ok(!isCommandAllowed('create-south', { ...ALL_GRANTED, configureDataFlow: false }));
    });

    it('should not allow testing a transformer reading an item without connecting to the data sources', () => {
      assert.ok(!isCommandAllowed('test-transformer', { ...ALL_GRANTED, connectToDataSources: false }));
    });

    it('should not allow testing a custom transformer without configuring custom code', () => {
      assert.ok(!isCommandAllowed('test-custom-transformer', { ...ALL_GRANTED, configureCustomCode: false }));
    });

    for (const permission of ['configureEngine', 'configureDataFlow', 'configureCustomCode', 'manageAccess'] as const) {
      it(`should not allow importing a configuration without ${permission}`, () => {
        assert.ok(!isCommandAllowed('import-configuration', { ...ALL_GRANTED, [permission]: false }));
      });
    }
  });

  describe('getAllowedCommands', () => {
    it('should list every command when every permission is granted', () => {
      assert.deepStrictEqual(getAllowedCommands(ALL_GRANTED), [...OIBUS_COMMAND_TYPES]);
    });

    it('should list the commands of the granted permissions', () => {
      const permissions = Object.fromEntries(COMMAND_PERMISSIONS.map(permission => [permission, false])) as Record<
        keyof RegistrationCommandPermissions,
        boolean
      >;

      assert.deepStrictEqual(getAllowedCommands({ ...permissions, diagnostics: true, operate: true }), [
        'restart-engine',
        'dump-memory',
        'retrieve-logs-database',
        'update-history-query-status'
      ]);
    });
  });

  describe('applyRemoteCommandPermissions', () => {
    it('should revoke the permissions revoked by OIAnalytics', () => {
      assert.deepStrictEqual(applyRemoteCommandPermissions(ALL_GRANTED, { ...ALL_GRANTED, setpoint: false, manageCache: false }), {
        ...ALL_GRANTED,
        setpoint: false,
        manageCache: false
      });
    });

    it('should not grant the permissions revoked locally', () => {
      assert.deepStrictEqual(applyRemoteCommandPermissions({ ...ALL_GRANTED, diagnostics: false }, ALL_GRANTED), {
        ...ALL_GRANTED,
        diagnostics: false
      });
    });
  });
});
