import WorkflowRunRepository from '../repository/config/workflow-run.repository';
import ItemPointMetadataRepository from '../repository/config/item-point-metadata.repository';
import SouthConnectorRepository from '../repository/config/south-connector.repository';
import type SouthConnector from '../south/south-connector';
import { isEligible, computeIdentityKey, resolveFieldMapping } from './configuration-workflow.utils';
import { ConfigurationWorkflowEntity } from '../model/configuration-workflow.model';
import {
  WorkflowPreviewEntryDTO,
  WorkflowPreviewEntryStatus,
  WorkflowPreviewResultDTO
} from '../../shared/model/configuration-workflow.model';
import { WorkflowRunCounts, WorkflowRunEntity } from '../model/workflow-run.model';
import { ItemPointMetadataEntity, ItemPointMetadataWrite } from '../model/item-point-metadata.model';
import { SouthConnectorItemEntity } from '../model/south-connector.model';
import { SouthConnectorItemCommandDTO } from '../../shared/model/south-connector.model';
import { SouthItemSettings, SouthSettings } from '../../shared/model/south-settings.model';
import { OIBusRecord } from '../../shared/model/engine.model';
import { Page } from '../../shared/model/types';
import { OIBusValidationError } from '../model/types';

// Minimal slices of SouthService/DataStreamEngine this orchestrator actually calls - kept as local
// interfaces (matching the ISouthService/IHistoryEngine precedent in history-query.service.ts) so a
// plain SouthServiceMock/DataStreamEngineMock satisfies them structurally, without extending the real
// classes just for testing.
interface IConfigurationWorkflowSouthService {
  createItem(
    southId: string,
    command: SouthConnectorItemCommandDTO,
    createdBy: string
  ): Promise<SouthConnectorItemEntity<SouthItemSettings>>;
  updateItem(southId: string, itemId: string, command: SouthConnectorItemCommandDTO, updatedBy: string): Promise<void>;
}

interface IDataStreamEngine {
  hasSouth(southId: string): boolean;
  getSouth(southId: string): { south: SouthConnector<SouthSettings, SouthItemSettings> };
}

interface IConfigurationWorkflowService {
  /** Ownership check included - throws NotFoundError if the workflow doesn't exist or belongs elsewhere. */
  findById(southId: string, workflowId: string): ConfigurationWorkflowEntity;
}

const ZERO_COUNTS: WorkflowRunCounts = {
  discoveredCount: 0,
  eligibleCount: 0,
  createdCount: 0,
  updatedCount: 0,
  disabledCount: 0,
  pushedCount: 0
};

// The known ItemPointMetadataWrite columns a remoteFieldMapping can target directly - anything else
// falls into remoteMetadataExtra instead of being silently dropped.
const KNOWN_REMOTE_FIELDS = ['description', 'unit', 'minAcceptableValue', 'maxAcceptableValue', 'resolution', 'resamplingMethod'];

/**
 * Runs a Configuration Workflow: Trigger (manual only, for now - scheduling is a later milestone) ->
 * Retrieve (the connector's `discover()`) -> Decide (`isEligible` + identity-key diff against the
 * previous run's `item_point_metadata`) -> Act (create/update/orphan items, and/or write remote point
 * metadata) -> a `workflow_runs` record either way. `ConfigurationWorkflowService` stays CRUD-only; this
 * is the "elsewhere" its own doc comment refers to.
 *
 * Discovery always runs on the engine's live, already-connected south instance - never a throwaway one -
 * since a workflow's side effects (real item creation) make an about-to-vanish connection the wrong
 * model, and reusing the live instance is required for any connector that only opens a session once
 * (e.g. OPC-UA).
 */
export default class ConfigurationWorkflowRunService {
  constructor(
    private readonly configurationWorkflowService: IConfigurationWorkflowService,
    private readonly workflowRunRepository: WorkflowRunRepository,
    private readonly itemPointMetadataRepository: ItemPointMetadataRepository,
    private readonly southConnectorRepository: SouthConnectorRepository,
    private readonly southService: IConfigurationWorkflowSouthService,
    private readonly engine: IDataStreamEngine
  ) {}

