import { Clipboard } from '@angular/cdk/clipboard';
import { NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  Injector,
  signal,
  viewChild,
  WritableSignal
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  FormsModule,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators
} from '@angular/forms';

import { NgbActiveModal, NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { debounceTime, filter, Observable } from 'rxjs';

import { ConfigurationWorkflowCommandDTO, WorkflowPreviewResultDTO } from '@oibus/shared/api/configuration-workflow.model';
import { ScanModeDTO } from '@oibus/shared/api/scan-mode.model';
import { SouthConnectorItemCommandDTO } from '@oibus/shared/api/south-connector.model';
import { OIBusRecord, OIBusRecordListContent } from '@oibus/shared/common/content.model';
import {
  OIBusAttribute,
  OIBusAttributeType,
  OIBusEnablingCondition,
  OIBusObjectAttribute,
  OIBusScanModeAttribute
} from '@oibus/shared/connector/form.model';
import { SouthConnectorManifest } from '@oibus/shared/connector/south-manifest.model';
import { SouthItemSettings, SouthSettings } from '@oibus/shared/connector/south-settings.model';
import { RECORD_FILTER_OPERATORS, RecordFilterCondition, RecordFilterOperator } from '@oibus/shared/domain/configuration-workflow.model';

import { ConfigurationWorkflowService } from '../../../services/configuration-workflow.service';
import { EngineService } from '../../../services/engine.service';
import { SouthConnectorService } from '../../../services/south-connector.service';
import { ExploreTreeComponent, SouthExploreApi } from '../../../shared/explore-tree/explore-tree.component';
import { extractErrorMessage } from '../../../shared/extract-error-message';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../../../shared/form/form-validation-directives';
import { OibCodeBlockComponent } from '../../../shared/form/oib-code-block/oib-code-block.component';
import { trackControl } from '../../../shared/form/tracked-control';
import { ModalService } from '../../../shared/modal.service';
import { ModalStepsComponent } from '../../../shared/modal-steps/modal-steps.component';
import { NotificationService } from '../../../shared/notification.service';
import { ObservableState, SaveButtonComponent } from '../../../shared/save-button/save-button.component';
import { TransformerTestResultComponent } from '../../../shared/transformer-test-result/transformer-test-result.component';
import { UnsavedChangesConfirmationService } from '../../../shared/unsaved-changes-confirmation.service';
import { DiscoveredItemsReviewComponent } from '../../south-items/discovered-items-review/discovered-items-review.component';
import { openGroupModal, SouthItemGroup, SouthItemGroups } from '../../south-items/south-item-groups';
import { TEMP_ID_PREFIX } from '../workflow-command';
import { WorkflowPreviewComponent } from '../workflow-preview/workflow-preview.component';
import { WorkflowRecordsPreviewComponent } from '../workflow-records-preview/workflow-records-preview.component';

// 'group-select' is not part of the manifest's own attribute-type vocabulary - it tags the
// historian groupId field, whose options come from this south connector's item groups rather
// than a static list.
type MappableFieldType = OIBusAttributeType | 'group-select';

/** One manifest enabling condition, resolved to full item-root-relative paths (the manifest's own
 *  referralPathFromRoot/targetPathFromRoot are only relative to the object that declares them - see
 *  buildItemMappableFields). A field is shown only once every rule covering it (its own, plus any
 *  inherited from an enclosing object) evaluates true against the referral field's current mapped value. */
interface FieldEnablingRule {
  referralPath: string;
  values: OIBusEnablingCondition['values'];
  operator?: OIBusEnablingCondition['operator'];
}

/** One field a mapping can target - a path into the item command shape, its translated label, and enough type
 *  information to render a type-appropriate constant input (checkbox, select, ...) instead of a bare text box. */
interface MappableField {
  path: string;
  translationKey: string;
  attributeType: MappableFieldType;
  /** Only for 'string-select' - the manifest's own selectableValues. */
  selectableValues?: Array<string>;
  /** Every enabling condition gating this field's visibility (own + inherited from an ancestor object) -
   *  all must pass for the field to be shown at all. Empty for fields outside the manifest tree. */
  enablingRules?: Array<FieldEnablingRule>;
  /** Translation keys of every object this field is nested under, beyond the top-level `settings` wrapper
   *  every settings.* field already implies (e.g. ['...ha-mode.title'] for settings.haMode.aggregate) -
   *  shown as breadcrumb context so a deeply-nested field isn't just a bare, ambiguous leaf name. */
  ancestorLabelKeys?: Array<string>;
  /** True for a manifest attribute carrying a REQUIRED validator (e.g. name, scanMode) - the same source
   *  of truth EditSouthItemModalComponent's own form validators read from. Checked at save time so a
   *  workflow can't be saved half-mapped in a way item creation would only reject later, at run time. */
  mandatory?: boolean;
  /** The manifest's own defaultValue for this attribute, when it has a usable one (e.g. `enabled`'s is
   *  `true`) - such a field is left off isMandatoryFieldMissing()'s check even when mandatory, since an
   *  unmapped item command falls back to it (matching EditSouthItemModalComponent's own pre-filled
   *  control). Undefined for attribute types with no such concept (name's is `null`, scan-mode has none
   *  at all) - those stay genuinely required to be explicit. */
  hasUsableDefault?: boolean;
  /** Historian fields whose relevance depends on whether the item is (going to be) mapped into a group,
   *  mirroring the real item edit form's own group-dependent fields - `true` shows the field only when
   *  'groupId' is mapped to something, `false` only when it isn't. Not expressible as an enablingRule
   *  (those match against a known, finite set of values; "groupId is mapped to *something*" can't, since
   *  the set of valid group ids is dynamic). Unset for every field outside this historian group. */
  visibleWhenGrouped?: boolean;
}

/** Sentinel select-option value meaning "map this to a {{field}} expression instead of a fixed value". */
const VARIABLE_SENTINEL = '__variable__';

/**
 * The steps of the workflow wizard, in order: the Source step is for the connectors that discover from a query - the others
 * discover from the nodes checked in the Explore step - and the name comes with the schedule.
 */
export const WORKFLOW_STEPS = ['source', 'filter', 'items', 'schedule', 'review'] as const;
export type WorkflowStep = (typeof WORKFLOW_STEPS)[number];
const TREE_WORKFLOW_STEPS: ReadonlyArray<WorkflowStep> = ['filter', 'items', 'schedule', 'review'];
/** A synchronisation of a SQL connector pushes the records of its query as they are: there is no item to map */
const SQL_WORKFLOW_STEPS: ReadonlyArray<WorkflowStep> = ['source', 'filter', 'schedule', 'review'];

/** Why a workflow can't be previewed nor saved yet, and the step to fix it in. */
interface WorkflowProblem {
  step: WorkflowStep;
  /** The translation key of what is wrong */
  key: string;
}

/**
 * The steps of the wizard opened from the Explore button: the Explore step first, then the ones of what is done with the
 * checked nodes - the workflow steps to keep items in sync with them, or the one step to add them as items once.
 */
export type WizardStep = 'explore' | WorkflowStep | 'add-items';

/** What the nodes checked in the Explore step are used for. */
/** Synchronising the checked nodes, adding them as items after a review (a tree), or in one item (a SQL database) */
export type ExploreFlow = 'sync' | 'items' | 'item';

/** An action of the Explore step footer, choosing what the checked nodes are used for. */
interface ExploreFlowAction {
  flow: ExploreFlow;
  labelKey: string;
}

/** Everything the wizard needs when it is opened from the Explore button of a data source. */
export interface ExploreWizardOptions {
  /** The connector id, or `create` for a connector being created */
  southId: string;
  /** Scopes the explore session of a persisted data source; `null` for unsaved settings */
  exploreConnectorId: string | null;
  /** Override of the explore session calls, for settings that are not those of a south connector (a history query) */
  exploreApi?: SouthExploreApi;
  southSettings: SouthSettings;
  manifest: SouthConnectorManifest;
  /** The schedules the items can follow, with the groups; absent for the items of a history query, which have none */
  schedule?: { scanModes: Array<ScanModeDTO>; groups: SouthItemGroups };
  /** The items of the connector: a new one can't take their names, and one with the same settings is skipped by default */
  existingItems: ReadonlyArray<{ name: string; settings: SouthItemSettings }>;
  /**
   * Discovers the items, when they are not those of a south connector (e.g. of a history query, whose secrets it holds);
   * the mapping is the one of the item mapping form
   */
  discover?: (
    discoveryScope: Record<string, unknown>,
    itemFieldMapping: Record<string, string>
  ) => Observable<Array<SouthConnectorItemCommandDTO>>;
  /**
   * Keeping items in sync with the checked nodes through a workflow, with tree-based discovery only: whether it is saved
   * through the API (the caller saves it) or in memory, and the other workflows of the connector for the name uniqueness check
   */
  sync?: { directSave: boolean; existingWorkflows: Array<ConfigurationWorkflowCommandDTO> };
  /** Only the synchronisation is offered on the checked nodes, whatever the connector can do besides - from its New button */
  syncOnly?: boolean;
  /** Nothing is offered on the checked nodes: the data source is only browsed - e.g. to write the query of an item */
  readOnly?: boolean;
  /** A synchronisation to edit or duplicate: its nodes start checked in the Explore step, which goes on with its steps */
  workflow?: { command: ConfigurationWorkflowCommandDTO; mode: 'edit' | 'copy' };
}

/**
 * What a synchronisation discovers from: the nodes it was given, none standing for the whole data source - or null when it
 * discovers from a query, which has no node to check.
 */
export function workflowNodeIds(scope: Record<string, unknown>): Array<string> | null {
  if (typeof scope['query'] === 'string') {
    return null;
  }
  const nodeIds = scope['nodeIds'];
  if (Array.isArray(nodeIds)) {
    return nodeIds.filter((nodeId): nodeId is string => typeof nodeId === 'string');
  }
  // A workflow saved before nodes could be picked one by one has a single root node
  return typeof scope['rootNodeId'] === 'string' ? [scope['rootNodeId']] : [];
}

/** What the wizard closes with when opened from the Explore button: the workflow to create, or the items to add. */
export type ExploreWizardResult =
  | { kind: 'workflow'; command: ConfigurationWorkflowCommandDTO }
  | { kind: 'items'; commands: Array<SouthConnectorItemCommandDTO> }
  /** The item the checked tables of a SQL database give, for the item modal to complete */
  | { kind: 'item'; command: SouthConnectorItemCommandDTO };

/**
 * The fields of the Name & schedule section of the item mapping when the items are added once, in the order of the item
 * modal (see `itemMappingSections`): the others are the settings of the connector.
 */
const SCHEDULE_ITEM_PATH_ORDER = [
  'name',
  'enabled',
  'groupId',
  'scanModeId',
  'syncWithGroup',
  'maxReadInterval',
  'readDelay',
  'recoveryStrategy',
  'startTimeOffset',
  'endTimeOffset'
];

/**
 * The item fields that have to be mapped, whatever the manifest says: an item is enabled or not on purpose - an unmapped
 * field would leave it to what the item had (a synchronisation) or to the backend (an item added), which is not a choice.
 */
const ALWAYS_MANDATORY_ITEM_PATHS = new Set(['enabled']);

/** The history settings an item starts with in the item modal - the ones a new item mapping starts with too (see `prepare`). */
const HISTORY_ITEM_DEFAULTS: Record<string, string> = {
  maxReadInterval: '3600',
  readDelay: '200',
  recoveryStrategy: 'oldest',
  startTimeOffset: '0',
  endTimeOffset: '0'
};

/** The item fields that give an item its schedule: an item of a history query has none, it is read over its time range. */
const SCHEDULE_ITEM_PATHS = new Set([
  'scanModeId',
  'groupId',
  'syncWithGroup',
  'maxReadInterval',
  'readDelay',
  'startTimeOffset',
  'endTimeOffset',
  'recoveryStrategy'
]);

/** How long the mapping has to stay as it is, in ms, before the items to add are discovered again. */
const ITEMS_DISCOVERY_DEBOUNCE = 400;

/** The state of the discovery of the items to add. */
interface ItemsDiscoveryState {
  readonly loading: boolean;
  readonly error: string | null;
  readonly commands: ReadonlyArray<SouthConnectorItemCommandDTO> | null;
}

/** A preview run of the workflow as currently edited (see `ConfigurationWorkflowService.previewCommand`). */
interface PreviewState {
  readonly loading: boolean;
  readonly error: string | null;
  readonly result: WorkflowPreviewResultDTO | null;
}

/** How many discovered records the Filter step lists, to keep it light on large sources. */
const PREVIEW_RECORD_LIMIT = 20;

/** `{{field}}` expressions of a mapping template. */
const TEMPLATE_PLACEHOLDER = /\{\{\s*([^}\s]+)\s*\}\}/g;

