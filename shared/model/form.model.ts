import { ScanModeDTO } from './scan-mode.model';
import { Authentication, AuthenticationType } from './engine.model';
import { DateTimeField } from './types';

export const FORM_COMPONENT_TYPES = [
  'OibText',
  'OibNumber',
  'OibSelect',
  'OibSecret',
  'OibTextArea',
  'OibCodeBlock',
  'OibCheckbox',
  'OibScanMode',
  'OibScanMode',
  'OibTimezone',
  'OibProxy',
  'OibDateTimeFields',
  'OibAuthentication',
  'FormGroup'
] as const;
export type FormComponentType = (typeof FORM_COMPONENT_TYPES)[number];

export const FORM_COMPONENT_VALIDATOR_TYPES = ['required', 'min', 'max', 'pattern', 'minLength', 'maxLength'] as const;
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

export type FormComponentValidator =
  | RequiredValidator
  | MinValidator
  | MaxValidator
  | PatternValidator
  | MinLengthValidator
  | MaxLengthValidator;

export interface BaseOibFormControl<T> {
  key: string;
  type: FormComponentType;
  label: string;
  defaultValue?: T;
  unitLabel?: string; // on optional unit label to indicate which unit is used
  newRow?: boolean;
  class?: string;
  conditionalDisplay?: DisplayCondition;
  readDisplay?: boolean; // readDisplay is used to display the settings value in display mode
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

export interface OibTimezoneFormControl extends BaseOibFormControl<string> {
  type: 'OibTimezone';
}

export interface OibProxyFormControl extends BaseOibFormControl<string> {
  type: 'OibProxy';
}

export interface OibAuthenticationFormControl extends BaseOibFormControl<Authentication> {
  type: 'OibAuthentication';
  authTypes: Array<AuthenticationType>;
}

export interface OibDateTimeFieldsFormControl extends BaseOibFormControl<Array<DateTimeField>> {
  type: 'OibDateTimeFields';
  allowedDateObjectTypes: Array<string>;
}

export interface OibFormGroup extends BaseOibFormControl<void> {
  type: 'FormGroup';
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
  | OibTimezoneFormControl
  | OibProxyFormControl
  | OibDateTimeFieldsFormControl
  | OibAuthenticationFormControl
  | OibFormGroup;
