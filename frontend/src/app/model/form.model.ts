import { ScanModeDTO } from './scan-mode.model';
import { ProxyDTO } from './proxy.model';

export const CONNECTOR_FORM_TYPES = [
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
  'OibProxy'
] as const;
export type ConnectorFormType = typeof CONNECTOR_FORM_TYPES[number];

export const CONNECTOR_FORM_VALIDATOR_TYPES = ['required', 'min', 'max', 'pattern', 'minLength', 'maxLength'] as const;
export type ConnectorFormValidatorType = typeof CONNECTOR_FORM_VALIDATOR_TYPES[number];

interface Validator {
  key: ConnectorFormValidatorType;
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

export type ConnectorFormValidator =
  | RequiredValidator
  | MinValidator
  | MaxValidator
  | PatternValidator
  | MinLengthValidator
  | MaxLengthValidator;

export interface BaseOibFormControl<T> {
  key: string;
  type: ConnectorFormType;
  label: string;
  defaultValue: T | null;
  currentValue: T | null;
  newRow: boolean;
  class: 'col' | `col-${number}` | null;
  conditionalDisplay: {
    // Each key refers to another OibFormControl which values must include this OibFormControl value to display this field in a form
    [key: string]: Array<string | number | boolean>;
  } | null;
  // readDisplay is used to display the settings value in display mode
  readDisplay: boolean | null;
  validators: Array<ConnectorFormValidator> | null;
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

export interface OibProxyFormControl extends BaseOibFormControl<ProxyDTO> {
  type: 'OibProxy';
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
  | OibProxyFormControl;