// maxReadInterval/readDelay/the offsets/recoveryStrategy only apply to an item that owns its own
// schedule/history settings - once synced with a group, those come from the group instead, so mapping
// them here would be pointless. An item can be *in* a group without being *synced* to it, though (its
// own settings still apply then) - so this hinges on syncWithGroup itself, not merely on groupId being
// mapped, and is expressed as a regular enablingRule since 'true'/'false' is a fixed, known value set.
const HIDDEN_WHILE_SYNCED_WITH_GROUP: FieldEnablingRule = { referralPath: 'syncWithGroup', values: ['true'], operator: 'NOT_EQUAL' };

// None of these vary meaningfully per discovered record - each is a fixed setting of the item's own
// schedule, or a plain on/off toggle - so, like the schedule/group fields, they're constant-only.
const CONSTANT_ONLY_ITEM_PATHS = new Set([
  'maxReadInterval',
  'readDelay',
  'startTimeOffset',
  'endTimeOffset',
  'recoveryStrategy',
  'syncWithGroup'
]);

// Item fields that exist on every south item but aren't part of the manifest's item attribute tree
// (the real item edit form adds them by hand too, gated on the same manifest.modes.history flag).
const HISTORIAN_ITEM_FIELDS: Array<MappableField> = [
  { path: 'groupId', translationKey: 'south.items.group', attributeType: 'group-select' },
  // syncWithGroup is only meaningful once there's a group to sync with at all.
  { path: 'syncWithGroup', translationKey: 'south.items.sync-with-group', attributeType: 'boolean', visibleWhenGrouped: true },
  {
    path: 'maxReadInterval',
    translationKey: 'south.items.max-read-interval',
    attributeType: 'number',
    enablingRules: [HIDDEN_WHILE_SYNCED_WITH_GROUP]
  },
  {
    path: 'readDelay',
    translationKey: 'south.items.read-delay',
    attributeType: 'number',
    enablingRules: [HIDDEN_WHILE_SYNCED_WITH_GROUP]
  },
  {
    path: 'startTimeOffset',
    translationKey: 'south.items.start-time-offset',
    attributeType: 'number',
    enablingRules: [HIDDEN_WHILE_SYNCED_WITH_GROUP]
  },
  {
    path: 'endTimeOffset',
    translationKey: 'south.items.end-time-offset',
    attributeType: 'number',
    enablingRules: [HIDDEN_WHILE_SYNCED_WITH_GROUP]
  },
  {
    path: 'recoveryStrategy',
    translationKey: 'south.items.recovery-strategy',
    attributeType: 'string-select',
    selectableValues: ['oldest', 'newest'],
    enablingRules: [HIDDEN_WHILE_SYNCED_WITH_GROUP]
  }
];

@Component({
  selector: 'oib-edit-workflow-modal',
  templateUrl: './edit-workflow-modal.component.html',
  styleUrl: './edit-workflow-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    ReactiveFormsModule,
    FormsModule,
    TranslateDirective,
    TranslatePipe,
    OI_FORM_VALIDATION_DIRECTIVES,
    SaveButtonComponent,
    NgbDropdownModule,
    ExploreTreeComponent,
    OibCodeBlockComponent,
    TransformerTestResultComponent,
    WorkflowPreviewComponent,
    WorkflowRecordsPreviewComponent,
    ModalStepsComponent,
    DiscoveredItemsReviewComponent
  ]
})
export default class EditWorkflowModalComponent implements AfterViewInit {
  private modal = inject(NgbActiveModal);
  private fb = inject(NonNullableFormBuilder);
  private unsavedChangesConfirmation = inject(UnsavedChangesConfirmationService);
  private modalService = inject(ModalService);
  private southConnectorService = inject(SouthConnectorService);
  private configurationWorkflowService = inject(ConfigurationWorkflowService);
  private engineService = inject(EngineService);
  private injector = inject(Injector);
  private clipboard = inject(Clipboard);
  private notificationService = inject(NotificationService);

  // The inline, read-only explore tree shown alongside the SQL query editor (for the SQL connectors that can be
  // explored, see showSqlExploreTree) - undefined until that branch of the template actually renders it.
  private readonly inlineExploreTree = viewChild<ExploreTreeComponent>('inlineExploreTree');
  /** The tree of the Explore step, where the nodes are checked - only when opened from the Explore button (see `exploring`) */
  private readonly exploreStepTree = viewChild<ExploreTreeComponent>('exploreStepTree');
  readonly itemsReview = viewChild(DiscoveredItemsReviewComponent);

  readonly mode = signal<'create' | 'edit' | 'copy'>('create');
  /** Whether the wizard is opened from the Explore button: it then starts with the Explore step (see `prepareForExploration`) */
  readonly exploring = signal(false);
  /** What the checked nodes are used for, chosen in the Explore step - none until then */
  readonly flow = signal<ExploreFlow | null>(null);
  /** The steps of a workflow: the ones of the connector - a tree-based one has no Source step */
  readonly workflowSteps = computed<ReadonlyArray<WorkflowStep>>(() => {
    if (this.isTreeBased()) {
      return TREE_WORKFLOW_STEPS;
    }
    return this.isSqlFamily() ? SQL_WORKFLOW_STEPS : WORKFLOW_STEPS;
  });
  readonly steps = computed<ReadonlyArray<WizardStep>>(() => {
    if (!this.exploring()) {
      return this.workflowSteps();
    }
    switch (this.flow()) {
      case 'sync':
        return ['explore', ...this.workflowSteps()];
      case 'items':
        return ['explore', 'add-items'];
      default:
        return ['explore'];
    }
  });
  readonly step = signal<WizardStep>('source');
  readonly isFirstStep = computed(() => this.step() === this.steps()[0]);
  readonly isLastStep = computed(() => this.step() === this.steps()[this.steps().length - 1]);
  /** A new workflow is saved from the Review step, an edited one from any step */
  readonly canSave = computed(() => this.mode() === 'edit' || this.isLastStep());