  async runNow(southId: string, workflowId: string, triggeredBy: string): Promise<WorkflowRunEntity> {
    const workflow = this.configurationWorkflowService.findById(southId, workflowId); // Ownership check
    const run = this.workflowRunRepository.start(workflowId, 'manual', triggeredBy);
    const counts: WorkflowRunCounts = { ...ZERO_COUNTS };

    try {
      const { eligibleByKey, previousPoints } = await this.retrieve(southId, workflow);
      counts.discoveredCount = eligibleByKey.discoveredCount;
      counts.eligibleCount = eligibleByKey.map.size;

      const previousByKey = new Map(previousPoints.map(point => [point.discoveredEntryKey, point]));

      for (const [key, record] of eligibleByKey.map) {
        const previous = previousByKey.get(key) ?? null;
        if (previous !== null && previous.status === 'active' && isSameMetadata(previous.discoveredMetadata, record)) {
          continue; // Unchanged - nothing to act on, not even a metadata-snapshot refresh.
        }
        await this.actOnRecord(southId, workflow, key, record, previous, triggeredBy, counts);
      }

      for (const point of previousPoints) {
        if (point.status === 'orphaned' || eligibleByKey.map.has(point.discoveredEntryKey)) {
          continue;
        }
        this.orphanPoint(southId, point, triggeredBy, counts);
      }

      this.workflowRunRepository.complete(run.id, counts);
    } catch (error) {
      this.workflowRunRepository.fail(run.id, error instanceof Error ? error.message : String(error), counts);
      throw error;
    }

    return this.workflowRunRepository.findById(run.id)!;
  }

  /**
   * A dry run: identical Retrieve + Decide as `runNow`, but Act never runs and nothing is persisted -
   * no items, no point metadata, no `workflow_runs` record. Discovery itself is a real round-trip to the
   * data source, so this costs what a real run costs, minus the writes.
   */
  async preview(southId: string, workflowId: string): Promise<WorkflowPreviewResultDTO> {
    const workflow = this.configurationWorkflowService.findById(southId, workflowId); // Ownership check
    const { eligibleByKey, previousPoints } = await this.retrieve(southId, workflow);
    const previousByKey = new Map(previousPoints.map(point => [point.discoveredEntryKey, point]));

    const entries: Array<WorkflowPreviewEntryDTO> = [];
    for (const [key, record] of eligibleByKey.map) {
      const previous = previousByKey.get(key) ?? null;
      entries.push({ key, status: classifyEntry(previous, record), record, previousMetadata: previous?.discoveredMetadata ?? null });
    }
    for (const point of previousPoints) {
      if (point.status === 'orphaned' || eligibleByKey.map.has(point.discoveredEntryKey)) {
        continue;
      }
      entries.push({ key: point.discoveredEntryKey, status: 'missing', record: null, previousMetadata: point.discoveredMetadata });
    }

    return { discoveredCount: eligibleByKey.discoveredCount, eligibleCount: eligibleByKey.map.size, entries };
  }

  findRuns(southId: string, workflowId: string, page: number): Page<WorkflowRunEntity> {
    this.configurationWorkflowService.findById(southId, workflowId); // Ownership check
    return this.workflowRunRepository.findByWorkflowId(workflowId, page);
  }

  /** Trigger + Retrieve + Decide's eligibility filter - shared by `runNow` and `preview`. */
  private async retrieve(
    southId: string,
    workflow: ConfigurationWorkflowEntity
  ): Promise<{
    eligibleByKey: { map: Map<string, OIBusRecord>; discoveredCount: number };
    previousPoints: Array<ItemPointMetadataEntity>;
  }> {
    if (!this.engine.hasSouth(southId)) {
      throw new OIBusValidationError(`South connector "${southId}" is not running - start it before running a workflow`);
    }
    const south = this.engine.getSouth(southId).south;
    if (!south.hasConfigurationDiscovery()) {
      throw new OIBusValidationError(`South connector "${southId}" does not support configuration discovery`);
    }

    const records = await south.discover(workflow.discoveryScope);

    // Later duplicates of the same identity key overwrite earlier ones - a workflow's identityKeyFields
    // are expected to actually identify records uniquely; a collision is a misconfiguration, not
    // something worth failing the whole run over.
    const map = new Map<string, OIBusRecord>();
    for (const record of records) {
      if (isEligible(record, workflow.eligibilityFilter)) {
        map.set(computeIdentityKey(record, workflow.identityKeyFields), record);
      }
    }

    return {
      eligibleByKey: { map, discoveredCount: records.length },
      previousPoints: this.itemPointMetadataRepository.findAllByWorkflow(workflow.id)
    };
  }

