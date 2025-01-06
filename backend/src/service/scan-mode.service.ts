import JoiValidator from '../web-server/controllers/validators/joi.validator';
import ScanModeRepository from '../repository/config/scan-mode.repository';
import OIAnalyticsMessageService from './oia/oianalytics-message.service';
import { ScanModeCommandDTO, ScanModeDTO, ValidatedCronExpression } from '../../shared/model/scan-mode.model';
import { scanModeSchema } from '../web-server/controllers/validators/oibus-validation-schema';
import SouthCacheRepository from '../repository/cache/south-cache.repository';
import { ScanMode } from '../model/scan-mode.model';
import { validateCronExpression } from './utils';
import DataStreamEngine from '../engine/data-stream-engine';

export default class ScanModeService {
  constructor(
    protected readonly validator: JoiValidator,
    private scanModeRepository: ScanModeRepository,
    private southCacheRepository: SouthCacheRepository,
    private oIAnalyticsMessageService: OIAnalyticsMessageService,
    private dataStreamEngine: DataStreamEngine
  ) {}

  findAll(): Array<ScanMode> {
    return this.scanModeRepository.findAll();
  }

  findById(id: string): ScanMode | null {
    return this.scanModeRepository.findById(id);
  }

  async create(command: ScanModeCommandDTO): Promise<ScanMode> {
    await this.validator.validate(scanModeSchema, command);
    const scanMode = this.scanModeRepository.create(command);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    return scanMode;
  }

  async update(scanModeId: string, command: ScanModeCommandDTO): Promise<void> {
    await this.validator.validate(scanModeSchema, command);
    const oldScanMode = this.scanModeRepository.findById(scanModeId);
    if (!oldScanMode) {
      throw new Error(`Scan mode ${scanModeId} not found`);
    }
    this.scanModeRepository.update(scanModeId, command);
    const newScanMode = this.scanModeRepository.findById(scanModeId)!;
    if (oldScanMode.cron !== newScanMode.cron) {
      await this.dataStreamEngine.updateScanMode(newScanMode);
    }
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
  }

  async delete(scanModeId: string): Promise<void> {
    const scanMode = this.scanModeRepository.findById(scanModeId);
    if (!scanMode) {
      throw new Error(`Scan mode ${scanModeId} not found`);
    }

    this.southCacheRepository.deleteAllByScanMode(scanModeId);
    this.scanModeRepository.delete(scanModeId);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
  }

  async verifyCron(command: { cron: string }): Promise<ValidatedCronExpression> {
    if (!command.cron) {
      return {
        isValid: false,
        errorMessage: 'Cron expression is required',
        nextExecutions: [],
        humanReadableForm: ''
      };
    }
    return validateCronExpression(command.cron);
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