  /** The records the eligibility filter keeps - listed on the Filter step, and used as examples on the Items step */
  readonly filterPreview = signal<PreviewState | null>(null);
  /** What a run would do (new, changed, missing... items), or push - on the Review step */
  readonly reviewPreview = signal<PreviewState | null>(null);
  /** Every record the eligibility filter keeps */
  readonly previewResultRecords = computed(() => this.filterPreview()?.result?.records ?? []);
  readonly previewRecords = computed(() => this.previewResultRecords().slice(0, PREVIEW_RECORD_LIMIT));
  /** The fields of the discovered records, suggested when writing a condition or an identity key */
  readonly recordFields = computed(() => {
    const records = this.filterPreview()?.result?.records ?? [];
    return Array.from(new Set(records.slice(0, PREVIEW_RECORD_LIMIT).flatMap(record => Object.keys(record))));
  });
  /** The names the first matching records would give their items, from the name mapping */
  readonly exampleItemNames = computed(() => {
    const template = this.itemFieldMappingValues()['name'] ?? '';
    if (!template.trim()) {
      return [];
    }
    return this.previewRecords()
      .slice(0, 3)
      .map(record => resolveTemplate(template, record));
  });
  private filterPreviewKey: string | null = null;
  readonly state = new ObservableState();
  /** True when opened from south-detail (the caller saves the workflow straight to the API); false when
   *  opened from edit-south (the caller keeps it in memory until the connector itself is saved) - only
   *  changes the confirm button's wording/icon, like EditSouthItemModalComponent's own directSave.
   *  Set by the opener right after opening the modal, before its first change detection. */
  directSave = true;
  readonly scanModes = signal<Array<ScanModeDTO>>([]);
  /** The schedule an item of the connector accepts: a connector that only polls (or subscribes) has no use of the other one */
  private readonly itemScheduleType = signal<OIBusScanModeAttribute['acceptableType'] | null>(null);
  private readonly subscriptionOnly = computed(() => this.itemScheduleType() === 'SUBSCRIPTION');
  /** The schedules an item can follow: the subscription is not one of them for a connector that only polls */
  readonly itemScanModes = computed(() =>
    this.itemScheduleType() === 'POLL' ? this.scanModes().filter(scanMode => scanMode.id !== 'subscription') : this.scanModes()
  );
  /**
   * The groups of the page (south-detail saves them through the API, edit-south in memory), changed through it only, like
   * EditSouthItemModalComponent's own group dropdown.
   */
  private readonly groupStore = signal<SouthItemGroups | null>(null);
  readonly groups = computed(() => this.groupStore()?.list() ?? []);
  private workflow: ConfigurationWorkflowCommandDTO | null = null;
  /** Every other workflow of the connector, for the name uniqueness check. */
  private existingWorkflows: Array<{ id: string | null; name: string }> = [];
  private readonly currentManifest = signal<SouthConnectorManifest | null>(null);
  private southId!: string;
  private southSettings!: SouthSettings;

  /** What the wizard offers on the checked nodes of its Explore step - only when opened from the Explore button (see `exploring`) */
  private readonly exploreOptions = signal<ExploreWizardOptions | null>(null);
  /** The ways to use the checked nodes, in the Explore step footer: the last one is the main one */
  readonly flowActions = computed<Array<ExploreFlowAction>>(() => {
    const options = this.exploreOptions();
    if (!options) {
      return [];
    }
    if (options.readOnly) {
      return [];
    }
    const actions: Array<ExploreFlowAction> = [];
    if (options.syncOnly || options.workflow) {
      return [{ flow: 'sync', labelKey: 'south.workflows.wizard.next' }];
    }
    const kind = options.manifest.discovery?.kind;
    if (options.sync && kind === 'tree') {
      actions.push({ flow: 'sync', labelKey: 'south.explore.keep-in-sync' });
    }
    // The records of a SQL database are those of a query: pushed as they are by a synchronisation
    if (options.sync && kind === 'query') {
      actions.push({ flow: 'sync', labelKey: 'south.explore.metadata-sync' });
    }
    if (options.manifest.discovery?.defaults) {
      actions.push(
        kind === 'query'
          ? { flow: 'item', labelKey: 'south.explore.add-in-item' }
          : { flow: 'items', labelKey: 'south.explore.add-as-items' }
      );
    }
    return actions;
  });
  readonly exploreCheckedCount = computed(() => this.exploreStepTree()?.checkedIds().size ?? 0);

  /** The synchronisation the wizard edits - one given by the opener, or picked in the Source step - null for a new one */
  readonly syncTargetId = signal<string | null>(null);
  /** The nodes the edited synchronisation had when it was picked, to tell what the wizard adds to it and removes from it */
  private readonly originalNodeIds = signal<Array<string>>([]);
  /** The nodes checked before an existing synchronisation was picked, which a new one goes back to */
  private pickedNodeIds: Array<string> | null = null;
  /** The synchronisations of the connector that discover from nodes, which the checked ones can be added to */
  readonly treeWorkflows = computed(() =>
    (this.exploreOptions()?.sync?.existingWorkflows ?? []).flatMap(workflow => {
      const nodeIds = workflowNodeIds(workflow.discoveryScope);
      return nodeIds ? [{ id: workflow.id, name: workflow.name, nodeIds }] : [];
    })
  );
  /** The synchronisations already keeping items in sync with nodes, the edited one aside: its nodes are the checked ones */
  private readonly otherTreeWorkflows = computed(() => this.treeWorkflows().filter(workflow => workflow.id !== this.syncTargetId()));
  /** What the Explore step tells about the synchronisations: how many nodes each has, none for the whole data source */
  readonly coverageChips = computed(() =>
    this.otherTreeWorkflows().map(workflow => ({ name: workflow.name, count: workflow.nodeIds.length || null }))
  );
  /** The names of the synchronisations that keep the items of a node in sync: the ones of the node or of a folder it is in */
  readonly exploreBadges = computed(() => {
    const workflows = this.otherTreeWorkflows();
    return (path: ReadonlyArray<string>) =>
      workflows.filter(workflow => workflow.nodeIds.some(nodeId => path.includes(nodeId))).map(workflow => workflow.name);
  });
  /** The synchronisations that already keep in sync the items of the checked nodes - listed when they are added as items */
  readonly coveringWorkflowNames = computed(() => {
    const checkedPaths = this.exploreStepTree()?.checkedPaths() ?? [];
    return this.otherTreeWorkflows()
      .filter(
        workflow => workflow.nodeIds.length === 0 || workflow.nodeIds.some(nodeId => checkedPaths.some(path => path.includes(nodeId)))
      )
      .map(workflow => workflow.name);
  });
  /** The nodes as checked in the Explore step */
  private readonly checkedNodeIds = computed(() => Array.from(this.exploreStepTree()?.checkedIds() ?? this.discoveryNodeIds()));
  /** The nodes of the edited synchronisation that are no longer checked: the items they gave are disabled by its next run */
  readonly removedNodeIds = computed(() => {
    const nodeIds = this.checkedNodeIds();
    return this.originalNodeIds().filter(nodeId => !nodeIds.includes(nodeId));
  });
  /** The nodes checked that the edited synchronisation did not have */
  readonly addedNodeIds = computed(() => {
    const original = this.originalNodeIds();
    return this.checkedNodeIds().filter(nodeId => !original.includes(nodeId));
  });
  /** Whether the Explore step offers to keep in sync with a synchronisation the connector already has, rather than a new one */
  readonly showSyncTarget = computed(
    () =>
      !this.isSqlFamily() &&
      this.flowActions().some(action => action.flow === 'sync') &&
      this.mode() !== 'copy' &&
      this.treeWorkflows().length > 0
  );

  /** The items the checked nodes give, mapped as in the mapping form - discovered when the Add as items step opens */
  readonly itemsDiscovery = signal<ItemsDiscoveryState | null>(null);
  /** What was discovered last: the checked nodes and the mapping */
  private readonly itemsDiscoveryKey = signal<string | null>(null);
  private readonly currentItemsDiscoveryKey = computed(() =>
    JSON.stringify([Array.from(this.exploreStepTree()?.checkedIds() ?? []), this.itemFieldMappingToSend()])
  );
  /** Whether the mapping changed since the items were discovered: they are to be discovered again before they are added */
  readonly itemsDiscoveryStale = computed(
    () => this.itemsDiscoveryKey() !== null && this.itemsDiscoveryKey() !== this.currentItemsDiscoveryKey()
  );
  readonly existingItems = computed(() => this.exploreOptions()?.existingItems ?? []);
  readonly itemsManifest = computed(() => this.exploreOptions()?.manifest ?? null);
  /** Why the items can't be discovered yet: the mapping form is not complete - a translation key */
  readonly itemMappingError = computed(() => this.itemMappingProblem());
  readonly canAddItems = computed(
    () =>
      !this.itemMappingError() && !this.itemsDiscoveryStale() && !this.itemsDiscovery()?.loading && (this.itemsReview()?.valid() ?? false)
  );

  /** The nodes the workflow discovers from, checked in the Explore modal (tree-based connectors only) - none
   *  means the whole data source. A point stands for itself, any other node for everything under it. */
  readonly discoveryNodeIds = signal<Array<string>>([]);
  /** The dedicated metadata query, as typed by the user (SQL-family connectors only). */
  readonly discoveryQuery = signal('');

  /** "Test query" state - runs discoveryQuery as currently typed, independent of Save. */
  readonly queryTestRunning = signal(false);
  readonly queryTestError = signal<string | null>(null);
  readonly queryTestResult = signal<OIBusRecordListContent | null>(null);

  /** Whether OIBus is currently registered with OIAnalytics - gates the "Push to OIAnalytics" mode,
   *  refreshed each time this modal is prepared (registration can change between two workflow edits). */
  readonly isRegistered = signal(false);

  readonly operators: ReadonlyArray<RecordFilterOperator> = RECORD_FILTER_OPERATORS;
  readonly variableSentinel = VARIABLE_SENTINEL;

  /** Every field the connector's manifest (+ the historian fields it adds outside the manifest, when supported) exposes on an item. */
  readonly itemMappableFields = signal<Array<MappableField>>([]);
  /** One expression string per itemMappableFields entry, keyed by its path - blank means "not mapped". */
  readonly itemFieldMappingValues = signal<Record<string, string>>({});

