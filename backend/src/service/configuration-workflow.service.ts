import ConfigurationWorkflowRepository from '../repository/config/configuration-workflow.repository';
import SouthConnectorRepository from '../repository/config/south-connector.repository';
import ScanModeRepository from '../repository/config/scan-mode.repository';
import { ConfigurationWorkflowCommand, ConfigurationWorkflowEntity } from '../model/configuration-workflow.model';
import { ConfigurationWorkflowCommandDTO } from '../../shared/model/configuration-workflow.model';
import { NotFoundError, OIBusValidationError } from '../model/types';
import { ScanMode } from '../model/scan-mode.model';
import { checkScanMode } from './utils';

/**
 * Service used for Configuration Workflows: CRUD orchestration only. Running a workflow (discovery, eligibility
 * filtering, identity-key diff, item/point create-update-orphan, remote push) is handled elsewhere, once that
 * piece is built.
 */
export default class ConfigurationWorkflowService {
  constructor(
    private readonly configurationWorkflowRepository: ConfigurationWorkflowRepository,
    private readonly southConnectorRepository: SouthConnectorRepository,
    private readonly scanModeRepository: ScanModeRepository
  ) {}

  findById(southId: string, workflowId: string): ConfigurationWorkflowEntity {
    this.checkSouthExists(southId);
    const workflow = this.configurationWorkflowRepository.findById(workflowId);
    if (!workflow) {
      throw new NotFoundError(`Configuration workflow "${workflowId}" not found`);
    }
    if (workflow.southId !== southId) {
      throw new NotFoundError(`Configuration workflow "${workflowId}" does not belong to south connector "${southId}"`);
    }
    return workflow;
  }

  findBySouthId(southId: string): Array<ConfigurationWorkflowEntity> {
    this.checkSouthExists(southId);
    return this.configurationWorkflowRepository.findBySouthId(southId);
  }

  create(southId: string, command: ConfigurationWorkflowCommandDTO, user: string): ConfigurationWorkflowEntity {
    this.checkSouthExists(southId);
    this.checkTargetItem(southId, command.targetItemId);
    this.checkMappingPresence(command);
    this.checkNameNotTaken(southId, command.name, null);
    const scanMode = this.resolveScanMode(command.scanModeId);

    const workflowCommand: ConfigurationWorkflowCommand = {
      name: command.name,
      southId,
      targetItemId: command.targetItemId,
      discoveryScope: command.discoveryScope,
      identityKeyFields: command.identityKeyFields,
      eligibilityFilter: command.eligibilityFilter,
      itemFieldMapping: command.itemFieldMapping,
      remoteFieldMapping: command.remoteFieldMapping,
      scanMode,
      enabled: command.enabled
    };
    return this.configurationWorkflowRepository.create(workflowCommand, user);
  }

  update(southId: string, workflowId: string, command: ConfigurationWorkflowCommandDTO, user: string): ConfigurationWorkflowEntity {
    this.findById(southId, workflowId); // Ownership check (throws if not found / not owned by this south)
    this.checkTargetItem(southId, command.targetItemId);
    this.checkMappingPresence(command);
    this.checkNameNotTaken(southId, command.name, workflowId);
    const scanMode = this.resolveScanMode(command.scanModeId);

    this.configurationWorkflowRepository.update(
      workflowId,
      {
        name: command.name,
        targetItemId: command.targetItemId,
        discoveryScope: command.discoveryScope,
        identityKeyFields: command.identityKeyFields,
        eligibilityFilter: command.eligibilityFilter,
        itemFieldMapping: command.itemFieldMapping,
        remoteFieldMapping: command.remoteFieldMapping,
        scanMode,
        enabled: command.enabled
      },
      user
    );

    const updated = this.configurationWorkflowRepository.findById(workflowId);
    if (!updated) {
      throw new NotFoundError(`Failed to update configuration workflow "${workflowId}"`);
    }
    return updated;
  }

  delete(southId: string, workflowId: string, user: string): void {
    this.findById(southId, workflowId); // Ownership check
    this.configurationWorkflowRepository.delete(workflowId, user);
  }

  private checkSouthExists(southId: string): void {
    const south = this.southConnectorRepository.findSouthById(southId);
    if (!south) {
      throw new NotFoundError(`South connector "${southId}" not found`);
    }
  }

  private checkTargetItem(southId: string, targetItemId: string | null): void {
    if (targetItemId === null) {
      return;
    }
    const item = this.southConnectorRepository.findItemById(southId, targetItemId);
    if (!item) {
      throw new NotFoundError(`South item "${targetItemId}" not found`);
    }
  }

  private checkMappingPresence(command: ConfigurationWorkflowCommandDTO): void {
    if (command.itemFieldMapping === null && command.remoteFieldMapping === null) {
      throw new OIBusValidationError('At least one of itemFieldMapping or remoteFieldMapping must be set');
    }
    // A remote-metadata-only workflow (itemFieldMapping null) never creates items, so it has no way to
    // learn which item a discovered record's metadata belongs to unless it already targets exactly one.
    if (command.itemFieldMapping === null && command.targetItemId === null) {
      throw new OIBusValidationError('targetItemId is required when itemFieldMapping is not set');
    }
  }

  private checkNameNotTaken(southId: string, name: string, ignoreWorkflowId: string | null): void {
    const existing = this.configurationWorkflowRepository.findByNameAndSouthId(name, southId);
    if (existing && existing.id !== ignoreWorkflowId) {
      throw new OIBusValidationError(`A configuration workflow with name "${name}" already exists for this south connector`);
    }
  }

  private resolveScanMode(scanModeId: string | null): ScanMode | null {
    if (!scanModeId) {
      return null;
    }
    const scanModes = this.scanModeRepository.findAll();
    return checkScanMode(scanModes, scanModeId, null);
  }
}
