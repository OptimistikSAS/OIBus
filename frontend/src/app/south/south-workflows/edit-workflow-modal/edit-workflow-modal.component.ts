import { AfterViewInit, ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
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
import { Observable, switchMap } from 'rxjs';

import { ConfigurationWorkflowCommandDTO } from '@oibus/shared/api/configuration-workflow.model';
import { ScanModeDTO } from '@oibus/shared/api/scan-mode.model';
import { SouthItemGroupCommandDTO, SouthItemGroupDTO } from '@oibus/shared/api/south-connector.model';
import { OIBusRecordListContent } from '@oibus/shared/common/content.model';
import { OIBusAttribute, OIBusAttributeType, OIBusEnablingCondition, OIBusObjectAttribute } from '@oibus/shared/connector/form.model';
import { SouthConnectorManifest, SQL_FAMILY_SOUTH_TYPES } from '@oibus/shared/connector/south-manifest.model';
import { SouthSettings } from '@oibus/shared/connector/south-settings.model';
import { RECORD_FILTER_OPERATORS, RecordFilterCondition, RecordFilterOperator } from '@oibus/shared/domain/configuration-workflow.model';
import { SouthConnectorExploreEntry } from '@oibus/shared/domain/south-connector.model';

import { EngineService } from '../../../services/engine.service';
import { SouthConnectorService } from '../../../services/south-connector.service';
import { ExploreTreeComponent } from '../../../shared/explore-tree/explore-tree.component';
import { extractErrorMessage } from '../../../shared/extract-error-message';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../../../shared/form/form-validation-directives';
import { OibCodeBlockComponent } from '../../../shared/form/oib-code-block/oib-code-block.component';
import { trackControl } from '../../../shared/form/tracked-control';
import { ModalService } from '../../../shared/modal.service';
import { ObservableState, SaveButtonComponent } from '../../../shared/save-button/save-button.component';
import { SouthExploreModalComponent } from '../../../shared/south-explore-modal/south-explore-modal.component';
import { TransformerTestResultComponent } from '../../../shared/transformer-test-result/transformer-test-result.component';
import { UnsavedChangesConfirmationService } from '../../../shared/unsaved-changes-confirmation.service';
import { EditSouthItemGroupModalComponent } from '../../south-items/edit-south-item-group-modal/edit-south-item-group-modal.component';

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
  /** True when some other field's visibility depends on this field's own value - such a field can only
   *  be mapped to a constant (its value must be knowable while editing, not resolved per-record at run time). */
  isEnablingReferral?: boolean;
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

type AddOrEditGroup = (command: {
  mode: 'create' | 'edit';
  group: SouthItemGroupCommandDTO;
}) => Observable<SouthItemGroupDTO | SouthItemGroupCommandDTO>;
type DeleteGroup = (group: SouthItemGroupDTO | SouthItemGroupCommandDTO) => Observable<void>;

/** Sentinel select-option value meaning "map this to a {{field}} expression instead of a fixed value". */
const VARIABLE_SENTINEL = '__variable__';

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
    ReactiveFormsModule,
    FormsModule,
    TranslateDirective,
    TranslatePipe,
    OI_FORM_VALIDATION_DIRECTIVES,
    SaveButtonComponent,
    NgbDropdownModule,
    ExploreTreeComponent,
    OibCodeBlockComponent,
    TransformerTestResultComponent
  ]
})
export default class EditWorkflowModalComponent implements AfterViewInit {
  private modal = inject(NgbActiveModal);
  private fb = inject(NonNullableFormBuilder);
  private unsavedChangesConfirmation = inject(UnsavedChangesConfirmationService);
  private modalService = inject(ModalService);
  private southConnectorService = inject(SouthConnectorService);
  private engineService = inject(EngineService);

  // The inline, read-only explore tree shown alongside the SQL query editor (SQLite only, for now -
  // see showSqlExploreTree) - undefined until that branch of the template actually renders it.
  private readonly inlineExploreTree = viewChild(ExploreTreeComponent);