  readonly identityKeyFields = signal<Array<string>>([]);
  /**
   * The fields the mapping form shows: all of them, but the schedule of the items of a connector that only subscribes - it is
   * the subscription, nothing to map (see `itemFieldMappingToSend`).
   */
  private readonly activeMappableFields = computed(() =>
    this.subscriptionOnly() ? this.itemMappableFields().filter(field => field.path !== 'scanModeId') : this.itemMappableFields()
  );
  /**
   * The item mapping form, in the sections of the item modal on a single step: Name & schedule - with the history settings,
   * which come and go with the group as in the item modal - then the settings of the connector.
   */
  readonly itemMappingSections = computed(() => {
    const fields = this.activeMappableFields().filter(field => this.isItemFieldVisible(field));
    const settingsFields = fields.filter(field => field.path.startsWith('settings.'));
    const rank = (field: MappableField) => {
      const index = SCHEDULE_ITEM_PATH_ORDER.indexOf(field.path);
      return index === -1 ? SCHEDULE_ITEM_PATH_ORDER.length : index;
    };
    const scheduleFields = fields.filter(field => !settingsFields.includes(field)).sort((a, b) => rank(a) - rank(b));
    const sections = [
      { id: 'general', titleKey: 'south.edit-item-modal.step.general', fields: scheduleFields },
      { id: 'settings', titleKey: this.itemSettingsTitleKey(), fields: settingsFields }
    ];
    return sections.filter(section => section.fields.length > 0);
  });
  /**
   * The fields of the discovered records the mapping can use as `{{field}}`: the ones the connector tells about, and the ones
   * of the records the filter preview found
   */
  readonly availableRecordFields = computed(() =>
    Array.from(new Set([...(this.currentManifest()?.discovery?.recordFields ?? []), ...this.recordFields()]))
  );
  /** The mapping input the user was typing in last, where a field goes when picked in the list */
  private lastMappingFocus: { path: string; start: number; end: number } | null = null;
  /** The title of the settings of the items of the connector, as in the item modal */
  private readonly itemSettingsTitleKey = computed(
    () =>
      this.currentManifest()?.items.rootAttribute.attributes.find(attribute => attribute.key === 'settings')?.translationKey ??
      'south.edit-item-modal.step.settings'
  );
  /** The schedule of the group the items are mapped into, which they follow: none while they have no group */
  readonly groupScanModeName = computed(() => {
    const groupId = this.itemFieldMappingValues()['groupId'];
    const group = groupId ? this.groups().find(candidate => candidate.id === groupId) : null;
    if (!group) {
      return null;
    }
    // A group kept in memory only has the id of its schedule
    const settings = group.standardSettings;
    return 'scanMode' in settings
      ? settings.scanMode.name
      : (this.scanModes().find(scanMode => scanMode.id === settings.scanModeId)?.name ?? null);
  });
  readonly eligibilityFilter = signal<Array<RecordFilterCondition>>([]);

  readonly formError = signal<string | null>(null);

  readonly newIdentityKeyField = signal('');
  readonly newEligibilityField = signal('');
  readonly newEligibilityOperator = signal<RecordFilterOperator>('equals');
  readonly newEligibilityValue = signal('');
  /** Index of the eligibilityFilter row currently being edited inline, or null when none is. */
  readonly editingEligibilityIndex = signal<number | null>(null);
  readonly editingEligibilityField = signal('');
  readonly editingEligibilityOperator = signal<RecordFilterOperator>('equals');
  readonly editingEligibilityValue = signal('');

  readonly form: FormGroup<{
    name: FormControl<string>;
    scanModeId: FormControl<string | null>;
    pushToOIAnalytics: FormControl<boolean>;
    enabled: FormControl<boolean>;
  }> = this.fb.group({
    name: ['', [Validators.required, this.checkUniqueness()]],
    scanModeId: this.fb.control<string | null>(null),
    pushToOIAnalytics: this.fb.control<boolean>(false),
    enabled: this.fb.control<boolean>(true)
  });
  private readonly pushToOIAnalyticsControl = trackControl(() => this.form.controls.pushToOIAnalytics);
  private readonly nameControl = trackControl(() => this.form.controls.name);
  private readonly scanModeIdControl = trackControl(() => this.form.controls.scanModeId);
  /** A workflow with no schedule runs on demand only: there is nothing to enable */
  readonly manualSchedule = computed(() => !this.scanModeIdControl()?.value);
  /** The schedules a workflow can follow: the subscription is for the items, which it does not read */
  readonly workflowScanModes = computed(() => this.scanModes().filter(scanMode => scanMode.id !== 'subscription'));

  /** Whether the workflow pushes the discovered records to OIAnalytics (remote mode) rather than creating items. */
  readonly pushToOIAnalytics = computed(() => this.pushToOIAnalyticsControl()?.value ?? false);

  /** Tree-shaped discovery scope (a root node to browse) - see the manifest's `discovery` flag. */
  readonly isTreeBased = computed(() => this.currentManifest()?.discovery?.kind === 'tree');

  /** Query-shaped discovery scope (a dedicated metadata query) - the SQL-family connectors, see the
   *  manifest's `discovery` flag. */
  readonly isSqlFamily = computed(() => this.currentManifest()?.discovery?.kind === 'query');

  /** Whether to show the read-only explore tree above the SQL query editor, for reference while
   *  writing the query - only for the SQL-family connectors that also have an `explore()`
   *  implementation (a separate capability from discovery). */
  readonly showSqlExploreTree = computed(() => this.isSqlFamily() && this.currentManifest()?.explore === true);

  /** Name of the group currently mapped as a constant for the 'groupId' field, or '' when none is. */
  readonly selectedGroupName = computed(() => {
    const groupId = this.itemFieldMappingValues()['groupId'];
    if (!groupId) {
      return '';
    }
    return this.groups().find(group => group.id === groupId)?.standardSettings.name ?? groupId;
  });

  constructor() {
    // The items to add follow the mapping: they are discovered again a moment after it stops changing
    toObservable(this.currentItemsDiscoveryKey)
      .pipe(
        debounceTime(ITEMS_DISCOVERY_DEBOUNCE),
        filter(() => this.step() === 'add-items'),
        takeUntilDestroyed()
      )
      .subscribe(() => this.discoverItemsToAdd());
  }

  /**
   * @param prefill - starting values for a new workflow, e.g. the nodes checked in the Explore modal (see
   *   `WorkflowCreationService.createFromExploredNodes`). The form stays pristine: nothing was typed yet.
   */
  prepareForCreation(
    scanModes: Array<ScanModeDTO>,
    existingWorkflows: Array<{ id: string | null; name: string }>,
    manifest: SouthConnectorManifest,
    southId: string,
    southSettings: SouthSettings,
    groups: SouthItemGroups,
    prefill: Pick<ConfigurationWorkflowCommandDTO, 'name' | 'discoveryScope'> | null = null
  ) {
    this.prepare('create', scanModes, existingWorkflows, manifest, null, southId, southSettings, groups, prefill);
  }

  prepareForEdition(
    scanModes: Array<ScanModeDTO>,
    existingWorkflows: Array<{ id: string | null; name: string }>,
    manifest: SouthConnectorManifest,
    workflow: ConfigurationWorkflowCommandDTO,
    southId: string,
    southSettings: SouthSettings,
    groups: SouthItemGroups
  ) {
    this.prepare('edit', scanModes, existingWorkflows, manifest, workflow, southId, southSettings, groups);
  }

  /**
   * Duplicate an existing workflow: opens the same populated form as edition, but targeting a brand
   * new workflow (create semantics on save, per ManageWorkflowsModalComponent.onDuplicate) - mirrors
   * EditSouthItemModalComponent's own prepareForCopy for items. The clone's id is blanked so
   * checkUniqueness() excludes nothing (the source workflow's own name stays taken, as it should).
   */
  prepareForCopy(
    scanModes: Array<ScanModeDTO>,
    existingWorkflows: Array<{ id: string | null; name: string }>,
    manifest: SouthConnectorManifest,
    workflow: ConfigurationWorkflowCommandDTO,
    southId: string,
    southSettings: SouthSettings,
    groups: SouthItemGroups
  ) {
    this.prepare('copy', scanModes, existingWorkflows, manifest, this.copyOf(workflow), southId, southSettings, groups);
  }

  /**
   * Opens the wizard from the Explore button of a data source: the Explore step first, to check the nodes to use, then what is
   * done with them - keeping items in sync with them through a workflow, or adding them as items once.
   */
  prepareForExploration(options: ExploreWizardOptions) {
    this.exploreOptions.set(options);
    this.directSave = options.sync?.directSave ?? false;
    const target = options.workflow ?? null;
    this.prepare(
      target?.mode ?? 'create',
      options.schedule?.scanModes ?? [],
      options.sync?.existingWorkflows ?? [],
      options.manifest,
      target ? (target.mode === 'copy' ? this.copyOf(target.command) : target.command) : null,
      options.southId,
      options.southSettings,
      options.schedule?.groups ?? null
    );
    if (!options.schedule) {
      this.itemMappableFields.update(fields => fields.filter(field => !SCHEDULE_ITEM_PATHS.has(field.path)));
    }
    this.exploring.set(true);
    // A synchronisation given to the wizard goes on with its steps from the Explore one
    this.flow.set(target || options.syncOnly ? 'sync' : null);
    this.syncTargetId.set(target?.mode === 'edit' ? target.command.id : null);
    this.pickedNodeIds = null;
    this.originalNodeIds.set(target?.mode === 'edit' ? [...this.discoveryNodeIds()] : []);
    this.itemsDiscovery.set(null);
    this.itemsDiscoveryKey.set(null);
    this.step.set('explore');
    // The tree is rendered by the first change detection pass, which may come after this call
    afterNextRender(
      () =>
        this.exploreStepTree()?.prepare(options.exploreConnectorId, options.southSettings, options.manifest.id, {
          api: options.exploreApi,
          checkable: !options.readOnly,
          checkedIds: this.discoveryNodeIds()
        }),
      { injector: this.injector }
    );
  }

  /**
   * Picks what the checked nodes are added to in the Source step: a new synchronisation, or an existing one - which then has
   * its own settings, and its nodes with the checked ones.
   */
  selectSyncTarget(workflowId: string | null) {
    const options = this.exploreOptions()!;
    const tree = this.exploreStepTree();
    const checked = tree ? Array.from(tree.checkedIds()) : this.discoveryNodeIds();
    // The nodes the user picked are the ones of the next new synchronisation, whatever the existing ones add to them
    if (this.syncTargetId() === null) {
      this.pickedNodeIds = checked;
    }
    const workflow = workflowId ? (options.sync?.existingWorkflows ?? []).find(candidate => candidate.id === workflowId) : undefined;
    const original = workflow ? (workflowNodeIds(workflow.discoveryScope) ?? []) : [];
    // A synchronisation of the whole data source has nothing to add the nodes to
    const nodeIds = workflow
      ? original.length === 0
        ? []
        : Array.from(new Set([...original, ...checked]))
      : (this.pickedNodeIds ?? checked);
    this.prepare(
      workflow ? 'edit' : 'create',
      options.schedule?.scanModes ?? [],
      options.sync?.existingWorkflows ?? [],
      options.manifest,
      workflow ?? null,
      options.southId,
      options.southSettings,
      options.schedule?.groups ?? null,
      workflow ? null : { name: '', discoveryScope: {} }
    );
    this.discoveryNodeIds.set(nodeIds);
    tree?.checkedIds.set(new Set(nodeIds));
    this.syncTargetId.set(workflowId);
    this.originalNodeIds.set(original);
    this.step.set('explore');
  }

