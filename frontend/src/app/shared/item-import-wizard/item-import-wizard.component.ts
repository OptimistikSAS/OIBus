import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective } from '@ngx-translate/core';
import { FormGroup, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { SouthConnectorExploreEntry, SouthConnectorManifest } from '../../../../../backend/shared/model/south-connector.model';
import { OIBusAttribute, OIBusControlAttribute, OIBusObjectAttribute } from '../../../../../backend/shared/model/form.model';
import { createPageFromArray, Page } from '../../../../../backend/shared/model/types';
import { deriveItemImportFields } from '../form/item-import-fields.util';
import { createControl } from '../form/dynamic-form.builder';
import { emptyPage } from '../test-utils';
import { PaginationComponent } from '../pagination/pagination.component';
import { OIBusBooleanFormControlComponent } from '../form/oibus-boolean-form-control/oibus-boolean-form-control.component';
import { OIBusStringFormControlComponent } from '../form/oibus-string-form-control/oibus-string-form-control.component';
import { OIBusStringSelectFormControlComponent } from '../form/oibus-string-select-form-control/oibus-string-select-form-control.component';
import { OIBusNumberFormControlComponent } from '../form/oibus-number-form-control/oibus-number-form-control.component';
import { OIBusSecretFormControlComponent } from '../form/oibus-secret-form-control/oibus-secret-form-control.component';
import { OIBusInstantFormControlComponent } from '../form/oibus-instant-form-control/oibus-instant-form-control.component';
import { OIBusTimezoneFormControlComponent } from '../form/oibus-timezone-form-control/oibus-timezone-form-control.component';
import { OIBusCodeFormControlComponent } from '../form/oibus-code-form-control/oibus-code-form-control.component';

const PAGE_SIZE = 20;

/** An item as returned by the check call: shaped like the target item-command DTO, with `id` populated when a match was found. */
export interface WizardCheckedItem {
  id: string;
  name: string;
  [key: string]: unknown;
}

export interface WizardCheckResult {
  items: Array<WizardCheckedItem>;
  errors: Array<{ item: Record<string, string>; error: string }>;
}

/**
 * Backend call used to validate the current rows, kept as a plain port so the wizard isn't tied to
 * either `SouthConnectorService` or `HistoryQueryService` — each caller adapts its own check endpoint
 * (and, for South, maps the response's `scanMode`/`group` objects onto `scanModeId`/`groupId` etc.)
 * into this common shape.
 */
export type WizardCheckFn = (rows: Array<Record<string, string>>, matchKey: string | null) => Observable<WizardCheckResult>;

type RowResolution = 'update' | 'skip';

export type ItemImportFieldSource = 'metadata' | 'constant';

/**
 * One row of the field-mapping step: how a single item field (`name`, `enabled`, `scanMode`, or a
 * `settings_<key>` field) is populated for every selected explore-tree node — either read from the
 * node's own `metadata` bag (or its `name`/`id`), or given a single constant value applied to every row.
 */
export interface FieldMapping {
  field: string;
  required: boolean;
  source: ItemImportFieldSource;
  /** The metadata key (or synthetic 'name'/'id') to read from, when `source === 'metadata'`. */
  metadataKey: string | null;
  /** The constant value applied to every row, when `source === 'constant'`. */
  constantValue: unknown;
  /**
   * The manifest attribute this field corresponds to (for `settings_<key>` fields, used to render a
   * typed constant-value control). `null` for `name`/`enabled`/`scanMode`, which aren't settings attributes.
   */
  attribute: OIBusAttribute | null;
}

/**
 * Existing items the caller already has, made available so the match-key step can be aware that a
 * matching step will happen server-side (Phase 4). Not used for any matching logic in this phase.
 */
export interface ExistingItemForMatch {
  id: string;
  name: string;
  settings?: object;
}

/**
 * Attribute types the wizard can render a typed constant-value control for, by reusing the standard
 * `oibus-*-form-control` components. `scan-mode`/`certificate` are excluded because those controls
 * require an externally-loaded list (scan modes / certificates) that this standalone wizard does not
 * have wired up; `object`/`array` are excluded as they aren't flat, single-value settings. Those cases
 * fall back to a plain text input — full validation happens server-side in Phase 4 regardless.
 */
const RENDERABLE_CONSTANT_TYPES = new Set(['string', 'code', 'string-select', 'secret', 'number', 'boolean', 'instant', 'timezone']);

/**
 * Field-mapping + match-key wizard, shown after selecting nodes in the Explore modal. Turns the
 * selection into CSV-import-shaped rows (`Record<string, string>`), reusing the same expected/optional
 * header derivation and per-type settings controls as the manual CSV importer.
 *
 * This phase only builds steps 1 (field mapping) and 2 (match key) plus the row-building logic; the
 * preview/edit table (step 3) and the actual check/import wiring are added in a later phase.
 */
@Component({
  selector: 'oib-item-import-wizard',
  templateUrl: './item-import-wizard.component.html',
  styleUrl: './item-import-wizard.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    TranslateDirective,
    ReactiveFormsModule,
    PaginationComponent,
    OIBusBooleanFormControlComponent,
    OIBusStringFormControlComponent,
    OIBusStringSelectFormControlComponent,
    OIBusNumberFormControlComponent,
    OIBusSecretFormControlComponent,
    OIBusInstantFormControlComponent,
    OIBusTimezoneFormControlComponent,
    OIBusCodeFormControlComponent
  ]
})
export class ItemImportWizardComponent {
  private modal = inject(NgbActiveModal);
  private fb = inject(NonNullableFormBuilder);

