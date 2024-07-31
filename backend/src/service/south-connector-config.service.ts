import {
  SouthConnectorDTO,
  SouthConnectorItemCommandDTO,
  SouthConnectorItemDTO,
  SouthConnectorWithItemsCommandDTO
} from '../../../shared/model/south-connector.model';
import ReloadService from './reload.service';
import EncryptionService from './encryption.service';
import SouthService from './south.service';
import JoiValidator from '../web-server/controllers/validators/joi.validator';
import SouthConnectorRepository from '../repository/south-connector.repository';
import ScanModeRepository from '../repository/scan-mode.repository';
import OIAnalyticsMessageService from './oia/oianalytics-message.service';
import SouthItemRepository from '../repository/south-item.repository';

export default class SouthConnectorConfigService {
  constructor(
    protected readonly validator: JoiValidator,
    private southConnectorRepository: SouthConnectorRepository,
    private southItemRepository: SouthItemRepository,
    private scanModeRepository: ScanModeRepository,
    private southService: SouthService,
    private reloadService: ReloadService,
    private messageService: OIAnalyticsMessageService,
    private encryptionService: EncryptionService
  ) {}

  async create(command: SouthConnectorWithItemsCommandDTO): Promise<SouthConnectorDTO> {
    const manifest = this.southService.getInstalledSouthManifests().find(southManifest => southManifest.id === command.south.type);

    if (!manifest) {
      throw new Error('South manifest does not exist');
    }
    await this.validator.validateSettings(manifest.settings, command.south.settings);

    // Check if item settings match the item schema, throw an error otherwise
    for (const item of command.items) {
      await this.validator.validateSettings(manifest.items.settings, item.settings);
      if (!item.scanModeId && !item.scanModeName) {
        throw new Error(`Scan mode not specified for item ${item.name}`);
      } else if (!item.scanModeId && item.scanModeName) {
        const scanModes = this.scanModeRepository.findAll();
        const scanMode = scanModes.find(element => element.name === item.scanModeName);
        if (!scanMode) {
          throw new Error(`Scan mode ${item.scanModeName} not found for item ${item.name}`);
        }
        item.scanModeId = scanMode.id;
      }
    }

    if (manifest.modes.forceMaxInstantPerItem) {
      command.south.history.maxInstantPerItem = true;
    }

    command.south.settings = await this.encryptionService.encryptConnectorSecrets(command.south.settings, null, manifest.settings);
    const southConnector = await this.reloadService.onCreateSouth(command.south);
    this.reloadService.onCreateOrUpdateSouthItems(southConnector, command.items, []);

    if (command.south.enabled) {
      await this.reloadService.oibusEngine.startSouth(southConnector.id);
    }
    this.messageService.createFullConfigMessage();
    return southConnector;
  }

  async update(southConnectorId: string, command: SouthConnectorWithItemsCommandDTO) {
    const manifest = this.southService.getInstalledSouthManifests().find(southManifest => southManifest.id === command.south.type);

    if (!manifest) {
      throw new Error('South manifest does not exist');
    }

    await this.validator.validateSettings(manifest.settings, command.south.settings);
    // Check if item settings match the item schema, throw an error otherwise
    for (const item of command.items) {
      await this.validator.validateSettings(manifest.items.settings, item.settings);
    }

    const southConnector = this.southConnectorRepository.findById(southConnectorId);

    if (!southConnector) {
      throw new Error(`South connector ${southConnectorId} does not exist`);
    }

    command.south.settings = await this.encryptionService.encryptConnectorSecrets(
      command.south.settings,
      southConnector.settings,
      manifest.settings
    );

    const itemsToAdd = command.items.filter(item => !item.id);
    const itemsToUpdate = command.items.filter(item => item.id);
    for (const itemId of command.itemIdsToDelete) {
      await this.reloadService.onDeleteSouthItem(itemId);
    }
    await this.reloadService.onUpdateSouth(southConnector, command.south, itemsToAdd, itemsToUpdate);
    this.messageService.createFullConfigMessage();
  }

  async delete(southConnectorId: string) {
    const southConnector = this.southConnectorRepository.findById(southConnectorId);

    if (!southConnector) {
      throw new Error(`South connector ${southConnectorId} does not exist`);
    }
    await this.reloadService.onDeleteSouth(southConnectorId);
    this.messageService.createFullConfigMessage();
  }

  async start(southConnectorId: string) {
    const southConnector = this.southConnectorRepository.findById(southConnectorId);
    if (!southConnector) {
      throw new Error(`South connector ${southConnectorId} does not exist`);
    }

    await this.reloadService.onStartSouth(southConnectorId);
    this.messageService.createFullConfigMessage();
  }

  async stop(southConnectorId: string) {
    const southConnector = this.southConnectorRepository.findById(southConnectorId);
    if (!southConnector) {
      throw new Error(`South connector ${southConnectorId} does not exist`);
    }

    await this.reloadService.onStopSouth(southConnectorId);
    this.messageService.createFullConfigMessage();
  }

  async createItem(southConnectorId: string, command: SouthConnectorItemCommandDTO): Promise<SouthConnectorItemDTO> {
    const southConnector = this.southConnectorRepository.findById(southConnectorId);
    if (!southConnector) {
      throw new Error(`South connector ${southConnectorId} does not exist`);
    }

    const manifest = this.southService.getInstalledSouthManifests().find(southManifest => southManifest.id === southConnector.type);
    if (!manifest) {
      throw new Error('South manifest does not exist');
    }

    await this.validator.validateSettings(manifest.items.settings, command.settings);

    const southItem = await this.reloadService.onCreateSouthItem(southConnectorId, command);
    this.messageService.createFullConfigMessage();
    return southItem;
  }

  async updateItem(southConnectorId: string, itemId: string, command: SouthConnectorItemCommandDTO): Promise<void> {
    const southConnector = this.southConnectorRepository.findById(southConnectorId);

    if (!southConnector) {
      throw new Error(`South connector ${southConnectorId} does not exist`);
    }

    const manifest = this.southService.getInstalledSouthManifests().find(southManifest => southManifest.id === southConnector.type);

    if (!manifest) {
      throw new Error('South manifest does not exist');
    }

    const southItem = this.southItemRepository.findById(itemId);

    if (!southItem) {
      throw new Error(`South item with Id ${itemId} doesn't exist`);
    }

    await this.validator.validateSettings(manifest.items.settings, command.settings);
    await this.reloadService.onUpdateSouthItemSettings(southConnectorId, southItem, command);
    this.messageService.createFullConfigMessage();
  }

  async deleteItem(southConnectorId: string, itemId: string) {
    await this.reloadService.onDeleteSouthItem(itemId);
    await this.reloadService.oibusEngine.onSouthItemsChange(southConnectorId);
    this.messageService.createFullConfigMessage();
  }

  async deleteAllItems(southConnectorId: string) {
    await this.reloadService.onDeleteAllSouthItems(southConnectorId);
    await this.reloadService.oibusEngine.onSouthItemsChange(southConnectorId);
    this.messageService.createFullConfigMessage();
  }

  async enableItem(itemId: string) {
    await this.reloadService.onEnableSouthItem(itemId);
    this.messageService.createFullConfigMessage();
  }

  async disableItem(itemId: string) {
    await this.reloadService.onDisableSouthItem(itemId);
    this.messageService.createFullConfigMessage();
  }
}