  /** A synchronisation as a new one: no id, and a name of its own, as for the duplicate of the Manage modal */
  private copyOf(workflow: ConfigurationWorkflowCommandDTO): ConfigurationWorkflowCommandDTO {
    return { ...structuredClone(workflow), id: null, name: `${workflow.name}-copy` };
  }

  private prepare(
    mode: 'create' | 'edit' | 'copy',
    scanModes: Array<ScanModeDTO>,
    existingWorkflows: Array<{ id: string | null; name: string }>,
    manifest: SouthConnectorManifest,
    workflow: ConfigurationWorkflowCommandDTO | null,
    southId: string,
    southSettings: SouthSettings,
    groups: SouthItemGroups | null,
    prefill: Pick<ConfigurationWorkflowCommandDTO, 'name' | 'discoveryScope'> | null = null
  ) {
    this.mode.set(mode);
    this.scanModes.set(scanModes);
    this.groupStore.set(groups);
    this.existingWorkflows = existingWorkflows;
    this.workflow = workflow;
    this.currentManifest.set(manifest);
    this.southId = southId;
    this.southSettings = southSettings;
    this.itemMappableFields.set(buildItemMappableFields(manifest));
    this.itemScheduleType.set(
      (manifest.items.rootAttribute.attributes.find(attribute => attribute.key === 'scanMode') as OIBusScanModeAttribute | undefined)
        ?.acceptableType ?? null
    );

    const scope: Record<string, unknown> = workflow?.discoveryScope ?? prefill?.discoveryScope ?? {};
    // A workflow saved before nodes could be picked one by one has a single root node
    const scopeNodeIds = scope['nodeIds'];
    const rootNodeId = scope['rootNodeId'];
    this.discoveryNodeIds.set(
      Array.isArray(scopeNodeIds)
        ? scopeNodeIds.filter((nodeId): nodeId is string => typeof nodeId === 'string')
        : typeof rootNodeId === 'string'
          ? [rootNodeId]
          : []
    );
    this.step.set(this.workflowSteps()[0]);
    this.filterPreview.set(null);
    this.filterPreviewKey = null;
    this.reviewPreview.set(null);
    this.discoveryQuery.set(typeof scope['query'] === 'string' ? scope['query'] : '');
    // A new workflow starts from the connector's own defaults: the records it discovers always have the same shape
    const defaults = manifest.discovery?.defaults;
    const startingValues =
      workflow ?? (defaults ? { itemFieldMapping: defaults.itemFieldMapping, identityKeyFields: defaults.identityKeyFields } : null);
    const itemFieldMapping: Record<string, string> = { ...(startingValues?.itemFieldMapping ?? {}) };
    // A new mapping starts with what a new item starts with in the item modal: enabled, and the history settings
    if (!workflow) {
      if (this.itemMappableFields().some(field => field.path === 'enabled')) {
        itemFieldMapping['enabled'] ??= 'true';
      }
      if (manifest.modes.history) {
        for (const [path, value] of Object.entries(HISTORY_ITEM_DEFAULTS)) {
          itemFieldMapping[path] ??= value;
        }
      }
    }
    this.itemFieldMappingValues.set(itemFieldMapping);
    this.identityKeyFields.set([...(startingValues?.identityKeyFields ?? [])]);
    this.eligibilityFilter.set(workflow ? workflow.eligibilityFilter.map(condition => ({ ...condition })) : []);
    this.refreshRegistrationStatus();
    this.initForm(prefill?.name ?? '');
  }

