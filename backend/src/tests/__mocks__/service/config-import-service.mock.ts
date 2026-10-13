import { mock } from 'node:test';

import { ConfigImportPreviewDTO, ConfigImportResponseDTO } from '../../../../shared/model/oia/config-transfer.model';

/**
 * Create a mock object for Config Import Service
 */
export default class ConfigImportServiceMock {
  validateAndUpgrade = mock.fn();
  previewConfiguration = mock.fn<(rawInput: unknown) => Promise<ConfigImportPreviewDTO>>();
  importConfiguration = mock.fn(async (_rawInput: unknown, _importedBy: string): Promise<ConfigImportResponseDTO> => ({
    fromVersion: '3.10.0',
    toVersion: '3.10.0',
    appliedUpgrades: [],
    warnings: [],
    newPort: null
  }));
  importConfigurationFromOIAnalytics = mock.fn(async (_rawInput: unknown): Promise<ConfigImportResponseDTO> => ({
    fromVersion: '3.10.0',
    toVersion: '3.10.0',
    appliedUpgrades: [],
    warnings: [],
    newPort: null
  }));
}
