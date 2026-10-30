import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormArray, FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { Observable } from 'rxjs';

import { FieldProcessTestResultDTO } from '@oibus/shared/api/configuration-workflow.model';
import { Timezone } from '@oibus/shared/common/types';
import {
  FIELD_DATETIME_TYPES,
  FIELD_NUMBER_OPERATORS,
  FIELD_OPERATION_TYPES,
  FieldDatetimeType,
  FieldNumberOperator,
  FieldOperation,
  FieldOperationType,
  RecordFieldValue
} from '@oibus/shared/domain/configuration-workflow.model';

import { ConfigurationWorkflowService } from '../../../services/configuration-workflow.service';
import { extractErrorMessage } from '../../../shared/extract-error-message';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../../../shared/form/form-validation-directives';
import { inMemoryTypeahead } from '../../../shared/form/typeahead';
import { OI_TYPEAHEAD_DIRECTIVES } from '../../../shared/form/typeahead-directives';

/**
 * The settings of an operation, whatever its type: only the ones of its type are enabled (see `OPERATION_SETTINGS`), so
 * only those are validated and sent.
 */
type OperationForm = FormGroup<{
  type: FormControl<FieldOperationType>;
  start: FormControl<number | null>;
  end: FormControl<number | null>;
  prefix: FormControl<string>;
  suffix: FormControl<string>;
  search: FormControl<string>;
  replacement: FormControl<string>;
  operator: FormControl<FieldNumberOperator>;
  operand: FormControl<number | null>;
  decimals: FormControl<number | null>;
  inputType: FormControl<FieldDatetimeType>;
  inputFormat: FormControl<string>;
  inputTimezone: FormControl<string>;
  inputLocale: FormControl<string>;
  outputType: FormControl<FieldDatetimeType>;
  outputFormat: FormControl<string>;
  outputTimezone: FormControl<string>;
  outputLocale: FormControl<string>;
  expression: FormControl<string>;
}>;

type OperationSetting = Exclude<keyof OperationForm['controls'], 'type'>;

const DATETIME_INPUT_STRING_SETTINGS: ReadonlyArray<OperationSetting> = ['inputFormat', 'inputTimezone', 'inputLocale'];
const DATETIME_OUTPUT_STRING_SETTINGS: ReadonlyArray<OperationSetting> = ['outputFormat', 'outputTimezone', 'outputLocale'];

/** The settings of each type of operation - a datetime one also has those of a string input or output, see `syncSettings` */
const OPERATION_SETTINGS: Record<FieldOperationType, ReadonlyArray<OperationSetting>> = {
  uppercase: [],
  lowercase: [],
  trim: [],
  substring: ['start', 'end'],
  'add-to-string': ['prefix', 'suffix'],
  replace: ['search', 'replacement'],
  'number-operation': ['operator', 'operand'],
  round: ['decimals'],
  datetime: ['inputType', 'outputType'],
  expression: ['expression']
};

/**
 * Sets up the operations a Configuration Workflow applies to a field of the discovered records, in order, and tests them on
 * the first values discovered for the field. Closes with the operations - none to stop processing the field.
 */
@Component({
  selector: 'oib-field-process-modal',
  templateUrl: './field-process-modal.component.html',
  styleUrl: './field-process-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslateDirective, TranslatePipe, OI_FORM_VALIDATION_DIRECTIVES, OI_TYPEAHEAD_DIRECTIVES]
})
export class FieldProcessModalComponent {
  private modal = inject(NgbActiveModal);
  private fb = inject(NonNullableFormBuilder);
  private configurationWorkflowService = inject(ConfigurationWorkflowService);

  readonly operationTypes = FIELD_OPERATION_TYPES;
  readonly numberOperators = FIELD_NUMBER_OPERATORS;
  readonly datetimeTypes = FIELD_DATETIME_TYPES;
  readonly timezoneTypeahead: (text$: Observable<string>) => Observable<Array<Timezone>> = inMemoryTypeahead(
    () => ['UTC', ...Intl.supportedValuesOf('timeZone')],
    timezone => timezone
  );

  readonly field = signal('');
  /** The first values discovered for the field, to test the operations on */
  readonly values = signal<Array<RecordFieldValue>>([]);
  private southId = '';

  readonly operations: FormArray<OperationForm> = this.fb.array<OperationForm>([]);
  readonly form = this.fb.group({ operations: this.operations });
  /** The type of the next operation to add */
  readonly newOperationType = this.fb.control<FieldOperationType>('uppercase');

  readonly testing = signal(false);
  readonly testError = signal<string | null>(null);
  readonly testResults = signal<Array<FieldProcessTestResultDTO> | null>(null);

  initialize(southId: string, field: string, operations: Array<FieldOperation>, values: Array<RecordFieldValue>) {
    this.southId = southId;
    this.field.set(field);
    this.values.set(values);
    for (const operation of operations) {
      this.operations.push(this.createOperationForm(operation));
    }
  }

  addOperation() {
    this.operations.push(this.createOperationForm({ type: this.newOperationType.value } as FieldOperation));
    this.testResults.set(null);
  }

  removeOperation(index: number) {
    this.operations.removeAt(index);
    this.testResults.set(null);
  }

  /** Moves an operation before (-1) or after (+1) its neighbour: the operations apply in order */
  moveOperation(index: number, offset: -1 | 1) {
    const operation = this.operations.at(index);
    this.operations.removeAt(index);
    this.operations.insert(index + offset, operation);
    this.testResults.set(null);
  }