  manifest!: SouthConnectorManifest;
  selectedNodes: Array<SouthConnectorExploreEntry> = [];
  existingItems: Array<ExistingItemForMatch> = [];

  mappings: Array<FieldMapping> = [];
  /**
   * One nested FormGroup per settings-based field (keyed by field name), each holding a single
   * control keyed by the attribute's own key — mirrors the shape the standard `oibus-*-form-control`
   * components expect (a `formGroupName` matching the attribute key).
   */
  constantsForm: FormGroup = this.fb.group({});
  matchKey: string | null = null;

  currentStep: 1 | 2 | 3 = 1;

  /** Editable preview rows for step 3 — a mutable copy of `buildRows()`'s output, seeded on entering the step. */
  rows: Array<Record<string, string>> = [];
  checking = false;
  checkError: string | null = null;
  checkResult: WizardCheckResult | null = null;
  /** Per-row-index resolution, only meaningful for rows that the last check matched onto an existing item. */
  rowResolutions: Record<number, RowResolution> = {};
  globalMatchResolution: RowResolution = 'update';
  displayedRows: Page<Record<string, string>> = emptyPage();

  private checkFn: WizardCheckFn | null = null;

  prepare(
    manifest: SouthConnectorManifest,
    selectedNodes: Array<SouthConnectorExploreEntry>,
    existingItems: Array<ExistingItemForMatch>,
    checkFn: WizardCheckFn
  ) {
    this.manifest = manifest;
    this.selectedNodes = selectedNodes;
    this.existingItems = existingItems;
    this.checkFn = checkFn;
    this.currentStep = 1;
    this.matchKey = null;
    this.constantsForm = this.fb.group({});
    this.rows = [];
    this.checkResult = null;
    this.rowResolutions = {};
    this.globalMatchResolution = 'update';
    this.displayedRows = emptyPage();

    const { expectedHeaders, optionalHeaders } = deriveItemImportFields(manifest);
    const settingsAttribute = manifest.items.rootAttribute.attributes.find(attribute => attribute.key === 'settings') as
      OIBusObjectAttribute | undefined;

    this.mappings = [
      ...expectedHeaders.map(field => this.buildMapping(field, true, settingsAttribute)),
      ...optionalHeaders.map(field => this.buildMapping(field, false, settingsAttribute))
    ];
  }

  private buildMapping(field: string, required: boolean, settingsAttribute: OIBusObjectAttribute | undefined): FieldMapping {
    if (field === 'name') {
      // The item name defaults to the explore-tree entry's own name — the common case by far.
      return { field, required, source: 'metadata', metadataKey: 'name', constantValue: '', attribute: null };
    }
    if (field === 'enabled') {
      return { field, required, source: 'constant', metadataKey: null, constantValue: true, attribute: null };
    }
    if (field === 'scanMode') {
      return { field, required, source: 'constant', metadataKey: null, constantValue: '', attribute: null };
    }

    const settingsKey = field.replace('settings_', '');
    const attribute = settingsAttribute?.attributes.find(candidate => candidate.key === settingsKey) ?? null;
    const mapping: FieldMapping = {
      field,
      required,
      source: 'constant',
      metadataKey: null,
      constantValue: this.defaultConstantValue(attribute),
      attribute
    };

    if (attribute && RENDERABLE_CONSTANT_TYPES.has(attribute.type)) {
      this.addConstantControl(mapping, attribute);
    }

    return mapping;
  }

