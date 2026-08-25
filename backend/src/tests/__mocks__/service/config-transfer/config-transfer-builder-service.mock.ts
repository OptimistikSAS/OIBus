import { mock } from 'node:test';
import ConfigTransferBuilderService from '../../../../service/config-transfer/config-transfer-builder.service';
import { OIBusFullConfigurationCommandDTO, OIBusHistoryQueriesCommandDTO } from '../../../../service/oia/oianalytics.model';
import { OIAnalyticsRegistration } from '../../../../model/oianalytics-registration.model';

/**
 * Create a mock object for Config Transfer Builder Service
 */
export default class ConfigTransferBuilderServiceMock extends ConfigTransferBuilderService {
  constructor() {
    super(null!, null!, null!, null!, null!, null!, null!, null!, null!, null!, false, false);
  }
  override buildFullConfiguration = mock.fn(
    (_registration: OIAnalyticsRegistration): OIBusFullConfigurationCommandDTO => ({}) as OIBusFullConfigurationCommandDTO
  );
  override buildHistoryQueriesConfiguration = mock.fn((): OIBusHistoryQueriesCommandDTO => ({ historyQueries: [] }));
}