  private async actOnRecord(
    southId: string,
    workflow: ConfigurationWorkflowEntity,
    key: string,
    record: OIBusRecord,
    previous: ItemPointMetadataEntity | null,
    triggeredBy: string,
    counts: WorkflowRunCounts
  ): Promise<void> {
    let southItemId: string;

    if (workflow.itemFieldMapping !== null) {
      const resolved = resolveFieldMapping(record, workflow.itemFieldMapping);

      if (workflow.targetItemId !== null) {
        // Single pre-existing item: itemFieldMapping only ever refreshes it, never creates.
        southItemId = workflow.targetItemId;
        const existingItem = this.southConnectorRepository.findItemById(southId, southItemId)!;
        await this.southService.updateItem(southId, southItemId, buildItemCommand(resolved, existingItem), triggeredBy);
        counts.updatedCount++;
      } else if (previous !== null) {
        // Self-scoped, re-discovered entry: update the item this workflow previously created for it.
        southItemId = previous.southItemId;
        const existingItem = this.southConnectorRepository.findItemById(southId, southItemId)!;
        await this.southService.updateItem(southId, southItemId, buildItemCommand(resolved, existingItem), triggeredBy);
        counts.updatedCount++;
      } else {
        // Self-scoped, brand new entry: create and claim ownership.
        const created = await this.southService.createItem(southId, buildItemCommand(resolved, null), triggeredBy);
        this.southConnectorRepository.claimItemForWorkflow(southId, created.id, workflow.id, triggeredBy);
        southItemId = created.id;
        counts.createdCount++;
      }
    } else {
      // Remote-metadata-only workflow: never touches items. targetItemId is guaranteed non-null here -
      // ConfigurationWorkflowService rejects itemFieldMapping: null with targetItemId: null at creation.
      southItemId = workflow.targetItemId!;
    }

    if (workflow.remoteFieldMapping !== null) {
      const item = this.southConnectorRepository.findItemById(southId, southItemId);
      const remoteContext = { ...record, item: item ? { id: item.id, name: item.name } : null };
      const write = buildItemPointMetadataWrite(
        resolveFieldMapping(remoteContext, workflow.remoteFieldMapping),
        workflow.id,
        southItemId,
        key,
        record
      );
      if (previous !== null) {
        this.itemPointMetadataRepository.update(previous.id, write);
      } else {
        this.itemPointMetadataRepository.create(write);
      }
      // pushedCount is reserved for the OIAnalytics push itself (a later milestone) - writing this row
      // locally isn't a push yet.
    } else if (previous === null) {
      // itemFieldMapping-only workflow: still needs a tracking row, so the next run's diff has
      // something to compare against, even though there's no remote metadata to store.
      this.itemPointMetadataRepository.create(emptyPointWrite(workflow.id, southItemId, key, record));
    } else {
      // Refresh the snapshot even without remote metadata mapped, so the next run's "unchanged" check
      // compares against the latest discovered content instead of a stale one.
      this.itemPointMetadataRepository.update(previous.id, { ...toWrite(previous), discoveredMetadata: record });
    }
  }

  private orphanPoint(southId: string, point: ItemPointMetadataEntity, triggeredBy: string, counts: WorkflowRunCounts): void {
    this.itemPointMetadataRepository.markOrphaned(point.id);
    // An item only auto-disables once *all* of its points have orphaned - re-querying after marking
    // this one lets a single findBySouthItemId check cover both the 1:1/1:N cases (this was the item's
    // only point) and the N:1 SQL case (siblings from other columns may still be active).
    const siblings = this.itemPointMetadataRepository.findBySouthItemId(point.southItemId);
    if (siblings.every(sibling => sibling.status === 'orphaned')) {
      this.southConnectorRepository.disableItemWithReason(
        southId,
        point.southItemId,
        'Configuration workflow no longer discovers this entry',
        triggeredBy
      );
      counts.disabledCount++;
    }
  }
}

// Mirrors runNow's Decide-step logic exactly, but as a pure classification instead of driving actions -
// `preview` uses this; `runNow` only needs the unchanged/not-unchanged split, computed inline.
function classifyEntry(previous: ItemPointMetadataEntity | null, record: OIBusRecord): WorkflowPreviewEntryStatus {
  if (previous === null) {
    return 'new';
  }
  if (previous.status === 'orphaned') {
    return 'reactivated';
  }
  return isSameMetadata(previous.discoveredMetadata, record) ? 'unchanged' : 'changed';
}

function isSameMetadata(previous: Record<string, unknown>, current: OIBusRecord): boolean {
  const previousKeys = Object.keys(previous).sort();
  const currentKeys = Object.keys(current).sort();
  if (previousKeys.length !== currentKeys.length || previousKeys.some((key, index) => key !== currentKeys[index])) {
    return false;
  }
  return previousKeys.every(key => previous[key] === current[key]);
}