  readonly mode = signal<'create' | 'edit' | 'copy'>('create');
  readonly state = new ObservableState();
  /** True when opened from south-detail (the caller saves the workflow straight to the API); false when
   *  opened from edit-south (the caller keeps it in memory until the connector itself is saved) - only
   *  changes the confirm button's wording/icon, like EditSouthItemModalComponent's own directSave.
   *  Set by the opener right after opening the modal, before its first change detection. */
  directSave = true;
  readonly scanModes = signal<Array<ScanModeDTO>>([]);
  /**
   * The page's own group list, shared by reference and mutated in place (created groups are pushed, deleted ones
   * spliced): edit-south keeps its in-memory groups in it. The template renders the `groups` snapshot instead, refreshed
   * after every change.
   */
  private sharedGroups: Array<SouthItemGroupDTO | SouthItemGroupCommandDTO> = [];
  readonly groups = signal<Array<SouthItemGroupDTO | SouthItemGroupCommandDTO>>([]);
  private workflow: ConfigurationWorkflowCommandDTO | null = null;
  /** Every other workflow of the connector, for the name uniqueness check. */
  private existingWorkflows: Array<{ id: string | null; name: string }> = [];
  private readonly currentManifest = signal<SouthConnectorManifest | null>(null);
  private southId!: string;
  private southSettings!: SouthSettings;

  /** Root node id currently picked via the explore-tree node picker (tree-based connectors only) -
   *  null means "browse from the data source's true root". */
  readonly discoveryRootNodeId = signal<string | null>(null);
  /** The dedicated metadata query, as typed by the user (SQL-family connectors only). */
  readonly discoveryQuery = signal('');

  /** "Test query" state - runs discoveryQuery as currently typed, independent of Save. */
  readonly queryTestRunning = signal(false);
  readonly queryTestError = signal<string | null>(null);
  readonly queryTestResult = signal<OIBusRecordListContent | null>(null);

  /** Whether OIBus is currently registered with OIAnalytics - gates the "Push to OIAnalytics" mode,
   *  refreshed each time this modal is prepared (registration can change between two workflow edits). */
  readonly isRegistered = signal(false);

  // Saves through the page's own group callbacks, exactly like EditSouthItemModalComponent's own group
  // dropdown - bound from south-detail.component.ts (direct) or edit-south.component.ts (in memory) and
  // passed down through prepare().
  private addOrEditGroup!: AddOrEditGroup;
  private deleteGroup!: DeleteGroup;

  readonly operators: ReadonlyArray<RecordFilterOperator> = RECORD_FILTER_OPERATORS;
  readonly variableSentinel = VARIABLE_SENTINEL;

  /** Every field the connector's manifest (+ the historian fields it adds outside the manifest, when supported) exposes on an item. */
  readonly itemMappableFields = signal<Array<MappableField>>([]);
  /** One expression string per itemMappableFields entry, keyed by its path - blank means "not mapped". */
  readonly itemFieldMappingValues = signal<Record<string, string>>({});

  readonly identityKeyFields = signal<Array<string>>([]);
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
  /** Whether the workflow pushes the discovered records to OIAnalytics (remote mode) rather than creating items. */
  readonly pushToOIAnalytics = computed(() => this.pushToOIAnalyticsControl()?.value ?? false);

  /** Tree-shaped discovery scope (a root node to browse) - OPC-UA, Folder Scanner. Checked before
   *  isSqlFamily since a manifest could in principle declare both (none do today). */
  readonly isTreeBased = computed(() => this.currentManifest()?.explore === true && !this.isSqlFamily());

  /** Query-shaped discovery scope (a dedicated metadata query) - the SQL-family connectors that have
   *  a `discover()` implementation today (see SQL_FAMILY_SOUTH_TYPES's own doc comment for why ODBC/
   *  OLEDB aren't included). */
  readonly isSqlFamily = computed(() => {
    const manifest = this.currentManifest();
    return !!manifest && SQL_FAMILY_SOUTH_TYPES.includes(manifest.id);
  });

  /** Whether to show the read-only explore tree above the SQL query editor, for reference while
   *  writing the query - only SQLite has an `explore()` implementation among the SQL-family connectors
   *  today, so this is the same condition as isSqlFamily for now, but stated independently since it's
   *  conceptually a separate capability (a future SQL connector could get discover() without explore(),
   *  or vice versa). */
  readonly showSqlExploreTree = computed(() => this.isSqlFamily() && this.currentManifest()?.explore === true);

  /** Name of the group currently mapped as a constant for the 'groupId' field, or '' when none is. */
  readonly selectedGroupName = computed(() => {
    const groupId = this.itemFieldMappingValues()['groupId'];
    if (!groupId) {
      return '';
    }
    return this.groups().find(group => group.id === groupId)?.standardSettings.name ?? groupId;
  });

  prepareForCreation(
    scanModes: Array<ScanModeDTO>,
    existingWorkflows: Array<{ id: string | null; name: string }>,
    manifest: SouthConnectorManifest,
    southId: string,
    southSettings: SouthSettings,
    groups: Array<SouthItemGroupDTO | SouthItemGroupCommandDTO> = [],
    addOrEditGroup?: AddOrEditGroup,
    deleteGroup?: DeleteGroup
  ) {
    this.prepare('create', scanModes, existingWorkflows, manifest, null, southId, southSettings, groups, addOrEditGroup, deleteGroup);
  }

