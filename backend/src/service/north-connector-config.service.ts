import ReloadService from './reload.service';
import EncryptionService from './encryption.service';
import JoiValidator from '../web-server/controllers/validators/joi.validator';
import ScanModeRepository from '../repository/scan-mode.repository';
import OIAnalyticsMessageService from './oia/oianalytics-message.service';
import { NorthConnectorCommandDTO, NorthConnectorDTO } from '../../../shared/model/north-connector.model';
import NorthConnectorRepository from '../repository/north-connector.repository';
import SubscriptionRepository from '../repository/subscription.repository';
import NorthService from './north.service';

export default class NorthConnectorConfigService {
  constructor(
    protected readonly validator: JoiValidator,
    private northConnectorRepository: NorthConnectorRepository,
    private subscriptionRepository: SubscriptionRepository,
    private scanModeRepository: ScanModeRepository,
    private northService: NorthService,
    private reloadService: ReloadService,
    private messageService: OIAnalyticsMessageService,
    private encryptionService: EncryptionService
  ) {}

  async create(command: NorthConnectorCommandDTO): Promise<NorthConnectorDTO> {
    const manifest = this.northService.getInstalledNorthManifests().find(northManifest => northManifest.id === command.type);

    if (!manifest) {
      throw new Error('North manifest does not exist');
    }

    await this.validator.validateSettings(manifest.settings, command.settings);

    if (!command.caching.scanModeId && !command.caching.scanModeName) {
      throw new Error(`Scan mode not specified`);
    } else if (!command.caching.scanModeId && command.caching.scanModeName) {
      const scanModes = this.scanModeRepository.findAll();
      const scanMode = scanModes.find(element => element.name === command.caching.scanModeName);
      if (!scanMode) {
        throw new Error(`Scan mode ${command.caching.scanModeName} not found`);
      }
      command.caching.scanModeId = scanMode.id;
    }

    command.settings = await this.encryptionService.encryptConnectorSecrets(command.settings, null, manifest.settings);

    const created = await this.reloadService.onCreateNorth(command);

    if (command.enabled) {
      await this.reloadService.oibusEngine.startNorth(created.id);
    }
    this.messageService.createFullConfigMessageIfNotPending();
    return created;
  }

  async update(northConnectorId: string, command: NorthConnectorCommandDTO) {
    const manifest = this.northService.getInstalledNorthManifests().find(northManifest => northManifest.id === command.type);

    if (!manifest) {
      throw new Error('North manifest does not exist');
    }

    await this.validator.validateSettings(manifest.settings, command.settings);

    const northConnector = this.northConnectorRepository.findById(northConnectorId);

    if (!northConnector) {
      throw new Error(`North connector ${northConnectorId} does not exist`);
    }

    command.settings = await this.encryptionService.encryptConnectorSecrets(command.settings, northConnector.settings, manifest.settings);

    await this.reloadService.onUpdateNorthSettings(northConnectorId, command);
    this.messageService.createFullConfigMessageIfNotPending();
  }

  async delete(northConnectorId: string) {
    const northConnector = this.northConnectorRepository.findById(northConnectorId);
    if (northConnector) {
      this.subscriptionRepository.deleteAllByNorth(northConnectorId);
      await this.reloadService.onDeleteNorth(northConnectorId);
      this.messageService.createFullConfigMessageIfNotPending();
    } else {
      throw new Error(`North connector ${northConnectorId} does not exist`);
    }
  }

  async start(northConnectorId: string) {
    const northConnector = this.northConnectorRepository.findById(northConnectorId);
    if (!northConnector) {
      throw new Error(`North connector ${northConnectorId} does not exist`);
    }

    await this.reloadService.onStartNorth(northConnectorId);
    this.messageService.createFullConfigMessageIfNotPending();
  }

  async stop(northConnectorId: string) {
    const northConnector = this.northConnectorRepository.findById(northConnectorId);
    if (!northConnector) {
      throw new Error(`North connector ${northConnectorId} does not exist`);
    }

    await this.reloadService.onStopNorth(northConnectorId);
    this.messageService.createFullConfigMessageIfNotPending();
  }
}
