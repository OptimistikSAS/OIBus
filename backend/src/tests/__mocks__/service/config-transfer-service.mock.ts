import { mock } from 'node:test';
import { ConfigExportEnvelopeDTO } from '../../../../shared/model/config-transfer.model';

/**
 * Create a mock object for Config Transfer Service
 */
export default class ConfigTransferServiceMock {
  exportConfiguration = mock.fn((): ConfigExportEnvelopeDTO => ({}) as ConfigExportEnvelopeDTO);
}
