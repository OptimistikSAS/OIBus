import { Component, inject, AfterViewInit, ChangeDetectionStrategy, ViewChild } from '@angular/core';
import { NgbActiveModal, NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
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
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { Observable, switchMap } from 'rxjs';
import { OIBusRecordListContent } from '../../../../../../backend/shared/model/engine.model';
import {
  ConfigurationWorkflowCommandDTO,
  ConfigurationWorkflowDTO,
  RECORD_FILTER_OPERATORS,
  RecordFilterCondition,
  RecordFilterOperator
} from '../../../../../../backend/shared/model/configuration-workflow.model';
import {
  SouthConnectorExploreEntry,
  SouthConnectorItemDTO,
  SouthConnectorManifest,
  SouthItemGroupCommandDTO,
  SouthItemGroupDTO,
  SQL_FAMILY_SOUTH_TYPES
} from '../../../../../../backend/shared/model/south-connector.model';
import { ScanModeDTO } from '../../../../../../backend/shared/model/scan-mode.model';
import { SouthSettings } from '../../../../../../backend/shared/model/south-settings.model';
import {
  OIBusAttribute,
  OIBusAttributeType,
  OIBusEnablingCondition,
  OIBusObjectAttribute
} from '../../../../../../backend/shared/model/form.model';
import { RESAMPLING } from '../../../../../../backend/shared/model/types';
import { ObservableState, SaveButtonComponent } from '../../../shared/save-button/save-button.component';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../../../shared/form/form-validation-directives';
import { UnsavedChangesConfirmationService } from '../../../shared/unsaved-changes-confirmation.service';
import { ModalService } from '../../../shared/modal.service';
import { EditSouthItemGroupModalComponent } from '../../south-items/edit-south-item-group-modal/edit-south-item-group-modal.component';
import { SouthExploreModalComponent } from '../../../shared/south-explore-modal/south-explore-modal.component';
import { ExploreTreeComponent } from '../../../shared/explore-tree/explore-tree.component';
import { SouthConnectorService } from '../../../services/south-connector.service';
import { extractErrorMessage } from '../../../shared/extract-error-message';
import { OibCodeBlockComponent } from '../../../shared/form/oib-code-block/oib-code-block.component';
import { TransformerTestResultComponent } from '../../../shared/transformer-test-result/transformer-test-result.component';

interface FieldMappingRow {
  key: string;
  value: string;
}

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
  /** Historian fields whose relevance depends on whether the item is (going to be) mapped into a group,
   *  mirroring the real item edit form's own group-dependent fields - `true` shows the field only when
   *  'groupId' is mapped to something, `false` only when it isn't. Not expressible as an enablingRule
   *  (those match against a known, finite set of values; "groupId is mapped to *something*" can't, since
   *  the set of valid group ids is dynamic). Unset for every field outside this historian group. */
  visibleWhenGrouped?: boolean;
}

/** Sentinel select-option value meaning "map this to a {{field}} expression instead of a fixed value". */
const VARIABLE_SENTINEL = '__variable__';

