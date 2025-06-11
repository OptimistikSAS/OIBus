export const OIBUS_ATTRIBUTE_TYPES = [
  'string',
  'number',
  'instant',
  'string-select',
  'secret',
  'code',
  'boolean',
  'scan-mode',
  'transformer-array',
  'certificate',
  'timezone',
  'array',
  'object'
] as const;
export type OIBusAttributeType = (typeof OIBUS_ATTRIBUTE_TYPES)[number];

export const OIBUS_ATTRIBUTE_VALIDATOR_TYPES = [
  'REQUIRED',
  'MINIMUM',
  'MAXIMUM',
  'POSITIVE_INTEGER',
  'VALID_CRON',
  'PATTERN',
  'UNIQUE',
  'SINGLE_TRUE'
] as const;
export type OIBusAttributeValidatorType = (typeof OIBUS_ATTRIBUTE_VALIDATOR_TYPES)[number];

export interface OIBusAttributeValidator {
  type: OIBusAttributeValidatorType;
  arguments: Array<string>;
}

interface OIBusAttributeDisplayProperties {
  row: number;
  columns: number;
  displayInViewMode: boolean;
}

interface OIBusObjectDisplayProperties {
  visible: boolean;
  wrapInBox: boolean;
}

export interface OIBusEnablingCondition {
  targetPathFromRoot: string;
  referralPathFromRoot: string;
  values: Array<string | number | boolean>;
}

interface BaseOIBusAttribute {
  type: OIBusAttributeType;
  key: string;
  translationKey: string;
  validators: Array<OIBusAttributeValidator>;
}

export interface BaseOIBusDisplayableAttribute extends BaseOIBusAttribute {
  displayProperties: OIBusAttributeDisplayProperties;
}

export interface OIBusObjectAttribute extends BaseOIBusAttribute {
  type: 'object';
  attributes: Array<OIBusAttribute>;
  enablingConditions: Array<OIBusEnablingCondition>;
  displayProperties: OIBusObjectDisplayProperties;
}

export interface OIBusNumberAttribute extends BaseOIBusDisplayableAttribute {
  type: 'number';
  defaultValue: number | null;
  unit: string | null;
}

export interface OIBusSecretAttribute extends BaseOIBusDisplayableAttribute {
  type: 'secret';
}

export interface OIBusStringAttribute extends BaseOIBusDisplayableAttribute {
  type: 'string';
  defaultValue: string | null;
}

export interface OIBusCodeAttribute extends BaseOIBusDisplayableAttribute {
  type: 'code';
  contentType: 'sql' | 'json';
  defaultValue: string | null;
}

export interface OIBusStringSelectAttribute extends BaseOIBusDisplayableAttribute {
  type: 'string-select';
  selectableValues: Array<string>;
  defaultValue: string | null;
}

export interface OIBusBooleanAttribute extends BaseOIBusDisplayableAttribute {
  type: 'boolean';
  defaultValue: boolean;
}

export interface OIBusInstantAttribute extends BaseOIBusDisplayableAttribute {
  type: 'instant';
}

export interface OIBusScanModeAttribute extends BaseOIBusDisplayableAttribute {
  type: 'scan-mode';
  acceptableType: 'POLL' | 'SUBSCRIPTION_AND_POLL' | 'SUBSCRIPTION';
}

export interface OIBusCertificateAttribute extends BaseOIBusDisplayableAttribute {
  type: 'certificate';
}

export interface OIBusArrayAttribute extends BaseOIBusAttribute {
  type: 'array';
  paginate: boolean;
  numberOfElementPerPage: number;
  rootAttribute: OIBusObjectAttribute;
}

export interface OIBusTimezoneAttribute extends BaseOIBusDisplayableAttribute {
  type: 'timezone';
  defaultValue: string | null;
}

export type OIBusAttribute =
  | OIBusObjectAttribute
  | OIBusStringAttribute
  | OIBusCodeAttribute
  | OIBusStringSelectAttribute
  | OIBusSecretAttribute
  | OIBusNumberAttribute
  | OIBusBooleanAttribute
  | OIBusInstantAttribute
  | OIBusScanModeAttribute
  | OIBusCertificateAttribute
  | OIBusTimezoneAttribute
  | OIBusArrayAttribute;

export type OIBusControlAttribute =
  | OIBusStringAttribute
  | OIBusCodeAttribute
  | OIBusStringSelectAttribute
  | OIBusSecretAttribute
  | OIBusNumberAttribute
  | OIBusBooleanAttribute
  | OIBusInstantAttribute
  | OIBusScanModeAttribute
  | OIBusTimezoneAttribute
  | OIBusCertificateAttribute;
export type OIBusDisplayableAttribute =
  | OIBusStringAttribute
  | OIBusCodeAttribute
  | OIBusStringSelectAttribute
  | OIBusSecretAttribute
  | OIBusNumberAttribute
  | OIBusBooleanAttribute
  | OIBusInstantAttribute
  | OIBusScanModeAttribute
  | OIBusCertificateAttribute
  | OIBusTimezoneAttribute;
