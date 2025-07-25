import { ScanModeDTO } from './scan-mode.model';

export const FORM_COMPONENT_TYPES = [
  'OibText',
  'OibNumber',
  'OibSelect',
  'OibSecret',
  'OibTextArea',
  'OibCodeBlock',
  'OibCheckbox',
  'OibScanMode',
  'OibCertificate',
  'OibTimezone',
  'OibArray',
  'OibFormGroup'
] as const;
export type FormComponentType = (typeof FORM_COMPONENT_TYPES)[number];

export const FORM_COMPONENT_VALIDATOR_TYPES = [
  'required',
  'min',
  'max',
  'pattern',
  'minLength',
  'maxLength',
  'unique',
  'singleTrue'
] as const;
export type FormComponentValidatorType = (typeof FORM_COMPONENT_VALIDATOR_TYPES)[number];

interface Validator {
  key: FormComponentValidatorType;
}

interface RequiredValidator extends Validator {
  key: 'required';
}

interface MinValidator extends Validator {
  key: 'min';
  params: {
    min: number;
  };
}

interface MaxValidator extends Validator {
  key: 'max';
  params: {
    max: number;
  };
}

interface PatternValidator extends Validator {
  key: 'pattern';
  params: {
    pattern: string;
  };
}

interface MinLengthValidator extends Validator {
  key: 'minLength';
  params: {
    minLength: number;
  };
}

interface MaxLengthValidator extends Validator {
  key: 'maxLength';
  params: {
    maxLength: number;
  };
}

interface UniqueValidator extends Validator {
  key: 'unique';
}
interface SingleTrueValidator extends Validator {
  key: 'singleTrue';
}

export type FormComponentValidator =
  | RequiredValidator
  | MinValidator
  | MaxValidator
  | PatternValidator
  | MinLengthValidator
  | MaxLengthValidator
  | UniqueValidator
  | SingleTrueValidator;

export interface BaseOibFormControl<T> {
  key: string;
  type: FormComponentType;
  translationKey: string;
  defaultValue?: T;
  unitLabel?: string; // an optional unit label to indicate which unit is used
  newRow?: boolean;
  class?: string;
  conditionalDisplay?: DisplayCondition;
  displayInViewMode?: boolean; // readDisplay is used to display the settings value in display mode
  validators?: Array<FormComponentValidator>;
}

export interface DisplayCondition {
  field: string;
  values: Array<string | number | boolean>;
}

export interface OibTextFormControl extends BaseOibFormControl<string> {
  type: 'OibText';
}

export interface OibTextAreaFormControl extends BaseOibFormControl<string> {
  type: 'OibTextArea';
}

export interface OibCodeBlockFormControl extends BaseOibFormControl<string> {
  type: 'OibCodeBlock';
  contentType: string;
}

export interface OibNumberFormControl extends BaseOibFormControl<number> {
  type: 'OibNumber';
}

export interface OibSelectFormControl extends BaseOibFormControl<string> {
  type: 'OibSelect';
  options: Array<string>;
}

export interface OibSecretFormControl extends BaseOibFormControl<string> {
  type: 'OibSecret';
}

export interface OibCheckboxFormControl extends BaseOibFormControl<boolean> {
  type: 'OibCheckbox';
}

export interface OibScanModeFormControl extends BaseOibFormControl<ScanModeDTO> {
  type: 'OibScanMode';
  acceptSubscription: boolean;
  subscriptionOnly: boolean;
}

export interface OibCertificateFormControl extends BaseOibFormControl<string> {
  type: 'OibCertificate';
}

export interface OibTimezoneFormControl extends BaseOibFormControl<string> {
  type: 'OibTimezone';
}

export interface OibArrayFormControl extends BaseOibFormControl<Array<OibFormControl>> {
  type: 'OibArray';
  content: Array<OibFormControl>;
  allowRowDuplication?: boolean;
}

export interface OibFormGroup extends BaseOibFormControl<void> {
  type: 'OibFormGroup';
  content: Array<OibFormControl>;
}

export type OibFormControl =
  | OibTextFormControl
  | OibTextAreaFormControl
  | OibCodeBlockFormControl
  | OibNumberFormControl
  | OibSelectFormControl
  | OibSecretFormControl
  | OibCheckboxFormControl
  | OibScanModeFormControl
  | OibCertificateFormControl
  | OibTimezoneFormControl
  | OibArrayFormControl
  | OibFormGroup;