  /** A datetime operation reads (or writes) a string with a format, a timezone and a locale */
  syncSettings(operation: OperationForm) {
    const type = operation.controls.type.value;
    const enabled = new Set(OPERATION_SETTINGS[type]);
    if (type === 'datetime') {
      if (operation.controls.inputType.value === 'string') {
        DATETIME_INPUT_STRING_SETTINGS.forEach(setting => enabled.add(setting));
      }
      if (operation.controls.outputType.value === 'string') {
        DATETIME_OUTPUT_STRING_SETTINGS.forEach(setting => enabled.add(setting));
      }
    }
    for (const [setting, control] of Object.entries(operation.controls)) {
      if (setting === 'type' || enabled.has(setting as OperationSetting)) {
        control.enable({ emitEvent: false });
      } else {
        control.disable({ emitEvent: false });
      }
    }
  }

  test() {
    this.form.markAllAsTouched();
    if (!this.form.valid || this.values().length === 0) {
      return;
    }
    this.testing.set(true);
    this.testError.set(null);
    this.configurationWorkflowService.testFieldProcess(this.southId, { operations: this.toOperations(), values: this.values() }).subscribe({
      next: results => {
        this.testResults.set(results);
        this.testing.set(false);
      },
      error: error => {
        this.testError.set(extractErrorMessage(error));
        this.testResults.set(null);
        this.testing.set(false);
      }
    });
  }

  save() {
    this.form.markAllAsTouched();
    if (!this.form.valid) {
      return;
    }
    this.modal.close(this.toOperations());
  }

  cancel() {
    this.modal.dismiss();
  }

  private createOperationForm(operation: FieldOperation): OperationForm {
    const value = operation as Partial<Record<keyof OperationForm['controls'], unknown>>;
    const text = (key: OperationSetting, defaultValue = '') => (value[key] as string | undefined) ?? defaultValue;
    const number = (key: OperationSetting, defaultValue: number | null) => (value[key] as number | null | undefined) ?? defaultValue;
    const form: OperationForm = this.fb.group({
      type: this.fb.control(operation.type),
      start: this.fb.control<number | null>(number('start', 0), Validators.required),
      end: this.fb.control<number | null>(number('end', null)),
      prefix: this.fb.control(text('prefix')),
      suffix: this.fb.control(text('suffix')),
      search: this.fb.control(text('search'), Validators.required),
      replacement: this.fb.control(text('replacement')),
      operator: this.fb.control<FieldNumberOperator>((value.operator as FieldNumberOperator | undefined) ?? 'multiply'),
      operand: this.fb.control<number | null>(number('operand', null), Validators.required),
      decimals: this.fb.control<number | null>(number('decimals', 2), [Validators.required, Validators.min(0)]),
      inputType: this.fb.control<FieldDatetimeType>((value.inputType as FieldDatetimeType | undefined) ?? 'iso-string'),
      inputFormat: this.fb.control(text('inputFormat', 'yyyy-MM-dd HH:mm:ss'), Validators.required),
      inputTimezone: this.fb.control(text('inputTimezone', 'UTC'), Validators.required),
      inputLocale: this.fb.control(text('inputLocale', 'en-En')),
      outputType: this.fb.control<FieldDatetimeType>((value.outputType as FieldDatetimeType | undefined) ?? 'iso-string'),
      outputFormat: this.fb.control(text('outputFormat', 'yyyy-MM-dd HH:mm:ss'), Validators.required),
      outputTimezone: this.fb.control(text('outputTimezone', 'UTC'), Validators.required),
      outputLocale: this.fb.control(text('outputLocale', 'en-En')),
      expression: this.fb.control(text('expression'), Validators.required)
    });
    this.syncSettings(form);
    return form;
  }

  private toOperations(): Array<FieldOperation> {
    return this.operations.controls.map(operation => toOperation(operation));
  }
}

function toOperation(operation: OperationForm): FieldOperation {
  const value = operation.getRawValue();
  switch (value.type) {
    case 'uppercase':
    case 'lowercase':
    case 'trim':
      return { type: value.type };
    case 'substring':
      return { type: value.type, start: Math.trunc(value.start ?? 0), end: value.end === null ? null : Math.trunc(value.end) };
    case 'add-to-string':
      return { type: value.type, prefix: value.prefix, suffix: value.suffix };
    case 'replace':
      return { type: value.type, search: value.search, replacement: value.replacement };
    case 'number-operation':
      return { type: value.type, operator: value.operator, operand: value.operand ?? 0 };
    case 'round':
      return { type: value.type, decimals: Math.trunc(value.decimals ?? 0) };
    case 'datetime':
      return {
        type: value.type,
        inputType: value.inputType,
        ...(value.inputType === 'string'
          ? {
              inputFormat: value.inputFormat,
              inputTimezone: value.inputTimezone,
              ...(value.inputLocale ? { inputLocale: value.inputLocale } : {})
            }
          : {}),
        outputType: value.outputType,
        ...(value.outputType === 'string'
          ? {
              outputFormat: value.outputFormat,
              outputTimezone: value.outputTimezone,
              ...(value.outputLocale ? { outputLocale: value.outputLocale } : {})
            }
          : {})
      };
    case 'expression':
      return { type: value.type, expression: value.expression };
  }
}
