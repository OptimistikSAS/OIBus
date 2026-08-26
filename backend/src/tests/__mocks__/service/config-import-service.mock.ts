import { mock } from 'node:test';
import { ConfigImportResponseDTO } from '../../../../shared/model/config-transfer.model';

/**
 * Create a mock object for Config Import Service
 */
export default class ConfigImportServiceMock {
  validateAndUpgrade = mock.fn();
  importConfiguration = mock.fn((): ConfigImportResponseDTO => ({
    appliedUpgrades: [],
    warnings: []
  }));
}
