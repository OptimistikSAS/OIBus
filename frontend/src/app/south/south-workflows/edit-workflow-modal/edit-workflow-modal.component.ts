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

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { Observable } from 'rxjs';

import { ConfigurationWorkflowCommandDTO, WorkflowPreviewResultDTO } from '@oibus/shared/api/configuration-workflow.model';
import { ScanModeDTO } from '@oibus/shared/api/scan-mode.model';
import { SouthConnectorItemCommandDTO } from '@oibus/shared/api/south-connector.model';
import { OIBusRecordListContent } from '@oibus/shared/common/content.model';
import { OIBusScanModeAttribute } from '@oibus/shared/connector/form.model';
import { SouthConnectorManifest } from '@oibus/shared/connector/south-manifest.model';
import { SouthSettings } from '@oibus/shared/connector/south-settings.model';
import { RECORD_FILTER_OPERATORS, RecordFilterCondition, RecordFilterOperator } from '@oibus/shared/domain/configuration-workflow.model';

import { ConfigurationWorkflowService } from '../../../services/configuration-workflow.service';
import { EngineService } from '../../../services/engine.service';
import { SouthConnectorService } from '../../../services/south-connector.service';
import { ExploreTreeComponent } from '../../../shared/explore-tree/explore-tree.component';
import { extractErrorMessage } from '../../../shared/extract-error-message';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../../../shared/form/form-validation-directives';
import { OibCodeBlockComponent } from '../../../shared/form/oib-code-block/oib-code-block.component';
import { trackControl } from '../../../shared/form/tracked-control';
import { ModalService } from '../../../shared/modal.service';
import { ModalStepsComponent } from '../../../shared/modal-steps/modal-steps.component';
import { ObservableState, SaveButtonComponent } from '../../../shared/save-button/save-button.component';
import { TransformerTestResultComponent } from '../../../shared/transformer-test-result/transformer-test-result.component';
import { UnsavedChangesConfirmationService } from '../../../shared/unsaved-changes-confirmation.service';
import { SouthItemGroups } from '../../south-items/south-item-groups';
import { AddItemsStepComponent } from '../add-items-step/add-items-step.component';
import { ExploreStepComponent } from '../explore-step/explore-step.component';
import {
  buildItemMappableFields,
  HISTORY_ITEM_DEFAULTS,
  itemFieldMappingToSend,
  itemMappingProblem,
  MappableField,
  SCHEDULE_ITEM_PATHS
} from '../item-field-mapping-form/item-field-mapping';
import { ItemFieldMappingFormComponent } from '../item-field-mapping-form/item-field-mapping-form.component';
import { TEMP_ID_PREFIX } from '../workflow-command';
import { WorkflowPreviewComponent } from '../workflow-preview/workflow-preview.component';
import { WorkflowRecordsPreviewComponent } from '../workflow-records-preview/workflow-records-preview.component';
import {
  ExploreFlow,
  ExploreFlowAction,
  ExploreWizardOptions,
  ExploreWizardResult,
  SQL_WORKFLOW_STEPS,
  TREE_WORKFLOW_STEPS,
  WizardStep,
  WORKFLOW_STEPS,
  workflowNodeIds,
  WorkflowProblem,
  WorkflowStep
} from './explore-wizard';

/** A preview run of the workflow as currently edited (see `ConfigurationWorkflowService.previewCommand`). */
interface PreviewState {
  readonly loading: boolean;
  readonly error: string | null;
  readonly result: WorkflowPreviewResultDTO | null;
}

/** How many discovered records the Filter step lists, to keep it light on large sources. */
const PREVIEW_RECORD_LIMIT = 20;

@Component({
  selector: 'oib-edit-workflow-modal',
  templateUrl: './edit-workflow-modal.component.html',
  styleUrl: './edit-workflow-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    FormsModule,
    TranslateDirective,
    TranslatePipe,
    OI_FORM_VALIDATION_DIRECTIVES,
    SaveButtonComponent,
    ExploreTreeComponent,
    OibCodeBlockComponent,
    TransformerTestResultComponent,
    WorkflowPreviewComponent,
    WorkflowRecordsPreviewComponent,
    ModalStepsComponent,
    ExploreStepComponent,
    AddItemsStepComponent,
    ItemFieldMappingFormComponent
  ]
})
export default class EditWorkflowModalComponent implements AfterViewInit {
  private modal = inject(NgbActiveModal);
  private fb = inject(NonNullableFormBuilder);
  private unsavedChangesConfirmation = inject(UnsavedChangesConfirmationService);
  private southConnectorService = inject(SouthConnectorService);
  private configurationWorkflowService = inject(ConfigurationWorkflowService);
  private engineService = inject(EngineService);
  private injector = inject(Injector);

