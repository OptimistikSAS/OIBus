import ConfigurationWorkflowRepository from '../repository/config/configuration-workflow.repository';
import SouthConnectorRepository from '../repository/config/south-connector.repository';
import ScanModeRepository from '../repository/config/scan-mode.repository';
import { ConfigurationWorkflowCommand, ConfigurationWorkflowEntity } from '../model/configuration-workflow.model';
import { ConfigurationWorkflowCommandDTO } from '../../shared/model/configuration-workflow.model';
import { NotFoundError, OIBusValidationError } from '../model/types';
import { ScanMode } from '../model/scan-mode.model';
import { checkScanMode } from './utils';
import type DataStreamEngine from '../engine/data-stream-engine';

/** Minimal slice of OIAnalyticsRegistrationService this service actually calls - see the
 *  IConfigurationWorkflowSouthService/IDataStreamEngine precedent in configuration-workflow-run.service.ts. */
interface IOIAnalyticsRegistrationService {
  getRegistrationSettings(): { status: string } | null;
}

/**
 * Service used for Configuration Workflows: CRUD orchestration only. Running a workflow (discovery, eligibility
 * filtering, identity-key diff, item create-update-orphan and/or OIAnalytics push) is handled elsewhere, in
 * ConfigurationWorkflowRunService.
 */
export default class ConfigurationWorkflowService {
  constructor(
    private readonly configurationWorkflowRepository: ConfigurationWorkflowRepository,
    private readonly southConnectorRepository: SouthConnectorRepository,
    private readonly scanModeRepository: ScanModeRepository,
    private readonly engine: DataStreamEngine,
    private readonly oIAnalyticsRegistrationService: IOIAnalyticsRegistrationService
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
    this.checkMode(command);
    this.checkNameNotTaken(southId, command.name, null);
    const scanMode = this.resolveScanMode(command.scanModeId);

    const workflowCommand: ConfigurationWorkflowCommand = {
      name: command.name,
      southId,
      discoveryScope: command.discoveryScope,
      identityKeyFields: command.identityKeyFields,
      eligibilityFilter: command.eligibilityFilter,
      itemFieldMapping: command.itemFieldMapping,
      pushToOIAnalytics: command.pushToOIAnalytics,
      scanMode,
      enabled: command.enabled
    };
    const created = this.configurationWorkflowRepository.create(workflowCommand, user);
    this.engine.reloadWorkflows(southId);
    return created;
  }

  update(southId: string, workflowId: string, command: ConfigurationWorkflowCommandDTO, user: string): ConfigurationWorkflowEntity {
    this.findById(southId, workflowId); // Ownership check (throws if not found / not owned by this south)
    this.checkMode(command);
    this.checkNameNotTaken(southId, command.name, workflowId);
    const scanMode = this.resolveScanMode(command.scanModeId);

    this.configurationWorkflowRepository.update(
      workflowId,
      {
        name: command.name,
        discoveryScope: command.discoveryScope,
        identityKeyFields: command.identityKeyFields,
        eligibilityFilter: command.eligibilityFilter,
        itemFieldMapping: command.itemFieldMapping,
        pushToOIAnalytics: command.pushToOIAnalytics,
        scanMode,
        enabled: command.enabled
      },
      user
    );

    const updated = this.configurationWorkflowRepository.findById(workflowId);
    if (!updated) {
      throw new NotFoundError(`Failed to update configuration workflow "${workflowId}"`);
    }
    this.engine.reloadWorkflows(southId);
    return updated;
  }

  delete(southId: string, workflowId: string, user: string): void {
    this.findById(southId, workflowId); // Ownership check
    this.configurationWorkflowRepository.delete(workflowId, user);
    this.engine.reloadWorkflows(southId);
  }

  private checkSouthExists(southId: string): void {
    const south = this.southConnectorRepository.findSouthById(southId);
    if (!south) {
      throw new NotFoundError(`South connector "${southId}" not found`);
    }
  }

  /** Exactly one of itemFieldMapping (local)/pushToOIAnalytics (remote) applies - never both, never neither.
   *  Remote additionally requires OIBus to already be registered with OIAnalytics: a workflow that can never
   *  actually push anything isn't a workflow anyone should be able to save, let alone run. */
  private checkMode(command: ConfigurationWorkflowCommandDTO): void {
    if (command.itemFieldMapping !== null && command.pushToOIAnalytics) {
      throw new OIBusValidationError('A configuration workflow cannot both create/update items and push to OIAnalytics');
    }
    if (command.itemFieldMapping === null && !command.pushToOIAnalytics) {
      throw new OIBusValidationError('A configuration workflow must either create/update items or push to OIAnalytics');
    }
    if (command.pushToOIAnalytics && this.oIAnalyticsRegistrationService.getRegistrationSettings()?.status !== 'REGISTERED') {
      throw new OIBusValidationError('OIBus must be registered with OIAnalytics to push a configuration workflow result');
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