// The known ItemPointMetadataWrite columns a remoteFieldMapping can target directly - mirrors
// KNOWN_REMOTE_FIELDS in the backend's configuration-workflow-run.service.ts. Anything else is
// handled as a free-form "extra" row, going into remoteMetadataExtra.
const REMOTE_KNOWN_FIELDS: Array<MappableField> = [
  { path: 'description', translationKey: 'south.workflows.remote-known-fields.description', attributeType: 'string' },
  { path: 'unit', translationKey: 'south.workflows.remote-known-fields.unit', attributeType: 'string' },
  { path: 'minAcceptableValue', translationKey: 'south.workflows.remote-known-fields.min-acceptable-value', attributeType: 'number' },
  { path: 'maxAcceptableValue', translationKey: 'south.workflows.remote-known-fields.max-acceptable-value', attributeType: 'number' },
  { path: 'resolution', translationKey: 'south.workflows.remote-known-fields.resolution', attributeType: 'number' },
  {
    path: 'resamplingMethod',
    translationKey: 'south.workflows.remote-known-fields.resampling-method',
    attributeType: 'string-select',
    selectableValues: [...RESAMPLING]
  }
];

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
  changeDetection: ChangeDetectionStrategy.Eager,
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

  // The inline, read-only explore tree shown alongside the SQL query editor (SQLite only, for now -
  // see showSqlExploreTree) - undefined until that branch of the template actually renders it.
  @ViewChild(ExploreTreeComponent) private inlineExploreTree?: ExploreTreeComponent;

  mode: 'create' | 'edit' | 'copy' = 'create';
  state = new ObservableState();
  scanModes: Array<ScanModeDTO> = [];
  items: Array<SouthConnectorItemDTO> = [];
  groups: Array<SouthItemGroupDTO | SouthItemGroupCommandDTO> = [];
  workflow: ConfigurationWorkflowDTO | null = null;
  existingWorkflows: Array<ConfigurationWorkflowDTO> = [];
  private currentManifest!: SouthConnectorManifest;
  private southId!: string;
  private southSettings!: SouthSettings;

  /** Root node id currently picked via the explore-tree node picker (tree-based connectors only) -
   *  null means "browse from the data source's true root". */
  discoveryRootNodeId: string | null = null;
  /** The dedicated metadata query, as typed by the user (SQL-family connectors only). */
  discoveryQuery = '';

  /** "Test query" state - runs discoveryQuery as currently typed, independent of Save. */
  queryTestRunning = false;
  queryTestError: string | null = null;
  queryTestResult: OIBusRecordListContent | null = null;

  // Saves directly against the live south connector, exactly like EditSouthItemModalComponent's own
  // group dropdown - bound from south-detail.component.ts and passed down through prepare().
  private addOrEditGroup!: (command: {
    mode: 'create' | 'edit';
    group: SouthItemGroupCommandDTO;
  }) => Observable<SouthItemGroupDTO | SouthItemGroupCommandDTO>;
  private deleteGroup!: (group: SouthItemGroupDTO | SouthItemGroupCommandDTO) => Observable<void>;

  readonly operators: ReadonlyArray<RecordFilterOperator> = RECORD_FILTER_OPERATORS;
  readonly remoteKnownFields = REMOTE_KNOWN_FIELDS;
  readonly variableSentinel = VARIABLE_SENTINEL;

  /** Every field the connector's manifest (+ the historian fields it adds outside the manifest, when supported) exposes on an item. */
  itemMappableFields: Array<MappableField> = [];
  /** One expression string per itemMappableFields entry, keyed by its path - blank means "not mapped". */
  itemFieldMappingValues: Record<string, string> = {};
  /** One expression string per REMOTE_KNOWN_FIELDS entry, keyed by its path. */
  remoteFieldMappingValues: Record<string, string> = {};
  /** Anything in remoteFieldMapping beyond the known fields - the remoteMetadataExtra escape hatch. */
  remoteFieldMappingExtraRows: Array<FieldMappingRow> = [];

  identityKeyFields: Array<string> = [];
  eligibilityFilter: Array<RecordFilterCondition> = [];

  formError: string | null = null;

  newIdentityKeyField = '';
  newEligibilityField = '';
  newEligibilityOperator: RecordFilterOperator = 'equals';
  newEligibilityValue = '';
  newRemoteExtraKey = '';
  newRemoteExtraValue = '';

  form: FormGroup<{
    name: FormControl<string>;
    scanModeId: FormControl<string | null>;
    targetItemId: FormControl<string | null>;
    itemFieldMappingEnabled: FormControl<boolean>;
    remoteFieldMappingEnabled: FormControl<boolean>;
    enabled: FormControl<boolean>;
  }> | null = null;

  prepareForCreation(
    scanModes: Array<ScanModeDTO>,
    items: Array<SouthConnectorItemDTO>,
    existingWorkflows: Array<ConfigurationWorkflowDTO>,
    manifest: SouthConnectorManifest,
    southId: string,
    southSettings: SouthSettings,
    groups: Array<SouthItemGroupDTO | SouthItemGroupCommandDTO> = [],
    addOrEditGroup?: (command: {
      mode: 'create' | 'edit';
      group: SouthItemGroupCommandDTO;
    }) => Observable<SouthItemGroupDTO | SouthItemGroupCommandDTO>,
    deleteGroup?: (group: SouthItemGroupDTO | SouthItemGroupCommandDTO) => Observable<void>
  ) {
    this.mode = 'create';
    this.scanModes = scanModes;
    this.items = items;
    this.groups = groups;
    this.addOrEditGroup = addOrEditGroup!;
    this.deleteGroup = deleteGroup!;
    this.existingWorkflows = existingWorkflows;
    this.workflow = null;
    this.currentManifest = manifest;
    this.southId = southId;
    this.southSettings = southSettings;
    this.discoveryRootNodeId = null;
    this.discoveryQuery = '';
    this.itemMappableFields = buildItemMappableFields(manifest);
    this.itemFieldMappingValues = {};
    this.remoteFieldMappingValues = {};
    this.remoteFieldMappingExtraRows = [];
    this.identityKeyFields = [];
    this.eligibilityFilter = [];
    this.buildForm();
  }

  prepareForEdition(
    scanModes: Array<ScanModeDTO>,
    items: Array<SouthConnectorItemDTO>,
    existingWorkflows: Array<ConfigurationWorkflowDTO>,
    manifest: SouthConnectorManifest,
    workflow: ConfigurationWorkflowDTO,
    southId: string,
    southSettings: SouthSettings,
    groups: Array<SouthItemGroupDTO | SouthItemGroupCommandDTO> = [],
    addOrEditGroup?: (command: {
      mode: 'create' | 'edit';
      group: SouthItemGroupCommandDTO;
    }) => Observable<SouthItemGroupDTO | SouthItemGroupCommandDTO>,
    deleteGroup?: (group: SouthItemGroupDTO | SouthItemGroupCommandDTO) => Observable<void>
  ) {
    this.mode = 'edit';
    this.scanModes = scanModes;
    this.items = items;
    this.groups = groups;
    this.addOrEditGroup = addOrEditGroup!;
    this.deleteGroup = deleteGroup!;
    this.existingWorkflows = existingWorkflows;
    this.workflow = workflow;
    this.currentManifest = manifest;
    this.southId = southId;
    this.southSettings = southSettings;
    this.itemMappableFields = buildItemMappableFields(manifest);

    const scope = (workflow.discoveryScope ?? {}) as Record<string, unknown>;
    this.discoveryRootNodeId = typeof scope['rootNodeId'] === 'string' ? scope['rootNodeId'] : null;
    this.discoveryQuery = typeof scope['query'] === 'string' ? scope['query'] : '';

    this.itemFieldMappingValues = {};
    for (const [key, value] of Object.entries(workflow.itemFieldMapping ?? {})) {
      this.itemFieldMappingValues[key] = value;
    }

    this.remoteFieldMappingValues = {};
    this.remoteFieldMappingExtraRows = [];
    for (const [key, value] of Object.entries(workflow.remoteFieldMapping ?? {})) {
      if (REMOTE_KNOWN_FIELDS.some(field => field.path === key)) {
        this.remoteFieldMappingValues[key] = value;
      } else {
        this.remoteFieldMappingExtraRows.push({ key, value });
      }
    }

    this.identityKeyFields = [...workflow.identityKeyFields];
    this.eligibilityFilter = workflow.eligibilityFilter.map(condition => ({ ...condition }));
    this.buildForm();
  }

  /**
   * Duplicate an existing workflow: opens the same populated form as edition, but targeting a brand
   * new workflow (create semantics on save, per ManageWorkflowsModalComponent.onDuplicate) - mirrors
   * EditSouthItemModalComponent's own prepareForCopy for items. The clone's id is blanked so
   * checkUniqueness() excludes nothing (the source workflow's own name stays taken, as it should).
   */
  prepareForCopy(
    scanModes: Array<ScanModeDTO>,
    items: Array<SouthConnectorItemDTO>,
    existingWorkflows: Array<ConfigurationWorkflowDTO>,
    manifest: SouthConnectorManifest,
    workflow: ConfigurationWorkflowDTO,
    southId: string,
    southSettings: SouthSettings,
    groups: Array<SouthItemGroupDTO | SouthItemGroupCommandDTO> = [],
    addOrEditGroup?: (command: {
      mode: 'create' | 'edit';
      group: SouthItemGroupCommandDTO;
    }) => Observable<SouthItemGroupDTO | SouthItemGroupCommandDTO>,
    deleteGroup?: (group: SouthItemGroupDTO | SouthItemGroupCommandDTO) => Observable<void>
  ) {
    const clone: ConfigurationWorkflowDTO = { ...JSON.parse(JSON.stringify(workflow)), id: '', name: `${workflow.name}-copy` };
    this.prepareForEdition(
      scanModes,
      items,
      existingWorkflows,
      manifest,
      clone,
      southId,
      southSettings,
      groups,
      addOrEditGroup,
      deleteGroup
    );
    this.mode = 'copy';
  }

  private checkUniqueness(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) {
        return null;
      }
      const isDuplicate = this.existingWorkflows.some(
        workflow => workflow.name.toLowerCase() === control.value.toLowerCase() && workflow.id !== this.workflow?.id
      );
      return isDuplicate ? { mustBeUnique: true } : null;
    };
  }

  private buildForm() {
    this.form = this.fb.group({
      name: [this.workflow?.name ?? '', [Validators.required, this.checkUniqueness()]],
      scanModeId: this.fb.control<string | null>(this.workflow?.scanMode?.id ?? null),
      targetItemId: this.fb.control<string | null>(this.workflow?.targetItemId ?? null),
      itemFieldMappingEnabled: this.fb.control<boolean>(this.workflow ? this.workflow.itemFieldMapping !== null : true),
      remoteFieldMappingEnabled: this.fb.control<boolean>(this.workflow ? this.workflow.remoteFieldMapping !== null : false),
      enabled: this.fb.control<boolean>(this.workflow?.enabled ?? true)
    });
  }

  addIdentityKeyField() {
    const field = this.newIdentityKeyField.trim();
    if (!field || this.identityKeyFields.includes(field)) {
      return;
    }
    this.identityKeyFields.push(field);
    this.newIdentityKeyField = '';
  }

  removeIdentityKeyField(field: string) {
    this.identityKeyFields = this.identityKeyFields.filter(existing => existing !== field);
  }

  addEligibilityCondition() {
    const field = this.newEligibilityField.trim();
    if (!field) {
      return;
    }
    const condition: RecordFilterCondition = { field, operator: this.newEligibilityOperator };
    if (this.newEligibilityOperator !== 'exists') {
      condition.value = this.newEligibilityValue;
    }
    this.eligibilityFilter.push(condition);
    this.newEligibilityField = '';
    this.newEligibilityOperator = 'equals';
    this.newEligibilityValue = '';
  }

  removeEligibilityCondition(index: number) {
    this.eligibilityFilter.splice(index, 1);
  }

  addRemoteExtraRow() {
    const key = this.newRemoteExtraKey.trim();
    if (!key) {
      return;
    }
    this.remoteFieldMappingExtraRows.push({ key, value: this.newRemoteExtraValue });
    this.newRemoteExtraKey = '';
    this.newRemoteExtraValue = '';
  }

  removeRemoteExtraRow(index: number) {
    this.remoteFieldMappingExtraRows.splice(index, 1);
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
  fieldConcreteValues(field: MappableField): Array<string> {
    switch (field.attributeType) {
      case 'boolean':
        return ['true', 'false'];
      case 'string-select':
        return field.selectableValues ?? [];
      case 'scan-mode':
        return this.scanModes.map(scanMode => scanMode.id);
      case 'group-select':
        return this.groups.map(group => group.id).filter((id): id is string => id != null);
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
  isVariableMode(values: Record<string, string>, field: MappableField): boolean {
    const value = values[field.path] ?? '';
    if (!value) {
      return false;
    }
    return !this.fieldConcreteValues(field).includes(value);
  }

  /** What the <select> itself should show: the sentinel option while in variable mode, the raw constant value otherwise. */
  selectDisplayValue(values: Record<string, string>, field: MappableField): string {
    return this.isVariableMode(values, field) ? VARIABLE_SENTINEL : (values[field.path] ?? '');
  }

  /** Handles a change on a select-type field's constant dropdown - switches into variable mode with a starter
   *  expression when the sentinel is chosen, otherwise stores the picked constant value directly. */
  onSelectChange(values: Record<string, string>, field: MappableField, newValue: string) {
    values[field.path] = newValue === VARIABLE_SENTINEL ? '{{}}' : newValue;
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

  /** Name of the group currently mapped as a constant for the 'groupId' field, or the "no group" label. */
  getSelectedGroupName(): string {
    const groupId = this.itemFieldMappingValues['groupId'];
    if (!groupId) {
      return '';
    }
    return this.groups.find(group => group.id === groupId)?.standardSettings.name ?? groupId;
  }

  onSelectGroup(groupId: string | null) {
    this.itemFieldMappingValues['groupId'] = groupId ?? '';
  }

  /** Mirrors EditSouthItemModalComponent's own onAddGroup - opens the same group modal, saves it directly
   *  against the live south connector via the callback threaded in from south-detail, then maps the newly
   *  created group as this field's constant. */
  onAddGroup() {
    const modalRef = this.modalService.open(EditSouthItemGroupModalComponent, { backdrop: 'static' });
    const component: EditSouthItemGroupModalComponent = modalRef.componentInstance;
    component.prepareForCreation(this.scanModes, this.groups, this.currentManifest);
    modalRef.result.pipe(switchMap(result => this.addOrEditGroup(result))).subscribe(groupResult => {
      this.groups.push(groupResult);
      this.onSelectGroup(groupResult.id!);
    });
  }

  onEditGroup(group: SouthItemGroupDTO | SouthItemGroupCommandDTO, event: Event) {
    event.stopPropagation();
    const modalRef = this.modalService.open(EditSouthItemGroupModalComponent, { backdrop: 'static' });
    const component: EditSouthItemGroupModalComponent = modalRef.componentInstance;
    component.prepareForEdition(this.scanModes, this.groups, this.currentManifest, group);
    modalRef.result.pipe(switchMap(result => this.addOrEditGroup(result))).subscribe(groupResult => {
      const index = this.groups.findIndex(existing => existing.id === groupResult.id);
      if (index >= 0) {
        this.groups[index] = groupResult;
      } else {
        this.groups.push(groupResult);
      }
    });
  }

  onDeleteGroup(group: SouthItemGroupDTO | SouthItemGroupCommandDTO, event: Event) {
    event.stopPropagation();
    this.deleteGroup(group).subscribe(() => {
      this.groups = this.groups.filter(existing => existing.id !== group.id);
      if (this.itemFieldMappingValues['groupId'] === group.id) {
        this.onSelectGroup(null);
      }
    });
  }

  /** Whether an item field should be shown at all - every enabling rule covering it (its own, plus any
   *  inherited from an enclosing settings object) must currently pass against itemFieldMappingValues,
   *  and a group-dependent historian field must agree with whether 'groupId' is currently mapped. */
  isItemFieldVisible(field: MappableField): boolean {
    if (field.visibleWhenGrouped !== undefined) {
      const isGrouped = !!this.itemFieldMappingValues['groupId'];
      if (field.visibleWhenGrouped !== isGrouped) {
        return false;
      }
    }
    return (field.enablingRules ?? []).every(rule => this.evaluatesTrue(rule));
  }

  private evaluatesTrue(rule: FieldEnablingRule): boolean {
    const referralValue = this.itemFieldMappingValues[rule.referralPath] ?? '';
    const matchesAnyValue = rule.values.some(value => String(value) === referralValue);
    if (rule.operator === 'CONTAINS') {
      return rule.values.some(value => referralValue.includes(String(value)));
    }
    if (rule.operator === 'NOT_EQUAL') {
      return !matchesAnyValue;
    }
    return matchesAnyValue;
  }

  /** Tree-shaped discovery scope (a root node to browse) - OPC-UA, Folder Scanner. Checked before
   *  isSqlFamily since a manifest could in principle declare both (none do today). */
  get isTreeBased(): boolean {
    return this.currentManifest.explore === true && !this.isSqlFamily;
  }

  /** Query-shaped discovery scope (a dedicated metadata query) - the SQL-family connectors that have
   *  a `discover()` implementation today (see SQL_FAMILY_SOUTH_TYPES's own doc comment for why ODBC/
   *  OLEDB aren't included). */
  get isSqlFamily(): boolean {
    return SQL_FAMILY_SOUTH_TYPES.includes(this.currentManifest.id);
  }

  /** Whether to show the read-only explore tree above the SQL query editor, for reference while
   *  writing the query - only SQLite has an `explore()` implementation among the SQL-family connectors
   *  today, so this is the same condition as isSqlFamily for now, but stated independently since it's
   *  conceptually a separate capability (a future SQL connector could get discover() without explore(),
   *  or vice versa). */
  get showSqlExploreTree(): boolean {
    return this.isSqlFamily && this.currentManifest.explore === true;
  }

  ngAfterViewInit() {
    if (this.showSqlExploreTree) {
      this.inlineExploreTree?.prepare(this.southId, this.southSettings, this.currentManifest.id);
    }
  }

  /** Opens the explore tree in picker mode - selecting a node sets it as the discovery root. */
  openNodePicker() {
    const modalRef = this.modalService.open(SouthExploreModalComponent, { size: 'lg' });
    const component: SouthExploreModalComponent = modalRef.componentInstance;
    component.prepare(this.southId, this.southSettings, this.currentManifest.id, undefined, true);
    modalRef.result.subscribe((entry: SouthConnectorExploreEntry) => {
      this.discoveryRootNodeId = entry.id;
    });
  }

  /** Resets the discovery root back to "browse from the data source's true root". */
  clearRootNodeId() {
    this.discoveryRootNodeId = null;
  }

  /**
   * Run the discovery query exactly as currently typed (independent of Save, like EditSouthItemModal's
   * own "test item") and show its raw rows - lets the user check it works before saving the workflow.
   */
  testDiscoveryQuery() {
    const query = this.discoveryQuery.trim();
    if (!query) {
      return;
    }
    this.queryTestRunning = true;
    this.queryTestError = null;
    this.queryTestResult = null;
    this.southConnectorService.testDiscoveryQuery(this.southId, this.currentManifest.id, this.southSettings, query).subscribe({
      next: rows => {
        this.queryTestRunning = false;
        this.queryTestResult = { type: 'record-list', content: rows };
      },
      error: error => {
        this.queryTestRunning = false;
        this.queryTestError = extractErrorMessage(error);
      }
    });
  }

  canDismiss(): Observable<boolean> | boolean {
    if (this.form?.dirty) {
      return this.unsavedChangesConfirmation.confirmUnsavedChanges();
    }
    return true;
  }

  cancel() {
    this.modal.dismiss();
  }

  save() {
    this.formError = null;
    if (!this.form || !this.form.valid) {
      return;
    }
    const formValue = this.form.getRawValue();

    let discoveryScope: Record<string, unknown>;
    if (this.isSqlFamily) {
      if (!this.discoveryQuery.trim()) {
        this.formError = 'south.workflows.discovery-scope-query-required';
        return;
      }
      discoveryScope = { query: this.discoveryQuery.trim() };
    } else if (this.isTreeBased) {
      // No rootNodeId at all means "browse from the data source's true root" - a deliberate, valid choice.
      discoveryScope = this.discoveryRootNodeId ? { rootNodeId: this.discoveryRootNodeId } : {};
    } else {
      discoveryScope = {};
    }

    if (this.identityKeyFields.length === 0) {
      this.formError = 'south.workflows.identity-key-fields-none';
      return;
    }
    if (!formValue.itemFieldMappingEnabled && !formValue.remoteFieldMappingEnabled) {
      this.formError = 'south.workflows.mapping-required';
      return;
    }
    if (!formValue.itemFieldMappingEnabled && !formValue.targetItemId) {
      this.formError = 'south.workflows.target-item-required';
      return;
    }
    // A field other fields depend on for their own visibility, plus the schedule/group fields, must be
    // knowable while editing (or reference something real) rather than resolved per-record at run time -
    // a select-type one of these can't even reach this state through the UI (its {{ }} option is
    // omitted), but a free-text one still could.
    const hasConstantOnlyViolation = this.itemMappableFields.some(
      field => !this.allowsVariable(field) && (this.itemFieldMappingValues[field.path] ?? '').includes('{{')
    );
    if (formValue.itemFieldMappingEnabled && hasConstantOnlyViolation) {
      this.formError = 'south.workflows.mapping-constant-only';
      return;
    }

    // A field hidden by an unmet enabling condition keeps whatever value it had while editing (so
    // toggling the referral back and forth doesn't lose data), but is stripped here at save time - it
    // isn't actually part of the item this mapping would produce.
    const visibleItemPaths = new Set(this.itemMappableFields.filter(field => this.isItemFieldVisible(field)).map(field => field.path));
    const itemFieldMappingValuesToSave: Record<string, string> = {};
    for (const [path, value] of Object.entries(this.itemFieldMappingValues)) {
      if (visibleItemPaths.has(path)) {
        itemFieldMappingValuesToSave[path] = value;
      }
    }
    const itemFieldMapping = formValue.itemFieldMappingEnabled ? nonEmptyEntries(itemFieldMappingValuesToSave) : null;

    let remoteFieldMapping: Record<string, string> | null = null;
    if (formValue.remoteFieldMappingEnabled) {
      remoteFieldMapping = nonEmptyEntries(this.remoteFieldMappingValues);
      for (const row of this.remoteFieldMappingExtraRows) {
        const key = row.key.trim();
        if (key) {
          remoteFieldMapping[key] = row.value;
        }
      }
    }

    const command: ConfigurationWorkflowCommandDTO = {
      name: formValue.name,
      targetItemId: formValue.targetItemId || null,
      discoveryScope,
      identityKeyFields: this.identityKeyFields,
      eligibilityFilter: this.eligibilityFilter,
      itemFieldMapping,
      remoteFieldMapping,
      scanModeId: formValue.scanModeId || null,
      enabled: formValue.enabled
    };
    this.modal.close(command);
  }
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
    ancestorLabelKeys
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
