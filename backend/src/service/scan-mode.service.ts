import { ScanModeCommandDTO, ValidatedCronExpression } from '../../shared/model/api/scan-mode.model';

import DataStreamEngine from '../engine/data-stream-engine';
import type { IOIAnalyticsMessageService } from '../model/oianalytics-message.model';
import { ScanMode } from '../model/scan-mode.model';
import { NotFoundError, OIBusValidationError } from '../model/types';
import SouthCacheRepository from '../repository/cache/south-cache.repository';
import ScanModeRepository from '../repository/config/scan-mode.repository';
import SouthConnectorRepository from '../repository/config/south-connector.repository';
import JoiValidator from '../web-server/controllers/validators/joi.validator';
import { scanModeSchema } from '../web-server/controllers/validators/oibus-validation-schema';
import { hasScheduleChanged } from './scan-mode.utils';
import { validateCronExpression } from './utils';
export { toScanModeDTO } from './scan-mode-dto.utils';

export default class ScanModeService {
  constructor(
    protected readonly validator: JoiValidator,
    private scanModeRepository: ScanModeRepository,
    private southConnectorRepository: SouthConnectorRepository,
    private southCacheRepository: SouthCacheRepository,
    private oIAnalyticsMessageService: IOIAnalyticsMessageService,
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

    const scanMode = this.scanModeRepository.create(command, createdBy);
    await this.dataStreamEngine.createScanMode(scanMode);
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

    this.scanModeRepository.update(oldScanMode.id, command, updatedBy);
    const newScanMode = this.findById(scanModeId);
    if (hasScheduleChanged(oldScanMode, newScanMode)) {
      await this.dataStreamEngine.updateScanMode(newScanMode);
    }
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
  }

  delete(scanModeId: string, userId: string): void {
    const scanMode = this.findById(scanModeId);
    this.scanModeRepository.delete(scanMode.id, userId);
    this.dataStreamEngine.deleteScanMode(scanMode.id);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
  }

  verifyCron(command: { cron: string }): ValidatedCronExpression {
    return validateCronExpression(command.cron);
  }
}
