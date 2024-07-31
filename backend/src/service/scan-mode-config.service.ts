import ReloadService from './reload.service';
import JoiValidator from '../web-server/controllers/validators/joi.validator';
import ScanModeRepository from '../repository/scan-mode.repository';
import OIAnalyticsMessageService from './oia/oianalytics-message.service';
import { ScanModeCommandDTO, ScanModeDTO } from '../../../shared/model/scan-mode.model';
import { scanModeSchema } from '../web-server/controllers/validators/oibus-validation-schema';
import SouthCacheRepository from '../repository/south-cache.repository';

export default class ScanModeConfigService {
  constructor(
    protected readonly validator: JoiValidator,
    private scanModeRepository: ScanModeRepository,
    private southCacheRepository: SouthCacheRepository,
    private reloadService: ReloadService,
    private messageService: OIAnalyticsMessageService
  ) {}

  async create(command: ScanModeCommandDTO): Promise<ScanModeDTO> {
    await this.validator.validate(scanModeSchema, command);
    const scanMode = this.scanModeRepository.create(command);
    this.messageService.createFullConfigMessage();
    return scanMode;
  }

  async update(scanModeId: string, command: ScanModeCommandDTO) {
    await this.validator.validate(scanModeSchema, command);
    await this.reloadService.onUpdateScanMode(scanModeId, command);
    this.messageService.createFullConfigMessage();
  }

  async delete(scanModeId: string) {
    const scanMode = this.scanModeRepository.findById(scanModeId);
    if (!scanMode) {
      throw new Error(`Scan mode with ID ${scanModeId} does not exist`);
    }

    this.scanModeRepository.delete(scanModeId);
    this.southCacheRepository.deleteAllByScanMode(scanModeId);
    this.messageService.createFullConfigMessage();
  }
}