function buildItemCommandBase(existingItem: SouthConnectorItemEntity<SouthItemSettings> | null): Record<string, unknown> {
  if (existingItem) {
    return {
      id: existingItem.id,
      enabled: existingItem.enabled,
      name: existingItem.name,
      settings: { ...existingItem.settings },
      scanModeId: existingItem.scanMode?.id ?? null,
      scanModeName: null,
      groupId: existingItem.group?.id ?? null,
      groupName: null,
      syncWithGroup: existingItem.syncWithGroup,
      maxReadInterval: existingItem.maxReadInterval,
      readDelay: existingItem.readDelay,
      startTimeOffset: existingItem.startTimeOffset,
      endTimeOffset: existingItem.endTimeOffset,
      recoveryStrategy: existingItem.recoveryStrategy
    };
  }
  return {
    id: null,
    enabled: true,
    name: '',
    settings: {},
    scanModeId: null,
    scanModeName: null,
    groupId: null,
    groupName: null,
    syncWithGroup: false,
    maxReadInterval: null,
    readDelay: null,
    startTimeOffset: null,
    endTimeOffset: null,
    recoveryStrategy: null
  };
}

// `itemFieldMapping` keys are dot paths into the item command shape (`name`, `settings.nodeId`, ...) -
// only `settings` nests, so one level of splitting is all this needs.
function setDeep(target: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let cursor = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    const next = cursor[key];
    if (typeof next !== 'object' || next === null) {
      cursor[key] = {};
    }
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1]] = value;
}

// The resulting object is cast to SouthConnectorItemCommandDTO - a union typed per connector's own
// settings shape - because a workflow's mapping is inherently dynamic across connector types; the same
// validation every hand-built command goes through (SouthService.createItem/updateItem's
// validateSettings against the connector's manifest) still applies on the way in.
function buildItemCommand(
  resolved: Record<string, unknown>,
  existingItem: SouthConnectorItemEntity<SouthItemSettings> | null
): SouthConnectorItemCommandDTO {
  const base = buildItemCommandBase(existingItem);
  for (const [path, value] of Object.entries(resolved)) {
    setDeep(base, path, value);
  }
  return base as unknown as SouthConnectorItemCommandDTO;
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const numericValue = Number(value);
  return Number.isNaN(numericValue) ? null : numericValue;
}

function buildItemPointMetadataWrite(
  resolved: Record<string, unknown>,
  workflowId: string,
  southItemId: string,
  discoveredEntryKey: string,
  discoveredMetadata: OIBusRecord
): ItemPointMetadataWrite {
  const remoteMetadataExtra: Record<string, unknown> = {};
  for (const [targetKey, value] of Object.entries(resolved)) {
    if (!KNOWN_REMOTE_FIELDS.includes(targetKey)) {
      remoteMetadataExtra[targetKey] = value;
    }
  }
  return {
    workflowId,
    southItemId,
    discoveredEntryKey,
    discoveredMetadata,
    description: (resolved.description as string | undefined) ?? null,
    unit: (resolved.unit as string | undefined) ?? null,
    minAcceptableValue: toNumberOrNull(resolved.minAcceptableValue),
    maxAcceptableValue: toNumberOrNull(resolved.maxAcceptableValue),
    resolution: toNumberOrNull(resolved.resolution),
    resamplingMethod: (resolved.resamplingMethod as string | undefined) ?? null,
    remoteMetadataExtra: Object.keys(remoteMetadataExtra).length > 0 ? remoteMetadataExtra : null
  };
}

function emptyPointWrite(
  workflowId: string,
  southItemId: string,
  discoveredEntryKey: string,
  discoveredMetadata: OIBusRecord
): ItemPointMetadataWrite {
  return {
    workflowId,
    southItemId,
    discoveredEntryKey,
    discoveredMetadata,
    description: null,
    unit: null,
    minAcceptableValue: null,
    maxAcceptableValue: null,
    resolution: null,
    resamplingMethod: null,
    remoteMetadataExtra: null
  };
}

function toWrite(point: ItemPointMetadataEntity): Omit<ItemPointMetadataWrite, 'workflowId' | 'southItemId'> {
  return {
    discoveredEntryKey: point.discoveredEntryKey,
    discoveredMetadata: point.discoveredMetadata,
    description: point.description,
    unit: point.unit,
    minAcceptableValue: point.minAcceptableValue,
    maxAcceptableValue: point.maxAcceptableValue,
    resolution: point.resolution,
    resamplingMethod: point.resamplingMethod,
    remoteMetadataExtra: point.remoteMetadataExtra
  };
}
