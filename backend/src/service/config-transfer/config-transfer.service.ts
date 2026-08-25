import { DateTime } from 'luxon';
import ConfigTransferBuilderService from './config-transfer-builder.service';
import EngineRepository from '../../repository/config/engine.repository';
import OIAnalyticsRegistrationService from '../oia/oianalytics-registration.service';
import { ConfigExportEnvelopeDTO } from '../../../shared/model/config-transfer.model';

/**
 * Bumped whenever the shape of `ConfigExportEnvelopeDTO`, or of the DTOs it is built from, changes
 * in a way that requires an upgrade step to import an older export.
 */
export const CONFIG_EXPORT_FORMAT_VERSION = 1;

/**
 * Wraps `ConfigTransferBuilderService` to produce the versioned, downloadable export envelope
 * used by the config export/import feature. Has no OIAnalytics connectivity of its own.
 */
export default class ConfigTransferService {
  constructor(
    private configTransferBuilderService: ConfigTransferBuilderService,
    private engineRepository: EngineRepository,
    private oIAnalyticsRegistrationService: OIAnalyticsRegistrationService
  ) {}

  exportConfiguration(): ConfigExportEnvelopeDTO {
    const engine = this.engineRepository.get()!;
    const registration = this.oIAnalyticsRegistrationService.getRegistrationSettings();
    return {
      formatVersion: CONFIG_EXPORT_FORMAT_VERSION,
      oibusVersion: engine.version,
      exportedAt: DateTime.now().toUTC().toISO()!,
      fullConfiguration: this.configTransferBuilderService.buildFullConfiguration(registration),
      historyQueries: this.configTransferBuilderService.buildHistoryQueriesConfiguration()
    };
  }
}