  prepareForEdition(
    scanModes: Array<ScanModeDTO>,
    existingWorkflows: Array<{ id: string | null; name: string }>,
    manifest: SouthConnectorManifest,
    workflow: ConfigurationWorkflowCommandDTO,
    southId: string,
    southSettings: SouthSettings,
    groups: Array<SouthItemGroupDTO | SouthItemGroupCommandDTO> = [],
    addOrEditGroup?: AddOrEditGroup,
    deleteGroup?: DeleteGroup
  ) {
    this.prepare('edit', scanModes, existingWorkflows, manifest, workflow, southId, southSettings, groups, addOrEditGroup, deleteGroup);
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
    groups: Array<SouthItemGroupDTO | SouthItemGroupCommandDTO> = [],
    addOrEditGroup?: AddOrEditGroup,
    deleteGroup?: DeleteGroup
  ) {
    const clone: ConfigurationWorkflowCommandDTO = { ...structuredClone(workflow), id: null, name: `${workflow.name}-copy` };
    this.prepare('copy', scanModes, existingWorkflows, manifest, clone, southId, southSettings, groups, addOrEditGroup, deleteGroup);
  }

  private prepare(
    mode: 'create' | 'edit' | 'copy',
    scanModes: Array<ScanModeDTO>,
    existingWorkflows: Array<{ id: string | null; name: string }>,
    manifest: SouthConnectorManifest,
    workflow: ConfigurationWorkflowCommandDTO | null,
    southId: string,
    southSettings: SouthSettings,
    groups: Array<SouthItemGroupDTO | SouthItemGroupCommandDTO>,
    addOrEditGroup: AddOrEditGroup | undefined,
    deleteGroup: DeleteGroup | undefined
  ) {
    this.mode.set(mode);
    this.scanModes.set(scanModes);
    this.sharedGroups = groups;
    this.refreshGroups();
    this.addOrEditGroup = addOrEditGroup!;
    this.deleteGroup = deleteGroup!;
    this.existingWorkflows = existingWorkflows;
    this.workflow = workflow;
    this.currentManifest.set(manifest);
    this.southId = southId;
    this.southSettings = southSettings;
    this.itemMappableFields.set(buildItemMappableFields(manifest));

    const scope: Record<string, unknown> = workflow?.discoveryScope ?? {};
    this.discoveryRootNodeId.set(typeof scope['rootNodeId'] === 'string' ? scope['rootNodeId'] : null);
    this.discoveryQuery.set(typeof scope['query'] === 'string' ? scope['query'] : '');
    this.itemFieldMappingValues.set({ ...(workflow?.itemFieldMapping ?? {}) });
    this.identityKeyFields.set(workflow ? [...workflow.identityKeyFields] : []);
    this.eligibilityFilter.set(workflow ? workflow.eligibilityFilter.map(condition => ({ ...condition })) : []);
    this.refreshRegistrationStatus();
    this.initForm();
  }