  private checkUniqueness(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) {
        return null;
      }
      // Only an edited workflow excludes itself - a copy's (or a new one's) name must differ from every other.
      const ownId = this.mode() === 'edit' ? this.workflow?.id : undefined;
      const isDuplicate = this.existingWorkflows.some(
        workflow => workflow.name.toLowerCase() === control.value.toLowerCase() && (ownId == null || workflow.id !== ownId)
      );
      return isDuplicate ? { mustBeUnique: true } : null;
    };
  }

  /** Refreshes whether OIBus is currently registered with OIAnalytics - drives the "not registered yet"
   *  warning shown next to the "Push to OIAnalytics" mode, never blocks picking or saving it (a workflow
   *  can be authored and scheduled ahead of registration; it simply won't push anything until then, see
   *  save()'s own comment). Fire-and-forget: the template re-renders once this resolves, same as any
   *  other one-shot fetch this modal makes. */
  private refreshRegistrationStatus() {
    this.engineService.getRegistrationSettings().subscribe(settings => {
      this.isRegistered.set(settings.status === 'REGISTERED');
    });
  }

  private initForm(defaultName: string) {
    // SQL-family connectors are query-based (one item = one free-form query, item != point) - a
    // workflow there can only ever push the raw discovered records to OIAnalytics, never create/update
    // items itself (see isSqlFamily's own doc comment). pushToOIAnalytics is forced true and the mode
    // choice is hidden from the template for these.
    this.form.reset({
      name: this.workflow?.name ?? defaultName,
      scanModeId: this.workflow?.scanModeId ?? null,
      pushToOIAnalytics: this.isSqlFamily() ? true : (this.workflow?.pushToOIAnalytics ?? false),
      enabled: this.workflow?.enabled ?? true
    });
  }

  /** A field of the discovered records as the mapping expression that gets its value. */
  fieldToken(field: string): string {
    return `{{${field}}}`;
  }

  /** Remembers where the user was typing in the mapping, as the focus leaves it for the list of fields */
  rememberMappingFocus(event: FocusEvent) {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) {
      return;
    }
    const match = /^item-field-mapping-field-(.+?)(-expression)?$/.exec(input.id);
    const field = match ? this.itemMappableFields().find(candidate => candidate.path === match[1]) : undefined;
    // Only an input that takes an expression: not a constant-only field, nor a select unless it is on an expression
    this.lastMappingFocus =
      field && this.allowsVariable(field) && (!this.isSelectType(field) || !!match![2])
        ? { path: field.path, start: input.selectionStart ?? input.value.length, end: input.selectionEnd ?? input.value.length }
        : null;
  }

  /** Puts a field of the discovered records where the user was typing in the mapping, or copies it when there is no such place. */
  useRecordField(field: string) {
    const token = this.fieldToken(field);
    const target = this.lastMappingFocus;
    if (!target) {
      this.clipboard.copy(token);
      this.notificationService.success('south.explore.copied');
      return;
    }
    const value = this.itemFieldMappingValues()[target.path] ?? '';
    this.setMappingValue(target.path, `${value.slice(0, target.start)}${token}${value.slice(target.end)}`);
    // The next field goes after this one
    const end = target.start + token.length;
    this.lastMappingFocus = { path: target.path, start: end, end };
  }

  /** Maps (or unmaps, with a blank value) an item field. */
  setMappingValue(path: string, value: string) {
    this.itemFieldMappingValues.update(values => ({ ...values, [path]: value }));
  }

  addIdentityKeyField() {
    const field = this.newIdentityKeyField().trim();
    if (!field || this.identityKeyFields().includes(field)) {
      return;
    }
    this.identityKeyFields.update(fields => [...fields, field]);
    this.newIdentityKeyField.set('');
  }

  removeIdentityKeyField(field: string) {
    this.identityKeyFields.update(fields => fields.filter(existing => existing !== field));
  }

  addEligibilityCondition() {
    const field = this.newEligibilityField().trim();
    if (!field) {
      return;
    }
    const condition: RecordFilterCondition = { field, operator: this.newEligibilityOperator() };
    if (this.newEligibilityOperator() !== 'exists') {
      condition.value = this.newEligibilityValue();
    }
    this.eligibilityFilter.update(conditions => [...conditions, condition]);
    this.newEligibilityField.set('');
    this.newEligibilityOperator.set('equals');
    this.newEligibilityValue.set('');
  }

  removeEligibilityCondition(index: number) {
    this.eligibilityFilter.update(conditions => conditions.filter((_, conditionIndex) => conditionIndex !== index));
    // Indices shift on removal - an in-progress edit elsewhere in the list can no longer be trusted
    // to point at the right row, so drop it rather than risk silently editing the wrong condition.
    this.cancelEditEligibilityCondition();
  }

  /** Enter inline edit mode for one eligibility condition, seeding the edit fields from its current value. */
  startEditEligibilityCondition(index: number) {
    const condition = this.eligibilityFilter()[index];
    this.editingEligibilityIndex.set(index);
    this.editingEligibilityField.set(condition.field);
    this.editingEligibilityOperator.set(condition.operator);
    this.editingEligibilityValue.set(condition.value ?? '');
  }

  /** Commit the currently inline-edited condition in place of the original at the same index. */
  saveEligibilityCondition() {
    const editingIndex = this.editingEligibilityIndex();
    if (editingIndex === null) {
      return;
    }
    const field = this.editingEligibilityField().trim();
    if (!field) {
      return;
    }
    const condition: RecordFilterCondition = { field, operator: this.editingEligibilityOperator() };
    if (this.editingEligibilityOperator() !== 'exists') {
      condition.value = this.editingEligibilityValue();
    }
    this.eligibilityFilter.update(conditions => conditions.map((existing, index) => (index === editingIndex ? condition : existing)));
    this.cancelEditEligibilityCondition();
  }

  /** Leave inline edit mode without saving any change. */
  cancelEditEligibilityCondition() {
    this.editingEligibilityIndex.set(null);
    this.editingEligibilityField.set('');
    this.editingEligibilityOperator.set('equals');
    this.editingEligibilityValue.set('');
  }

  /** Whether this field's constant value should be picked from a fixed list (checkbox/select) rather than typed freely. */
  isSelectType(field: MappableField): boolean {
    return (
      field.attributeType === 'boolean' ||
      field.attributeType === 'string-select' ||
      field.attributeType === 'scan-mode' ||
      field.attributeType === 'group-select'
    );
  }

  /** The translation key for this field's row label. A manifest-driven 'string-select' attribute's translationKey is a
   *  namespace object ({ title, <value>: ... } - see e.g. security-mode in the OPC-UA manifest translations), not a
   *  flat string, so its label needs the same `.title` suffix the real manifest form uses for that control. Every
   *  other field type (including the two hardcoded string-select fields, whose keys are already flat strings) uses
   *  its translationKey directly. */
  fieldLabelKey(field: MappableField): string {
    if (field.attributeType === 'string-select' && field.path !== 'recoveryStrategy' && field.path !== 'resamplingMethod') {
      return `${field.translationKey}.title`;
    }
    return field.translationKey;
  }

  /** The fixed set of valid constant values for a select-type field - used both to render its options and to tell a
   *  constant value apart from a {{...}} expression (anything not in this list is treated as a variable). */
  private fieldConcreteValues(field: MappableField): Array<string> {
    switch (field.attributeType) {
      case 'boolean':
        return ['true', 'false'];
      case 'string-select':
        return field.selectableValues ?? [];
      case 'scan-mode':
        return this.itemScanModes().map(scanMode => scanMode.id);
      case 'group-select':
        return this.groups()
          .map(group => group.id)
          .filter((id): id is string => id != null);
      default:
        return [];
    }
  }

  /** Translated option label for a 'string-select' field's value - mirrors the manifest form's own `translationKey.value`
   *  convention, except for the hardcoded historian recoveryStrategy field, whose keys already exist under a different shape. */
  stringSelectOptionLabel(field: MappableField, value: string): string {
    if (field.path === 'recoveryStrategy') {
      return `south.items.recovery-strategy-${value}`;
    }
    if (field.path === 'resamplingMethod') {
      return `south.workflows.resampling-values.${value}`;
    }
    return `${field.translationKey}.${value}`;
  }

  /** True once the field's mapped value is set but isn't one of its fixed constant options - i.e. it's a {{...}} expression. */
  isVariableMode(field: MappableField): boolean {
    const value = this.itemFieldMappingValues()[field.path] ?? '';
    if (!value) {
      return false;
    }
    return !this.fieldConcreteValues(field).includes(value);
  }

  /** What the <select> itself should show: the sentinel option while in variable mode, the raw constant value otherwise. */
  selectDisplayValue(field: MappableField): string {
    return this.isVariableMode(field) ? VARIABLE_SENTINEL : (this.itemFieldMappingValues()[field.path] ?? '');
  }

  /** Handles a change on a select-type field's constant dropdown - switches into variable mode with a starter
   *  expression when the sentinel is chosen, otherwise stores the picked constant value directly. */
  onSelectChange(field: MappableField, newValue: string) {
    this.setMappingValue(field.path, newValue === VARIABLE_SENTINEL ? '{{}}' : newValue);
  }

  /** Whether this field can be mapped to a {{ }} expression at all. False for a field other fields depend
   *  on for their own visibility (its value must be knowable while editing), the schedule/group fields -
   *  a workflow-created item's scan mode and group must always reference something real, never a
   *  per-record expression - and the historian fields, which are either a fixed setting of the item's own
   *  schedule (max read interval, read delay, the offsets, recovery strategy) or a plain toggle
   *  (syncWithGroup), neither ever meaningfully varying per discovered record. */
  /** A field controlling other fields' visibility can vary per record too (e.g. a BACnet object type): the fields
   *  it controls are then shown (see evaluatesTrue), since they may apply to some of the records. */
  allowsVariable(field: MappableField): boolean {
    return field.attributeType !== 'scan-mode' && field.attributeType !== 'group-select' && !CONSTANT_ONLY_ITEM_PATHS.has(field.path);
  }

  /** Placeholder for a plain-text item field's input - a constant-only field (e.g. maxReadInterval) gets
   *  a hint that it can't take a {{ }} expression, instead of the generic "constant or {{field}}" one. */
  itemFieldPlaceholderKey(field: MappableField): string {
    return this.allowsVariable(field)
      ? 'south.workflows.item-field-mapping-expression-placeholder'
      : 'south.workflows.mapping-constant-placeholder';
  }

  onSelectGroup(groupId: string | null) {
    const grouped = !!this.itemFieldMappingValues()['groupId'];
    this.setMappingValue('groupId', groupId ?? '');
    // As in the item modal, an item that gets a group follows it, until the mapping says otherwise
    if (!grouped && groupId) {
      this.setMappingValue('syncWithGroup', 'true');
    } else if (!groupId) {
      this.setMappingValue('syncWithGroup', '');
    }
  }

  /** Mirrors EditSouthItemModalComponent's own onAddGroup - creates the group through the groups of the page, then maps
   *  the newly created group as this field's constant. */
  onAddGroup() {
    this.openGroupModal().subscribe(groupResult => this.onSelectGroup(groupResult.id!));
  }

  onEditGroup(group: SouthItemGroup, event: Event) {
    event.stopPropagation();
    this.openGroupModal(group).subscribe();
  }

  private openGroupModal(group?: SouthItemGroup) {
    return openGroupModal(this.modalService, this.groupStore()!, {
      scanModes: this.scanModes(),
      manifest: this.currentManifest()!,
      directSave: this.directSave,
      group
    });
  }

  onDeleteGroup(group: SouthItemGroup, event: Event) {
    event.stopPropagation();
    this.groupStore()!
      .delete(group)
      .subscribe(() => {
        if (this.itemFieldMappingValues()['groupId'] === group.id) {
          this.onSelectGroup(null);
        }
      });
  }

  /** Whether an item field should be shown at all - every enabling rule covering it (its own, plus any
   *  inherited from an enclosing settings object) must currently pass against itemFieldMappingValues,
   *  and a group-dependent historian field must agree with whether 'groupId' is currently mapped. */
  isItemFieldVisible(field: MappableField): boolean {
    const values = this.itemFieldMappingValues();
    if (field.visibleWhenGrouped !== undefined) {
      const isGrouped = !!values['groupId'];
      if (field.visibleWhenGrouped !== isGrouped) {
        return false;
      }
    }
    // As in the item modal, the schedule of an item of a group is the one of its group
    if (field.path === 'scanModeId' && !!values['groupId']) {
      return false;
    }
    return (field.enablingRules ?? []).every(rule => evaluatesTrue(rule, values));
  }

  /** Whether a mandatory, currently-visible field is missing a mapped value - checked at save time.
   *  Exempt: a field with a usable manifest defaultValue (e.g. a setting that falls back to it if left unmapped,
   *  same as EditSouthItemModalComponent's own pre-filled control - never actually "missing"), unless it is
   *  one of ALWAYS_MANDATORY_ITEM_PATHS, and scanModeId once the item is mapped into a group (mirrors that same
   *  form's scanModeId.disable() when grouped: a grouped item's schedule comes from the group instead). */
  isMandatoryFieldMissing(field: MappableField): boolean {
    if (!ALWAYS_MANDATORY_ITEM_PATHS.has(field.path) && (!field.mandatory || field.hasUsableDefault)) {
      return false;
    }
    const values = this.itemFieldMappingValues();
    if (field.path === 'scanModeId' && !!values['groupId']?.trim()) {
      return false;
    }
    return !(values[field.path] ?? '').trim();
  }

  ngAfterViewInit() {
    if (this.showSqlExploreTree()) {
      this.inlineExploreTree()?.prepare(this.southId, this.southSettings, this.currentManifest()!.id);
    }
  }

  scanModeName(scanModeId: string): string {
    return this.scanModes().find(scanMode => scanMode.id === scanModeId)?.name ?? scanModeId;
  }

  /** An action needs a node checked - but for editing a synchronisation, whose nodes can be none: the whole data source */
  actionDisabled(action: ExploreFlowAction): boolean {
    return this.selectionPending() || (this.exploreCheckedCount() === 0 && !(action.flow === 'sync' && this.syncTargetId() !== null));
  }

  /** Whether the tables checked are being turned into a query - see `useSelectedTables` */
  readonly selectionPending = signal(false);
  /** Why the tables checked could not be turned into a query - a message, or null */
  readonly selectionError = signal<string | null>(null);
  /** Whether the tables checked have nothing to read */
  readonly selectionNone = signal(false);

  /** Uses the checked nodes for what the action says: the first step of the way to do so follows. */
  chooseFlow(flow: ExploreFlow) {
    if (this.isSqlFamily() && flow !== 'items') {
      this.useSelectedTables(flow);
      return;
    }
    this.flow.set(flow);
    this.goToStep(flow === 'sync' ? this.workflowSteps()[0] : 'add-items');
  }

  /**
   * The query the tables and columns checked of a SQL database give - one query reading them together when there are several,
   * joined on what they share - for the item the modal completes, or for the metadata query of a synchronisation.
   */
  private useSelectedTables(flow: 'sync' | 'item') {
    const options = this.exploreOptions()!;
    const nodeIds = Array.from(this.exploreStepTree()?.checkedIds() ?? []);
    // the plain query is the one of a metadata query, which is run as it is: with no time range
    const mapping =
      flow === 'item' ? options.manifest.discovery!.defaults!.itemFieldMapping : { name: '{{name}}', 'settings.query': '{{plainQuery}}' };
    const discover =
      options.discover ??
      ((scope, itemMapping) =>
        this.southConnectorService.discoverItems(options.southId, options.manifest.id, options.southSettings, scope, itemMapping));
    this.selectionPending.set(true);
    this.selectionError.set(null);
    this.selectionNone.set(false);
    discover({ nodeIds, combine: true }, mapping).subscribe({
      next: commands => {
        this.selectionPending.set(false);
        const command = commands[0];
        if (!command) {
          this.selectionNone.set(true);
        } else if (flow === 'item') {
          const result: ExploreWizardResult = { kind: 'item', command };
          this.modal.close(result);
        } else {
          this.discoveryQuery.set(String((command.settings as unknown as Record<string, unknown>)['query'] ?? ''));
          if (!this.form.controls.name.value) {
            this.form.controls.name.setValue(command.name);
          }
          this.flow.set('sync');
          this.goToStep(this.workflowSteps()[0]);
        }
      },
      error: error => {
        this.selectionPending.set(false);
        this.selectionError.set(extractErrorMessage(error));
      }
    });
  }

  goToStep(step: WizardStep) {
    if (this.step() === 'explore') {
      const tree = this.exploreStepTree();
      if (tree) {
        this.discoveryNodeIds.set(Array.from(tree.checkedIds()));
      }
    }
    this.step.set(step);
    if (step === 'filter') {
      this.previewFilter();
    } else if (step === 'items') {
      this.ensureFilterPreview();
    } else if (step === 'review') {
      this.previewReview();
    } else if (step === 'add-items') {
      this.discoverItemsToAdd();
    }
  }

  /**
   * The items the checked nodes give, mapped as in the mapping form: unless forced, nothing happens when it is what was
   * discovered last, so that coming back to the step keeps what was reviewed in it.
   */
  discoverItemsToAdd(force = false) {
    const options = this.exploreOptions()!;
    const nodeIds = Array.from(this.exploreStepTree()?.checkedIds() ?? []);
    const mapping = this.itemFieldMappingToSend();
    const key = this.currentItemsDiscoveryKey();
    if (!force && key === this.itemsDiscoveryKey() && !this.itemsDiscovery()?.error) {
      return;
    }
    this.itemsDiscoveryKey.set(key);
    if (nodeIds.length === 0 || this.itemMappingError()) {
      this.itemsDiscovery.set(null);
      return;
    }
    this.itemsDiscovery.set({ loading: true, error: null, commands: null });
    const discover =
      options.discover ??
      ((scope, itemMapping) =>
        this.southConnectorService.discoverItems(options.southId, options.manifest.id, options.southSettings, scope, itemMapping));
    discover({ nodeIds }, mapping).subscribe({
      next: commands => {
        if (this.itemsDiscoveryKey() === key) {
          this.itemsDiscovery.set({ loading: false, error: null, commands: commands.map(command => this.withScheduleNames(command)) });
        }
      },
      error: error => {
        if (this.itemsDiscoveryKey() === key) {
          this.itemsDiscovery.set({ loading: false, error: extractErrorMessage(error), commands: null });
        }
      }
    });
  }

  /**
   * The item as the item form would give it: an item of a group has the schedule of its group, not one of its own, and the
   * names of its group and schedule come with their ids.
   */
  private withScheduleNames(command: SouthConnectorItemCommandDTO): SouthConnectorItemCommandDTO {
    const group = this.groups().find(candidate => candidate.id === command.groupId) ?? null;
    const syncWithGroup = !!group && command.syncWithGroup;
    const scanMode = group ? null : (this.scanModes().find(candidate => candidate.id === command.scanModeId) ?? null);
    return {
      ...command,
      groupId: group?.id ?? null,
      groupName: group?.standardSettings.name ?? null,
      syncWithGroup,
      scanModeId: scanMode?.id ?? null,
      scanModeName: scanMode?.name ?? null
    };
  }

  addItems() {
    const review = this.itemsReview();
    if (!this.canAddItems() || !review) {
      return;
    }
    const result: ExploreWizardResult = { kind: 'items', commands: review.includedCommands() };
    this.modal.close(result);
  }

  /** The next step - not before the Source step has what any preview needs: a query, for SQL. */
  next() {
    if (this.step() === 'source') {
      this.formError.set(null);
      if (this.isSqlFamily() && !this.discoveryQuery().trim()) {
        this.formError.set('south.workflows.discovery-scope-query-required');
        return;
      }
    }
    this.goToStep(this.steps()[this.steps().indexOf(this.step()) + 1]);
  }

  back() {
    this.goToStep(this.steps()[this.steps().indexOf(this.step()) - 1]);
  }

  /** The records the eligibility filter keeps, as currently edited. */
  previewFilter() {
    this.filterPreviewKey = this.currentFilterPreviewKey();
    this.runPreview(this.filterPreview, this.recordsPreviewCommand(), null);
  }

  /** What the records depend on: where they are discovered from, and the filter */
  private currentFilterPreviewKey(): string {
    return JSON.stringify([this.currentDiscoveryScope(), this.eligibilityFilter()]);
  }

  /** The Items step shows the records too: they are not discovered again when they were, for the same scope and filter. */
  private ensureFilterPreview() {
    if (this.filterPreviewKey !== this.currentFilterPreviewKey() || this.filterPreview()?.error) {
      this.previewFilter();
    }
  }

  /** What a run of the workflow as currently edited would do - classified against its previous run once saved. */
  previewReview() {
    const built = this.buildCommand();
    if ('error' in built) {
      this.reviewPreview.set({ loading: false, error: null, result: null });
      return;
    }
    const workflowId =
      this.mode() === 'edit' && this.workflow?.id && !this.workflow.id.startsWith(TEMP_ID_PREFIX) ? this.workflow.id : null;
    this.runPreview(this.reviewPreview, built.command, workflowId);
  }

  /** A remote preview of the workflow source and filter: it returns the matching records themselves, whatever the mode. */
  private recordsPreviewCommand(): ConfigurationWorkflowCommandDTO {
    return {
      id: null,
      // the name comes last: a preview does not need one
      name: this.form.controls.name.value || 'preview',
      discoveryScope: this.currentDiscoveryScope(),
      identityKeyFields: [],
      eligibilityFilter: this.eligibilityFilter(),
      itemFieldMapping: null,
      pushToOIAnalytics: true,
      scanModeId: null,
      enabled: true
    };
  }

  private runPreview(target: WritableSignal<PreviewState | null>, command: ConfigurationWorkflowCommandDTO, workflowId: string | null) {
    target.set({ loading: true, error: null, result: null });
    this.configurationWorkflowService
      .previewCommand(this.southId, this.currentManifest()!.id, this.southSettings, workflowId, command)
      .subscribe({
        next: result => target.set({ loading: false, error: null, result }),
        error: error => target.set({ loading: false, error: extractErrorMessage(error), result: null })
      });
  }

  private currentDiscoveryScope(): Record<string, unknown> {
    if (this.isSqlFamily()) {
      return { query: this.discoveryQuery().trim() };
    }
    // No node at all means the whole data source - a deliberate, valid choice.
    return this.isTreeBased() && this.discoveryNodeIds().length > 0 ? { nodeIds: this.discoveryNodeIds() } : {};
  }

  /**
   * Run the discovery query exactly as currently typed (independent of Save, like EditSouthItemModal's
   * own "test item") and show its raw rows - lets the user check it works before saving the workflow.
   */
  testDiscoveryQuery() {
    const query = this.discoveryQuery().trim();
    if (!query) {
      return;
    }
    this.queryTestRunning.set(true);
    this.queryTestError.set(null);
    this.queryTestResult.set(null);
    this.southConnectorService.testDiscoveryQuery(this.southId, this.currentManifest()!.id, this.southSettings, query).subscribe({
      next: rows => {
        this.queryTestRunning.set(false);
        this.queryTestResult.set({ type: 'record-list', content: rows });
      },
      error: error => {
        this.queryTestRunning.set(false);
        this.queryTestError.set(extractErrorMessage(error));
      }
    });
  }

  canDismiss(): Observable<boolean> | boolean {
    if (this.form.dirty) {
      return this.unsavedChangesConfirmation.confirmUnsavedChanges();
    }
    return true;
  }

  cancel() {
    this.modal.dismiss();
  }

  save() {
    // The form is also submitted by the Enter key of any of its fields
    if (this.step() === 'explore' || this.step() === 'add-items') {
      return;
    }
    this.formError.set(null);
    const built = this.buildCommand();
    if ('error' in built) {
      this.formError.set(built.error);
      this.step.set(built.step);
      return;
    }
    this.modal.close(this.exploring() ? ({ kind: 'workflow', command: built.command } satisfies ExploreWizardResult) : built.command);
  }

  /**
   * Why the item mapping can't be used yet, if it can't - a translation key.
   */
  private itemMappingProblem(): string | null {
    const mappingValues = this.itemFieldMappingValues();
    // A field other fields depend on for their own visibility, plus the schedule/group fields, must be
    // knowable while editing (or reference something real) rather than resolved per-record at run time -
    // a select-type one of these can't even reach this state through the UI (its {{ }} option is
    // omitted), but a free-text one still could.
    const hasConstantOnlyViolation = this.activeMappableFields().some(
      field => !this.allowsVariable(field) && (mappingValues[field.path] ?? '').includes('{{')
    );
    if (hasConstantOnlyViolation) {
      return 'south.workflows.mapping-constant-only';
    }

    // Every visible, manifest-REQUIRED field must be mapped to something - otherwise a workflow can be
    // saved in a state item creation would only reject later, at run time (see isMandatoryFieldMissing).
    const missingMandatoryFields = this.activeMappableFields().filter(
      field => this.isItemFieldVisible(field) && this.isMandatoryFieldMissing(field)
    );
    if (missingMandatoryFields.length > 0) {
      return 'south.workflows.mapping-mandatory-missing';
    }
    return null;
  }

  /**
   * What the item mapping maps, to save in a workflow or to discover the items to add with. A field hidden by an unmet enabling
   * condition keeps whatever value it had while editing (so toggling the referral back and forth doesn't lose data), but is left
   * out here - it isn't actually part of the item this mapping would produce.
   */
  private itemFieldMappingToSend(): Record<string, string> {
    const visibleItemPaths = new Set(
      this.activeMappableFields()
        .filter(field => this.isItemFieldVisible(field))
        .map(field => field.path)
    );
    const values: Record<string, string> = {};
    for (const [path, value] of Object.entries(this.itemFieldMappingValues())) {
      if (visibleItemPaths.has(path)) {
        values[path] = value;
      }
    }
    const mapping = nonEmptyEntries(values);
    // An item of a connector that only subscribes has no schedule to pick
    return this.subscriptionOnly() ? { ...mapping, scanModeId: 'subscription' } : mapping;
  }

  /** Everything that keeps the workflow from being previewed and saved, in the order of the steps - listed in the Review step. */
  readonly workflowProblems = computed<Array<WorkflowProblem>>(() => {
    const problems: Array<WorkflowProblem> = [];
    if (this.isSqlFamily() && !this.discoveryQuery().trim()) {
      problems.push({ step: 'source', key: 'south.workflows.discovery-scope-query-required' });
    }
    // SQL-family connectors push the records as they are (see initForm()'s own comment), and a remote workflow has no
    // item to map nor record to identify: identity keys only drive the local diff against the previous run
    if (!this.isSqlFamily() && !this.pushToOIAnalytics()) {
      if (this.identityKeyFields().length === 0) {
        problems.push({ step: 'items', key: 'south.workflows.identity-key-fields-none' });
      }
      const mappingProblem = this.itemMappingProblem();
      if (mappingProblem) {
        problems.push({ step: 'items', key: mappingProblem });
      }
    }
    const nameErrors = this.nameControl()?.errors;
    if (nameErrors) {
      problems.push({ step: 'schedule', key: nameErrors['required'] ? 'south.workflows.name-required' : 'south.workflows.name-unique' });
    }
    return problems;
  });

  /** The workflow as currently edited, or why it can't be saved yet and the step to fix it in. */
  private buildCommand(): { command: ConfigurationWorkflowCommandDTO } | { error: string | null; step: WorkflowStep } {
    const problem = this.workflowProblems()[0];
    if (problem) {
      // A name error is shown under its field
      if (problem.step === 'schedule') {
        this.form.markAllAsTouched();
        return { error: null, step: problem.step };
      }
      return { error: problem.key, step: problem.step };
    }
    const formValue = this.form.getRawValue();
    // SQL-family connectors can never create/update items (see initForm()'s own comment) - re-clamped
    // here too, defensively, not just via the mode choice being hidden from the template.
    const pushToOIAnalytics = this.isSqlFamily() ? true : formValue.pushToOIAnalytics;

    const discoveryScope = this.currentDiscoveryScope();

    // Deliberately not blocked here when pushToOIAnalytics is picked while OIBus isn't registered -
    // mirrors ConfigurationWorkflowService's own server-side behavior, which likewise now only warns
    // (see its checkMode()'s own comment). The "mode-remote-not-registered" alert shown next to the
    // mode picker already surfaces this to the user without preventing them from saving.

    let itemFieldMapping: Record<string, string> | null = null;
    if (!pushToOIAnalytics) {
      itemFieldMapping = this.itemFieldMappingToSend();
    }

    const command: ConfigurationWorkflowCommandDTO = {
      // The edited workflow keeps its own id (real, or a caller-minted temp_ one for a not-yet-saved
      // workflow) - a new one or a copy has none yet, the caller decides what to give it.
      id: this.mode() === 'edit' ? (this.workflow?.id ?? null) : null,
      name: formValue.name,
      discoveryScope,
      identityKeyFields: pushToOIAnalytics ? [] : this.identityKeyFields(),
      eligibilityFilter: this.eligibilityFilter(),
      itemFieldMapping,
      pushToOIAnalytics,
      scanModeId: formValue.scanModeId || null,
      enabled: formValue.enabled
    };
    return { command };
  }
}

