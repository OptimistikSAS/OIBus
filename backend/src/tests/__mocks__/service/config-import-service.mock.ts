import { mock } from 'node:test';

import { ConfigImportResponseDTO } from '../../../../shared/model/oia/config-transfer.model';

/**
 * Create a mock object for Config Import Service
 */
export default class ConfigImportServiceMock {
  validateAndUpgrade = mock.fn();
  previewConfiguration = mock.fn();
  importConfiguration = mock.fn((): ConfigImportResponseDTO => ({
    fromVersion: '3.10.0',
    toVersion: '3.10.0',
    appliedUpgrades: [],
    warnings: [],
    newPort: null
  }));
}
