import JoiValidator from '../web-server/controllers/validators/joi.validator';
import ScanModeRepository from '../repository/config/scan-mode.repository';
import OIAnalyticsMessageService from './oia/oianalytics-message.service';
import { ScanModeCommandDTO, ScanModeDTO, ValidatedCronExpression } from '../../shared/model/scan-mode.model';
import { scanModeSchema } from '../web-server/controllers/validators/oibus-validation-schema';
import SouthCacheRepository from '../repository/cache/south-cache.repository';
import { ScanMode } from '../model/scan-mode.model';
import { validateCronExpression } from './utils';
import DataStreamEngine from '../engine/data-stream-engine';
import { NotFoundError, OIBusValidationError } from '../model/types';

export default class ScanModeService {
  constructor(
    protected readonly validator: JoiValidator,
    private scanModeRepository: ScanModeRepository,
    private southCacheRepository: SouthCacheRepository,
    private oIAnalyticsMessageService: OIAnalyticsMessageService,
    private dataStreamEngine: DataStreamEngine
  ) {}

  list(): Array<ScanMode> {
    return this.scanModeRepository.findAll();
  }

  findById(scanModeId: string): ScanMode {
    const scanMode = this.scanModeRepository.findById(scanModeId);
    if (!scanMode) {
      throw new NotFoundError(`Scan mode "${scanModeId}" not found`);
    }
    return scanMode;
  }

  async create(command: ScanModeCommandDTO): Promise<ScanMode> {
    await this.validator.validate(scanModeSchema, command);
    const scanMode = this.scanModeRepository.create(command);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    return scanMode;
  }

  async update(scanModeId: string, command: ScanModeCommandDTO): Promise<void> {
    await this.validator.validate(scanModeSchema, command);
    const oldScanMode = this.findById(scanModeId);
    this.scanModeRepository.update(oldScanMode.id, command);
    const newScanMode = this.findById(scanModeId);
    if (oldScanMode.cron !== newScanMode.cron) {
      await this.dataStreamEngine.updateScanMode(newScanMode);
    }
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
  }

  async delete(scanModeId: string): Promise<void> {
    const scanMode = this.findById(scanModeId);
    this.southCacheRepository.deleteAllByScanMode(scanMode.id);
    this.scanModeRepository.delete(scanMode.id);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
  }

  async verifyCron(command: { cron: string }): Promise<ValidatedCronExpression> {
    const result = validateCronExpression(command.cron);
    if (!result.isValid) {
      throw new OIBusValidationError(result.errorMessage);
    }
    return result;
  }
}

export const toScanModeDTO = (scanMode: ScanMode): ScanModeDTO => {
  return {
    id: scanMode.id,
    name: scanMode.name,
    description: scanMode.description,
    cron: scanMode.cron
  };
};