  private defaultConstantValue(attribute: OIBusAttribute | null): unknown {
    if (!attribute) {
      return '';
    }
    switch (attribute.type) {
      case 'boolean':
      case 'number':
      case 'string':
      case 'code':
      case 'string-select':
      case 'timezone':
        return attribute.defaultValue;
      default:
        return null;
    }
  }

  private addConstantControl(mapping: FieldMapping, attribute: OIBusAttribute) {
    const control = createControl(this.fb, attribute as OIBusControlAttribute);
    this.constantsForm.addControl(mapping.field, this.fb.group({ [attribute.key]: control }));
    control.valueChanges.subscribe(value => {
      mapping.constantValue = value;
    });
  }

  /** Union of metadata keys across all selected nodes, plus the synthetic `name`/`id` fields of the entry itself. */
  get metadataKeyOptions(): Array<string> {
    const keys = new Set<string>(['name', 'id']);
    this.selectedNodes.forEach(node => Object.keys(node.metadata).forEach(key => keys.add(key)));
    return Array.from(keys);
  }

  /** `settings_<key>` fields that currently have a usable, known-per-row value (mapped from metadata with a chosen key, or a constant). */
  get mappedSettingsFields(): Array<string> {
    return this.mappings
      .filter(mapping => mapping.field.startsWith('settings_'))
      .filter(mapping => (mapping.source === 'metadata' ? !!mapping.metadataKey : true))
      .map(mapping => mapping.field);
  }

  get matchKeyOptions(): Array<string> {
    return ['name', ...this.mappedSettingsFields];
  }

  setSource(mapping: FieldMapping, source: ItemImportFieldSource) {
    mapping.source = source;
    if (source === 'metadata' && !mapping.metadataKey) {
      mapping.metadataKey = this.metadataKeyOptions[0] ?? null;
    }
  }

  onMetadataKeyChange(mapping: FieldMapping, event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    mapping.metadataKey = value || null;
  }

  onEnabledConstantChange(mapping: FieldMapping, event: Event) {
    mapping.constantValue = (event.target as HTMLInputElement).checked;
  }

  onTextConstantInput(mapping: FieldMapping, event: Event) {
    mapping.constantValue = (event.target as HTMLInputElement).value;
  }

  onMatchKeyChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    this.matchKey = value || null;
    if (this.currentStep === 3) {
      this.runCheck();
    }
  }

  goNext() {
    if (this.currentStep === 1) {
      this.currentStep = 2;
      return;
    }
    if (this.currentStep === 2) {
      this.currentStep = 3;
      this.rows = this.buildRows();
      this.runCheck();
    }
  }

  goBack() {
    if (this.currentStep > 1) {
      this.currentStep = ((this.currentStep as number) - 1) as 1 | 2 | 3;
    }
  }

  cancel() {
    this.modal.dismiss();
  }

  /**
   * Sends the current preview rows (and match key) to the caller's check port and refreshes the
   * per-row resolution defaults for any newly matched rows.
   */
  runCheck() {
    if (!this.checkFn) {
      return;
    }
    this.checking = true;
    this.checkError = null;
    this.checkFn(this.rows, this.matchKey).subscribe({
      next: result => {
        this.checkResult = result;
        this.checking = false;
        this.refreshRowResolutions();
        this.changePage(0);
      },
      error: httpError => {
        this.checkError = httpError.error?.message ?? httpError.message;
        this.checking = false;
      }
    });
  }

  /** Ensures every currently-matched row has a resolution, defaulting to the global toggle. */
  private refreshRowResolutions() {
    const resolved: Record<number, RowResolution> = {};
    this.rows.forEach((row, index) => {
      const matched = this.matchedItemForRow(row);
      if (matched) {
        resolved[index] = this.rowResolutions[index] ?? this.globalMatchResolution;
      }
    });
    this.rowResolutions = resolved;
  }

  /** Correlates a preview row back to the last check response by item/error name — the one field guaranteed present. */
  private matchedItemForRow(row: Record<string, string>): WizardCheckedItem | null {
    if (!this.checkResult) {
      return null;
    }
    return this.checkResult.items.find(item => item.name === row['name'] && item.id) ?? null;
  }

  errorForRow(row: Record<string, string>): string | null {
    if (!this.checkResult) {
      return null;
    }
    return this.checkResult.errors.find(error => error.item['name'] === row['name'])?.error ?? null;
  }

  isMatchedRow(row: Record<string, string>): boolean {
    return this.matchedItemForRow(row) !== null;
  }

  resolutionForRow(rowIndex: number): RowResolution {
    return this.rowResolutions[rowIndex] ?? this.globalMatchResolution;
  }

  setRowResolution(rowIndex: number, resolution: RowResolution) {
    this.rowResolutions[rowIndex] = resolution;
  }

  /** Sets the default applied to every currently-matched row; individual rows can still be overridden afterward. */
  setGlobalResolution(resolution: RowResolution) {
    this.globalMatchResolution = resolution;
    this.rows.forEach((row, index) => {
      if (this.matchedItemForRow(row)) {
        this.rowResolutions[index] = resolution;
      }
    });
  }

  onCellInput(rowIndex: number, field: string, event: Event) {
    this.rows[rowIndex] = { ...this.rows[rowIndex], [field]: (event.target as HTMLInputElement).value };
    this.runCheck();
  }

  addRow() {
    const blankRow: Record<string, string> = {};
    for (const mapping of this.mappings) {
      blankRow[mapping.field] = '';
    }
    this.rows = [...this.rows, blankRow];
    this.runCheck();
  }

  removeRow(rowIndex: number) {
    this.rows = this.rows.filter((_, index) => index !== rowIndex);
    this.runCheck();
  }

  changePage(pageNumber: number) {
    this.displayedRows = createPageFromArray(this.rows, PAGE_SIZE, pageNumber);
  }

  /**
   * Builds the final list of items to import — matched rows resolved to 'skip' are dropped, matched
   * rows resolved to 'update' keep the `id` returned by the last check, and unmatched rows are
   * submitted as fresh creates — then closes the modal for the caller to perform the actual import.
   */
  submit() {
    if (!this.checkResult) {
      return;
    }
    const items: Array<WizardCheckedItem> = [];
    this.rows.forEach((row, index) => {
      const matched = this.matchedItemForRow(row);
      if (matched) {
        if (this.resolutionForRow(index) !== 'skip') {
          items.push(matched);
        }
        return;
      }
      const unmatched = this.checkResult!.items.find(item => item.name === row['name'] && !item.id);
      if (unmatched) {
        items.push(unmatched);
      }
    });

    this.modal.close({ items, matchKey: this.matchKey });
  }

  /**
   * Resolves every selected node against every field mapping into a flat row, shaped exactly like the
   * CSV importer's row objects (`{ name, enabled, scanMode, settings_<key>, ... }`, all string values).
   */
  buildRows(): Array<Record<string, string>> {
    return this.selectedNodes.map(node => {
      const row: Record<string, string> = {};
      for (const mapping of this.mappings) {
        row[mapping.field] = this.resolveFieldValue(mapping, node);
      }
      return row;
    });
  }

  private resolveFieldValue(mapping: FieldMapping, node: SouthConnectorExploreEntry): string {
    if (mapping.source === 'metadata') {
      if (!mapping.metadataKey) {
        return '';
      }
      if (mapping.metadataKey === 'name') {
        return node.name;
      }
      if (mapping.metadataKey === 'id') {
        return node.id;
      }
      return String(node.metadata[mapping.metadataKey] ?? '');
    }

    const value = mapping.constantValue;
    if (mapping.attribute && (mapping.attribute.type === 'object' || mapping.attribute.type === 'array') && value != null) {
      return JSON.stringify(value);
    }
    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }
    return value === null || value === undefined ? '' : String(value);
  }

  /** Consumed by a later phase to submit the check/import request. */
  getWizardResult(): { mappings: Array<FieldMapping>; matchKey: string | null; rows: Array<Record<string, string>> } {
    return {
      mappings: this.mappings,
      matchKey: this.matchKey,
      rows: this.buildRows()
    };
  }
}