  /** Re-renders the page's group list after it was changed in place. */
  private refreshGroups() {
    this.groups.set([...this.sharedGroups]);
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

  private initForm() {
    // SQL-family connectors are query-based (one item = one free-form query, item != point) - a
    // workflow there can only ever push the raw discovered records to OIAnalytics, never create/update
    // items itself (see isSqlFamily's own doc comment). pushToOIAnalytics is forced true and the mode
    // choice is hidden from the template for these.
    this.form.reset({
      name: this.workflow?.name ?? '',
      scanModeId: this.workflow?.scanModeId ?? null,
      pushToOIAnalytics: this.isSqlFamily() ? true : (this.workflow?.pushToOIAnalytics ?? false),
      enabled: this.workflow?.enabled ?? true
    });
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
        return this.scanModes().map(scanMode => scanMode.id);
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
  allowsVariable(field: MappableField): boolean {
    return (
      !field.isEnablingReferral &&
      field.attributeType !== 'scan-mode' &&
      field.attributeType !== 'group-select' &&
      !CONSTANT_ONLY_ITEM_PATHS.has(field.path)
    );
  }

  /** Placeholder for a plain-text item field's input - a constant-only field (e.g. maxReadInterval) gets
   *  a hint that it can't take a {{ }} expression, instead of the generic "constant or {{field}}" one. */
  itemFieldPlaceholderKey(field: MappableField): string {
    return this.allowsVariable(field)
      ? 'south.workflows.item-field-mapping-expression-placeholder'
      : 'south.workflows.mapping-constant-placeholder';
  }

  onSelectGroup(groupId: string | null) {
    this.setMappingValue('groupId', groupId ?? '');
  }

  /** Mirrors EditSouthItemModalComponent's own onAddGroup - opens the same group modal, saves it via the
   *  callback threaded in from the page (directly against the live south connector from south-detail, in
   *  memory from edit-south), then maps the newly created group as this field's constant. */
  onAddGroup() {
    const modalRef = this.modalService.open(EditSouthItemGroupModalComponent, { backdrop: 'static' });
    const component: EditSouthItemGroupModalComponent = modalRef.componentInstance;
    component.directSave = this.directSave;
    component.prepareForCreation(this.scanModes(), this.sharedGroups, this.currentManifest()!);
    modalRef.result.pipe(switchMap(result => this.addOrEditGroup(result))).subscribe(groupResult => {
      this.sharedGroups.push(groupResult);
      this.refreshGroups();
      this.onSelectGroup(groupResult.id!);
    });
  }

  onEditGroup(group: SouthItemGroupDTO | SouthItemGroupCommandDTO, event: Event) {
    event.stopPropagation();
    const modalRef = this.modalService.open(EditSouthItemGroupModalComponent, { backdrop: 'static' });
    const component: EditSouthItemGroupModalComponent = modalRef.componentInstance;
    component.directSave = this.directSave;
    component.prepareForEdition(this.scanModes(), this.sharedGroups, this.currentManifest()!, group);
    modalRef.result.pipe(switchMap(result => this.addOrEditGroup(result))).subscribe(groupResult => {
      const index = this.sharedGroups.findIndex(existing => existing.id === groupResult.id);
      if (index >= 0) {
        this.sharedGroups[index] = groupResult;
      } else {
        this.sharedGroups.push(groupResult);
      }
      this.refreshGroups();
    });
  }

  onDeleteGroup(group: SouthItemGroupDTO | SouthItemGroupCommandDTO, event: Event) {
    event.stopPropagation();
    this.deleteGroup(group).subscribe(() => {
      // Removed in place - `groups` is the page's own list (edit-south's in-memory groups), which must
      // lose the deleted group too.
      const index = this.sharedGroups.findIndex(existing => existing.id === group.id);
      if (index >= 0) {
        this.sharedGroups.splice(index, 1);
      }
      this.refreshGroups();
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
    return (field.enablingRules ?? []).every(rule => evaluatesTrue(rule, values));
  }

  /** Whether a mandatory, currently-visible field is missing a mapped value - checked at save time.
   *  Exempt: a field with a usable manifest defaultValue (e.g. `enabled` falls back to `true` if left
   *  unmapped, same as EditSouthItemModalComponent's own pre-filled control - never actually "missing"),
   *  and scanModeId once the item is mapped into a group (mirrors that same form's scanModeId.disable()
   *  when grouped: a grouped item's schedule comes from the group instead). */
  isMandatoryFieldMissing(field: MappableField): boolean {
    if (!field.mandatory || field.hasUsableDefault) {
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

  /** Opens the explore tree in picker mode - selecting a node sets it as the discovery root. */
  openNodePicker() {
    const modalRef = this.modalService.open(SouthExploreModalComponent, { size: 'lg' });
    const component: SouthExploreModalComponent = modalRef.componentInstance;
    component.prepare(this.southId, this.southSettings, this.currentManifest()!.id, undefined, true);
    modalRef.result.subscribe((entry: SouthConnectorExploreEntry) => {
      this.discoveryRootNodeId.set(entry.id);
    });
  }

  /** Resets the discovery root back to "browse from the data source's true root". */
  clearRootNodeId() {
    this.discoveryRootNodeId.set(null);
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
    this.formError.set(null);
    if (!this.form.valid) {
      return;
    }
    const formValue = this.form.getRawValue();
    // SQL-family connectors can never create/update items (see initForm()'s own comment) - re-clamped
    // here too, defensively, not just via the mode choice being hidden from the template.
    const pushToOIAnalytics = this.isSqlFamily() ? true : formValue.pushToOIAnalytics;

    let discoveryScope: Record<string, unknown>;
    if (this.isSqlFamily()) {
      if (!this.discoveryQuery().trim()) {
        this.formError.set('south.workflows.discovery-scope-query-required');
        return;
      }
      discoveryScope = { query: this.discoveryQuery().trim() };
    } else if (this.isTreeBased()) {
      // No rootNodeId at all means "browse from the data source's true root" - a deliberate, valid choice.
      const rootNodeId = this.discoveryRootNodeId();
      discoveryScope = rootNodeId ? { rootNodeId } : {};
    } else {
      discoveryScope = {};
    }

    // Deliberately not blocked here when pushToOIAnalytics is picked while OIBus isn't registered -
    // mirrors ConfigurationWorkflowService's own server-side behavior, which likewise now only warns
    // (see its checkMode()'s own comment). The "mode-remote-not-registered" alert shown next to the
    // mode picker already surfaces this to the user without preventing them from saving.

    let itemFieldMapping: Record<string, string> | null = null;
    if (!pushToOIAnalytics) {
      // Identity keys only drive the local diff against the previous run - a remote workflow has none.
      if (this.identityKeyFields().length === 0) {
        this.formError.set('south.workflows.identity-key-fields-none');
        return;
      }

      const mappingValues = this.itemFieldMappingValues();
      // A field other fields depend on for their own visibility, plus the schedule/group fields, must be
      // knowable while editing (or reference something real) rather than resolved per-record at run time -
      // a select-type one of these can't even reach this state through the UI (its {{ }} option is
      // omitted), but a free-text one still could.
      const hasConstantOnlyViolation = this.itemMappableFields().some(
        field => !this.allowsVariable(field) && (mappingValues[field.path] ?? '').includes('{{')
      );
      if (hasConstantOnlyViolation) {
        this.formError.set('south.workflows.mapping-constant-only');
        return;
      }

      // Every visible, manifest-REQUIRED field must be mapped to something - otherwise a workflow can be
      // saved in a state item creation would only reject later, at run time (see isMandatoryFieldMissing).
      const hasMissingMandatoryField = this.itemMappableFields().some(
        field => this.isItemFieldVisible(field) && this.isMandatoryFieldMissing(field)
      );
      if (hasMissingMandatoryField) {
        this.formError.set('south.workflows.mapping-mandatory-missing');
        return;
      }

      // A field hidden by an unmet enabling condition keeps whatever value it had while editing (so
      // toggling the referral back and forth doesn't lose data), but is stripped here at save time - it
      // isn't actually part of the item this mapping would produce.
      const visibleItemPaths = new Set(
        this.itemMappableFields()
          .filter(field => this.isItemFieldVisible(field))
          .map(field => field.path)
      );
      const itemFieldMappingValuesToSave: Record<string, string> = {};
      for (const [path, value] of Object.entries(mappingValues)) {
        if (visibleItemPaths.has(path)) {
          itemFieldMappingValuesToSave[path] = value;
        }
      }
      itemFieldMapping = nonEmptyEntries(itemFieldMappingValuesToSave);
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
    this.modal.close(command);
  }
}

/** Whether one enabling rule passes against the referral field's current mapped value. */
function evaluatesTrue(rule: FieldEnablingRule, values: Record<string, string>): boolean {
  const referralValue = values[rule.referralPath] ?? '';
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
  fields: Array<MappableField>,
  referralPaths: Set<string>
): void {
  const ownRuleByChildKey = new Map<string, FieldEnablingRule>();
  for (const condition of objectAttribute.enablingConditions) {
    const referralPath = resolveChildPath(pathPrefix, condition.referralPathFromRoot);
    ownRuleByChildKey.set(condition.targetPathFromRoot, { referralPath, values: condition.values, operator: condition.operator });
    referralPaths.add(referralPath);
  }

  for (const attribute of objectAttribute.attributes) {
    const childPath = resolveChildPath(pathPrefix, attribute.key);
    const ownRule = ownRuleByChildKey.get(attribute.key);
    const rules = ownRule ? [...inheritedRules, ownRule] : inheritedRules;

    if (attribute.type === 'object') {
      const childAncestors = pathPrefix === '' ? ancestorLabelKeys : [...ancestorLabelKeys, attribute.translationKey];
      walkItemAttributes(attribute, childPath, rules, childAncestors, fields, referralPaths);
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
 * until its condition is met and forbid a {{field}} expression on a field other fields depend on.
 */
function buildItemMappableFields(manifest: SouthConnectorManifest): Array<MappableField> {
  const fields: Array<MappableField> = [];
  const referralPaths = new Set<string>();
  walkItemAttributes(manifest.items.rootAttribute, '', [], [], fields, referralPaths);
  if (manifest.modes.history) {
    fields.push(...HISTORIAN_ITEM_FIELDS);
  }
  for (const field of fields) {
    field.isEnablingReferral = referralPaths.has(field.path);
  }
  return fields;
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
