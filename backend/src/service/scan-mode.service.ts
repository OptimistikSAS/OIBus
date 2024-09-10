import JoiValidator from '../web-server/controllers/validators/joi.validator';
import ScanModeRepository from '../repository/scan-mode.repository';
import OIAnalyticsMessageService from './oia/oianalytics-message.service';
import { ScanModeCommandDTO, ScanModeDTO, ValidatedCronExpression } from '../../../shared/model/scan-mode.model';
import { scanModeSchema } from '../web-server/controllers/validators/oibus-validation-schema';
import SouthCacheRepository from '../repository/south-cache.repository';
import { ScanMode } from '../model/scan-mode.model';
import { validateCronExpression } from './utils';
import OIBusEngine from '../engine/oibus-engine';

export default class ScanModeService {
  constructor(
    protected readonly validator: JoiValidator,
    private scanModeRepository: ScanModeRepository,
    private southCacheRepository: SouthCacheRepository,
    private oIAnalyticsMessageService: OIAnalyticsMessageService,
    private oibusEngine: OIBusEngine
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
    this.oIAnalyticsMessageService.createFullConfigMessage();
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
      await this.oibusEngine.updateScanMode(newScanMode);
    }
    this.oIAnalyticsMessageService.createFullConfigMessage();
  }

  async delete(scanModeId: string): Promise<void> {
    const scanMode = this.scanModeRepository.findById(scanModeId);
    if (!scanMode) {
      throw new Error(`Scan mode ${scanModeId} not found`);
    }

    this.southCacheRepository.deleteAllByScanMode(scanModeId);
    this.scanModeRepository.delete(scanModeId);
    this.oIAnalyticsMessageService.createFullConfigMessage();
  }

  async verifyCron(command: ScanModeCommandDTO): Promise<ValidatedCronExpression> {
    await this.validator.validate(scanModeSchema, command);

    if (!command.cron) {
      throw new Error('Cron expression is required');
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