/**
 * Opens the wizard from the Explore button of a data source (see {@link ExploreWizardOptions}). Emits what it closes with
 * (see {@link ExploreWizardResult}); completes without emitting if it is dismissed.
 */
export function openExploreWizard(modalService: ModalService, options: ExploreWizardOptions): Observable<ExploreWizardResult> {
  const modalRef = modalService.open(EditWorkflowModalComponent, { size: 'xl', backdrop: 'static' });
  const component: EditWorkflowModalComponent = modalRef.componentInstance;
  component.prepareForExploration(options);
  return modalRef.result;
}

/** Whether one enabling rule passes against the referral field's current mapped value. */
function evaluatesTrue(rule: FieldEnablingRule, values: Record<string, string>): boolean {
  const referralValue = values[rule.referralPath] ?? '';
  // Resolved per record at run time: the rule may pass for some of them
  if (referralValue.includes('{{')) {
    return true;
  }
  const matchesAnyValue = rule.values.some(value => String(value) === referralValue);
  if (rule.operator === 'CONTAINS') {
    return rule.values.some(value => referralValue.includes(String(value)));
  }
  if (rule.operator === 'NOT_EQUAL') {
    return !matchesAnyValue;
  }
  return matchesAnyValue;
}

/** Builds a MappableField from a manifest attribute, capturing its type (and selectableValues, for 'string-select')
 *  so the mapping UI can render a type-appropriate constant input instead of a bare text box. */