  // The inline, read-only explore tree shown alongside the SQL query editor (for the SQL connectors that can be
  // explored, see showSqlExploreTree) - undefined until that branch of the template actually renders it.
  private readonly inlineExploreTree = viewChild<ExploreTreeComponent>('inlineExploreTree');
  /** The Explore step, where the nodes are checked - only when opened from the Explore button (see `exploring`) */
  readonly exploreStep = viewChild(ExploreStepComponent);
  readonly addItemsStep = viewChild(AddItemsStepComponent);

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
  /** The fields of the discovered records, suggested when writing a condition or an identity key */
  readonly recordFields = computed(() => {
    const records = this.filterPreview()?.result?.records ?? [];
    return Array.from(new Set(records.slice(0, PREVIEW_RECORD_LIMIT).flatMap(record => Object.keys(record))));
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
  protected readonly subscriptionOnly = computed(() => this.itemScheduleType() === 'SUBSCRIPTION');
  /** The schedules an item can follow: the subscription is not one of them for a connector that only polls */
  readonly itemScanModes = computed(() =>
    this.itemScheduleType() === 'POLL' ? this.scanModes().filter(scanMode => scanMode.id !== 'subscription') : this.scanModes()
  );
  /**
   * The groups of the page (south-detail saves them through the API, edit-south in memory), changed through it only, like
   * EditSouthItemModalComponent's own group dropdown.
   */
  protected readonly groupStore = signal<SouthItemGroups | null>(null);
  private workflow: ConfigurationWorkflowCommandDTO | null = null;
  /** Every other workflow of the connector, for the name uniqueness check. */
  private existingWorkflows: Array<{ id: string | null; name: string }> = [];
  protected readonly currentManifest = signal<SouthConnectorManifest | null>(null);
  private southId!: string;
  private southSettings!: SouthSettings;

  /** What the wizard offers on the checked nodes of its Explore step - only when opened from the Explore button (see `exploring`) */
  protected readonly exploreOptions = signal<ExploreWizardOptions | null>(null);
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
  readonly exploreCheckedCount = computed(() => this.exploreStep()?.checkedIds().size ?? 0);

  /** The synchronisation the wizard edits - one given by the opener, or picked in the Source step - null for a new one */
  readonly syncTargetId = signal<string | null>(null);
  /** The nodes the edited synchronisation had when it was picked, to tell what the wizard adds to it and removes from it */
  protected readonly originalNodeIds = signal<Array<string>>([]);
  /** The nodes checked before an existing synchronisation was picked, which a new one goes back to */
  private pickedNodeIds: Array<string> | null = null;
  /** The synchronisations of the connector that discover from nodes, which the checked ones can be added to */
  readonly treeWorkflows = computed(() =>
    (this.exploreOptions()?.sync?.existingWorkflows ?? []).flatMap(workflow => {
      const nodeIds = workflowNodeIds(workflow.discoveryScope);
      return nodeIds ? [{ id: workflow.id, name: workflow.name, nodeIds }] : [];
    })
  );
  /** Whether the Explore step offers to keep in sync with a synchronisation the connector already has, rather than a new one */
  readonly showSyncTarget = computed(
    () =>
      !this.isSqlFamily() &&
      this.flowActions().some(action => action.flow === 'sync') &&
      this.mode() !== 'copy' &&
      this.treeWorkflows().length > 0
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

  /** Every field the connector's manifest (+ the historian fields it adds outside the manifest, when supported) exposes on an item. */
  readonly itemMappableFields = signal<Array<MappableField>>([]);
  /** One expression string per itemMappableFields entry, keyed by its path - blank means "not mapped". */
  readonly itemFieldMappingValues = signal<Record<string, string>>({});

  readonly identityKeyFields = signal<Array<string>>([]);
  /**
   * The fields the mapping form shows: all of them, but the schedule of the items of a connector that only subscribes - it is
   * the subscription, nothing to map (see `itemFieldMappingToSend`).
   */
  protected readonly activeMappableFields = computed(() =>
    this.subscriptionOnly() ? this.itemMappableFields().filter(field => field.path !== 'scanModeId') : this.itemMappableFields()
  );
  /**
   * The fields of the discovered records the mapping can use as `{{field}}`: the ones the connector tells about, and the ones
   * of the records the filter preview found
   */
  readonly availableRecordFields = computed(() =>
    Array.from(new Set([...(this.currentManifest()?.discovery?.recordFields ?? []), ...this.recordFields()]))
  );
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
   *  implementation (a separate capability from discovery). Not when the wizard has its Explore step: the tables are
   *  there, and a second tree would open a second explore session (through the connector's endpoints, whatever the
   *  wizard explores). */
  readonly showSqlExploreTree = computed(() => this.isSqlFamily() && this.currentManifest()?.explore === true && !this.exploring());

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
    this.syncSelectionKey = null;
    this.originalNodeIds.set(target?.mode === 'edit' ? [...this.discoveryNodeIds()] : []);
    this.step.set('explore');
    // The tree is rendered by the first change detection pass, which may come after this call
    afterNextRender(
      () =>
        this.exploreStep()
          ?.tree()
          .prepare(options.exploreConnectorId, options.southSettings, options.manifest.id, {
            api: options.exploreApi,
            // a node gets a checkbox only when there is something to do with the checked ones
            checkable: this.flowActions().length > 0,
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
    const tree = this.exploreStep()?.tree();
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
  /** The tables the metadata query was last written from, to keep it (maybe edited) when they are checked again */
  private syncSelectionKey: string | null = null;

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
    const nodeIds = Array.from(this.exploreStep()?.checkedIds() ?? []);
    // the plain query is the one of a metadata query, which is run as it is: with no time range
    const mapping =
      flow === 'item' ? options.manifest.discovery!.defaults!.itemFieldMapping : { name: '{{name}}', 'settings.query': '{{plainQuery}}' };
    // Checked again with the same tables, the query already written (and maybe edited) is kept
    const selectionKey = JSON.stringify(nodeIds);
    if (flow === 'sync' && selectionKey === this.syncSelectionKey && this.discoveryQuery().trim()) {
      this.flow.set('sync');
      this.goToStep(this.workflowSteps()[0]);
      return;
    }
    this.selectionPending.set(true);
    this.selectionError.set(null);
    this.selectionNone.set(false);
    this.discover({ nodeIds, combine: true }, mapping).subscribe({
      next: commands => {
        this.selectionPending.set(false);
        const command = commands[0];
        if (!command) {
          this.selectionNone.set(true);
        } else if (flow === 'item') {
          const result: ExploreWizardResult = { kind: 'item', command };
          this.modal.close(result);
        } else {
          this.discoveryQuery.set('query' in command.settings ? String(command.settings.query) : '');
          this.syncSelectionKey = selectionKey;
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

  /**
   * The items a discovery scope gives, mapped as told: through the opener when the data source is not a south connector (a
   * history query), through the south connector endpoints otherwise.
   */
  readonly discover = (
    scope: Record<string, unknown>,
    mapping: Record<string, string>
  ): Observable<Array<SouthConnectorItemCommandDTO>> => {
    const options = this.exploreOptions()!;
    return options.discover
      ? options.discover(scope, mapping)
      : this.southConnectorService.discoverItems(options.southId, options.manifest.id, options.southSettings, scope, mapping);
  };

  goToStep(step: WizardStep) {
    const exploreStep = this.exploreStep();
    if (this.step() === 'explore' && exploreStep) {
      this.discoveryNodeIds.set(Array.from(exploreStep.checkedIds()));
    }
    this.step.set(step);
    if (step === 'filter') {
      this.previewFilter();
    } else if (step === 'items') {
      this.ensureFilterPreview();
    } else if (step === 'review') {
      this.previewReview();
    }
  }

  addItems() {
    const addItemsStep = this.addItemsStep();
    if (!addItemsStep?.canAdd()) {
      return;
    }
    const result: ExploreWizardResult = { kind: 'items', commands: addItemsStep.includedCommands() };
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
      const mappingProblem = itemMappingProblem(this.activeMappableFields(), this.itemFieldMappingValues());
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
      itemFieldMapping = itemFieldMappingToSend(this.activeMappableFields(), this.itemFieldMappingValues(), this.subscriptionOnly());
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
