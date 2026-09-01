import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
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
import { Observable } from 'rxjs';
import {
  ConfigurationWorkflowCommandDTO,
  ConfigurationWorkflowDTO,
  RECORD_FILTER_OPERATORS,
  RecordFilterCondition,
  RecordFilterOperator
} from '../../../../../../backend/shared/model/configuration-workflow.model';
import {
  SouthConnectorItemDTO,
  SouthConnectorManifest,
  SouthItemGroupDTO
} from '../../../../../../backend/shared/model/south-connector.model';
import { ScanModeDTO } from '../../../../../../backend/shared/model/scan-mode.model';
import { OIBusAttribute, OIBusAttributeType } from '../../../../../../backend/shared/model/form.model';
import { RESAMPLING } from '../../../../../../backend/shared/model/types';
import { ObservableState, SaveButtonComponent } from '../../../shared/save-button/save-button.component';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../../../shared/form/form-validation-directives';
import { UnsavedChangesConfirmationService } from '../../../shared/unsaved-changes-confirmation.service';

interface FieldMappingRow {
  key: string;
  value: string;
}

// 'group-select' is not part of the manifest's own attribute-type vocabulary - it tags the
// historian groupId field, whose options come from this south connector's item groups rather
// than a static list.
type MappableFieldType = OIBusAttributeType | 'group-select';

/** One field a mapping can target - a path into the item command shape, its translated label, and enough type
 *  information to render a type-appropriate constant input (checkbox, select, ...) instead of a bare text box. */
interface MappableField {
  path: string;
  translationKey: string;
  attributeType: MappableFieldType;
  /** Only for 'string-select' - the manifest's own selectableValues. */
  selectableValues?: Array<string>;
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

// Item fields that exist on every south item but aren't part of the manifest's item attribute tree
// (the real item edit form adds them by hand too, gated on the same manifest.modes.history flag).
const HISTORIAN_ITEM_FIELDS: Array<MappableField> = [
  { path: 'groupId', translationKey: 'south.items.group', attributeType: 'group-select' },
  { path: 'syncWithGroup', translationKey: 'south.items.sync-with-group', attributeType: 'boolean' },
  { path: 'maxReadInterval', translationKey: 'south.items.max-read-interval', attributeType: 'number' },
  { path: 'readDelay', translationKey: 'south.items.read-delay', attributeType: 'number' },
  { path: 'startTimeOffset', translationKey: 'south.items.start-time-offset', attributeType: 'number' },
  { path: 'endTimeOffset', translationKey: 'south.items.end-time-offset', attributeType: 'number' },
  {
    path: 'recoveryStrategy',
    translationKey: 'south.items.recovery-strategy',
    attributeType: 'string-select',
    selectableValues: ['oldest', 'newest']
  }
];

@Component({
  selector: 'oib-edit-workflow-modal',
  templateUrl: './edit-workflow-modal.component.html',
  styleUrl: './edit-workflow-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [ReactiveFormsModule, FormsModule, TranslateDirective, TranslatePipe, OI_FORM_VALIDATION_DIRECTIVES, SaveButtonComponent]
})
export default class EditWorkflowModalComponent {
  private modal = inject(NgbActiveModal);
  private fb = inject(NonNullableFormBuilder);
  private unsavedChangesConfirmation = inject(UnsavedChangesConfirmationService);

  mode: 'create' | 'edit' = 'create';
  state = new ObservableState();
  scanModes: Array<ScanModeDTO> = [];
  items: Array<SouthConnectorItemDTO> = [];
  groups: Array<SouthItemGroupDTO> = [];
  workflow: ConfigurationWorkflowDTO | null = null;
  existingWorkflows: Array<ConfigurationWorkflowDTO> = [];

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
  discoveryScopeError = false;

  newIdentityKeyField = '';
  newEligibilityField = '';
  newEligibilityOperator: RecordFilterOperator = 'equals';
  newEligibilityValue = '';
  newRemoteExtraKey = '';
  newRemoteExtraValue = '';

  form: FormGroup<{
    name: FormControl<string>;
    discoveryScope: FormControl<string>;
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
    groups: Array<SouthItemGroupDTO> = []
  ) {
    this.mode = 'create';
    this.scanModes = scanModes;
    this.items = items;
    this.groups = groups;
    this.existingWorkflows = existingWorkflows;
    this.workflow = null;
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
    groups: Array<SouthItemGroupDTO> = []
  ) {
    this.mode = 'edit';
    this.scanModes = scanModes;
    this.items = items;
    this.groups = groups;
    this.existingWorkflows = existingWorkflows;
    this.workflow = workflow;
    this.itemMappableFields = buildItemMappableFields(manifest);

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
      discoveryScope: [this.workflow ? JSON.stringify(this.workflow.discoveryScope, null, 2) : '{}', [Validators.required]],
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
        return this.groups.map(group => group.id);
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
    this.discoveryScopeError = false;
    if (!this.form || !this.form.valid) {
      return;
    }
    const formValue = this.form.getRawValue();

    let discoveryScope: Record<string, unknown>;
    try {
      const parsed = JSON.parse(formValue.discoveryScope);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('not an object');
      }
      discoveryScope = parsed as Record<string, unknown>;
    } catch {
      this.discoveryScopeError = true;
      return;
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

    const itemFieldMapping = formValue.itemFieldMappingEnabled ? nonEmptyEntries(this.itemFieldMappingValues) : null;

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
function toMappableField(attribute: OIBusAttribute, path: string = attribute.key): MappableField {
  const field: MappableField = { path, translationKey: attribute.translationKey, attributeType: attribute.type };
  if (attribute.type === 'string-select') {
    field.selectableValues = attribute.selectableValues;
  }
  return field;
}

/**
 * Flattens a south connector's item manifest into a mappable-field list: every top-level item
 * attribute (name, enabled, ...), the connector-specific settings.* fields nested one level under
 * the manifest's own `settings` object attribute, `scanMode` renamed to the `scanModeId` path the
 * workflow command actually uses, plus the historian fields the real item form adds by hand outside
 * the manifest tree (gated on the same `manifest.modes.history` flag it uses).
 */
function buildItemMappableFields(manifest: SouthConnectorManifest): Array<MappableField> {
  const fields: Array<MappableField> = [];
  for (const attribute of manifest.items.rootAttribute.attributes) {
    if (attribute.type === 'object' && attribute.key === 'settings') {
      for (const settingsAttribute of attribute.attributes) {
        fields.push(toMappableField(settingsAttribute, `settings.${settingsAttribute.key}`));
      }
    } else if (attribute.key === 'scanMode') {
      fields.push(toMappableField(attribute, 'scanModeId'));
    } else {
      fields.push(toMappableField(attribute));
    }
  }
  if (manifest.modes.history) {
    fields.push(...HISTORIAN_ITEM_FIELDS);
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