function toMappableField(
  attribute: OIBusAttribute,
  path: string,
  enablingRules: Array<FieldEnablingRule>,
  ancestorLabelKeys: Array<string>
): MappableField {
  const field: MappableField = {
    path,
    translationKey: attribute.translationKey,
    attributeType: attribute.type,
    enablingRules,
    ancestorLabelKeys,
    mandatory: attribute.validators?.some(validator => validator.type === 'REQUIRED') ?? false,
    // Only a subset of attribute shapes even carry a defaultValue property, and it's nullable on most
    // of those (meaning "no real default", still genuinely required) - 'boolean' is the one type whose
    // defaultValue is never null.
    hasUsableDefault: 'defaultValue' in attribute && attribute.defaultValue !== null
  };
  if (attribute.type === 'string-select') {
    field.selectableValues = attribute.selectableValues;
  }
  return field;
}

// `scanMode` is the one manifest key renamed on its way into a mappable path (to `scanModeId`, what the
// workflow command actually uses) - applied wherever it appears, including as a referral/target of some
// enabling condition, so path resolution stays consistent with the field's own listed path.
function resolveChildPath(pathPrefix: string, key: string): string {
  const resolvedKey = key === 'scanMode' ? 'scanModeId' : key;
  return pathPrefix ? `${pathPrefix}.${resolvedKey}` : resolvedKey;
}

/**
 * Recursively walks one object attribute's children (the item root, `settings`, or any object nested
 * further under it), resolving each `enablingConditions` entry declared on it - relative to its own
 * direct children per the manifest convention (see dynamic-form.builder.ts's addEnablingConditions) -
 * into full item-root-relative paths, and pushing one MappableField per non-object child. A child that
 * is itself an object is recursed into (never pushed as its own field - there's no single value to map
 * a whole nested group of settings to); its own children inherit every rule gating the parent, plus
 * whatever rule of its own further narrows them, and every ancestor's own label beyond the top-level
 * `settings` wrapper (skipped as a breadcrumb entry - every settings.* field already implies it).
 */
function walkItemAttributes(
  objectAttribute: OIBusObjectAttribute,
  pathPrefix: string,
  inheritedRules: Array<FieldEnablingRule>,
  ancestorLabelKeys: Array<string>,
  fields: Array<MappableField>
): void {
  const ownRuleByChildKey = new Map<string, FieldEnablingRule>();
  for (const condition of objectAttribute.enablingConditions) {
    const referralPath = resolveChildPath(pathPrefix, condition.referralPathFromRoot);
    ownRuleByChildKey.set(condition.targetPathFromRoot, { referralPath, values: condition.values, operator: condition.operator });
  }

  for (const attribute of objectAttribute.attributes) {
    const childPath = resolveChildPath(pathPrefix, attribute.key);
    const ownRule = ownRuleByChildKey.get(attribute.key);
    const rules = ownRule ? [...inheritedRules, ownRule] : inheritedRules;

    if (attribute.type === 'object') {
      const childAncestors = pathPrefix === '' ? ancestorLabelKeys : [...ancestorLabelKeys, attribute.translationKey];
      walkItemAttributes(attribute, childPath, rules, childAncestors, fields);
    } else {
      fields.push(toMappableField(attribute, childPath, rules, ancestorLabelKeys));
    }
  }
}

/**
 * Flattens a south connector's item manifest into a mappable-field list: every top-level item
 * attribute (name, enabled, ...), the connector-specific settings.* fields nested arbitrarily deep
 * under the manifest's own `settings` object attribute, `scanMode` renamed to the `scanModeId` path
 * the workflow command actually uses, plus the historian fields the real item form adds by hand
 * outside the manifest tree (gated on the same `manifest.modes.history` flag it uses). Each field
 * carries the manifest's own `enablingConditions`, resolved to full paths, so the UI can hide a field
 * until its condition is met.
 */
function buildItemMappableFields(manifest: SouthConnectorManifest): Array<MappableField> {
  const fields: Array<MappableField> = [];
  walkItemAttributes(manifest.items.rootAttribute, '', [], [], fields);
  if (manifest.modes.history) {
    fields.push(...HISTORIAN_ITEM_FIELDS);
  }
  return fields;
}

/** A mapping template with its `{{field}}` expressions replaced by the record values - an example item name. */
function resolveTemplate(template: string, record: OIBusRecord): string {
  return template.replace(TEMPLATE_PLACEHOLDER, (_match, field: string) => {
    const value = record[field];
    return value === null || value === undefined ? '' : String(value);
  });
}

/** Trims every value, keeping only non-empty entries - a blank expression means "not mapped". */
function nonEmptyEntries(values: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    const trimmed = value?.trim();
    if (trimmed) {
      result[key] = trimmed;
    }
  }
  return result;
}
