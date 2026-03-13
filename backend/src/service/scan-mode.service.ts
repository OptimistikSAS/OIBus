import JoiValidator from '../web-server/controllers/validators/joi.validator';
import ScanModeRepository from '../repository/config/scan-mode.repository';
import SouthConnectorRepository from '../repository/config/south-connector.repository';
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
    private southConnectorRepository: SouthConnectorRepository,
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

  async create(command: ScanModeCommandDTO, createdBy: string): Promise<ScanMode> {
    await this.validator.validate(scanModeSchema, command);

    // Check for unique name
    const existingScanModes = this.scanModeRepository.findAll();
    if (existingScanModes.some(sm => sm.name === command.name)) {
      throw new OIBusValidationError(`Scan mode name "${command.name}" already exists`);
    }

    const scanMode = this.scanModeRepository.create({ ...command, createdBy, updatedBy: createdBy });
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    return scanMode;
  }

  async update(scanModeId: string, command: ScanModeCommandDTO, updatedBy: string): Promise<void> {
    await this.validator.validate(scanModeSchema, command);
    const oldScanMode = this.findById(scanModeId);

    // Check for unique name (excluding current entity)
    if (command.name !== oldScanMode.name) {
      const existingScanModes = this.scanModeRepository.findAll();
      if (existingScanModes.some(sm => sm.id !== scanModeId && sm.name === command.name)) {
        throw new OIBusValidationError(`Scan mode name "${command.name}" already exists`);
      }
    }

    this.scanModeRepository.update(oldScanMode.id, { ...command, updatedBy });
    const newScanMode = this.findById(scanModeId);
    if (oldScanMode.cron !== newScanMode.cron) {
      await this.dataStreamEngine.updateScanMode(newScanMode);
    }
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
  }

  async delete(scanModeId: string): Promise<void> {
    const scanMode = this.findById(scanModeId);

    // Delete cache entries for this scan mode from all South connector cache tables
    const southConnectors = this.southConnectorRepository.findAllSouth();
    for (const southConnector of southConnectors) {
      const items = this.southConnectorRepository.findAllItemsForSouth(southConnector.id);
      const itemsUsingScanMode = items.filter(item => item.scanMode.id === scanMode.id);
      for (const item of itemsUsingScanMode) {
        this.southCacheRepository.deleteItemValue(southConnector.id, item.id);
      }
      // Also delete the scan mode entry itself (used in shared mode)
      this.southCacheRepository.deleteItemValue(southConnector.id, scanMode.id);
    }

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
