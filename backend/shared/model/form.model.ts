/**
 * List of available attribute types for OIBus form elements.
 * These types define how form fields are rendered and validated.
 */
export const OIBUS_ATTRIBUTE_TYPES = [
  'string', // Text input field
  'number', // Numeric input field
  'instant', // Date/time picker
  'string-select', // Dropdown select with predefined string options
  'secret', // Password/secret input field (masked)
  'code', // Code editor field
  'boolean', // Checkbox or toggle switch
  'scan-mode', // Special field for scan mode selection
  'transformer-array', // Array of transformer configurations
  'certificate', // Certificate upload/selection field
  'timezone', // Timezone selection field
  'array', // Array of objects
  'object' // Group of related attributes
] as const;

/**
 * Type representing the possible attribute types for OIBus form elements.
 *
 * @example 'string'
 */
export type OIBusAttributeType = (typeof OIBUS_ATTRIBUTE_TYPES)[number];

/**
 * List of available validator types for OIBus form attributes.
 * These validators are used to enforce data constraints.
 */
export const OIBUS_ATTRIBUTE_VALIDATOR_TYPES = [
  'REQUIRED', // Field must have a value
  'MINIMUM', // Minimum value (for numbers)
  'MAXIMUM', // Maximum value (for numbers)
  'POSITIVE_INTEGER', // Value must be a positive integer
  'VALID_CRON', // Value must be a valid cron expression
  'PATTERN', // Value must match a specific regex pattern
  'UNIQUE', // Value must be unique within a collection
  'SINGLE_TRUE', // Only one field in a group can be true
  'MQTT_TOPIC_OVERLAP' // MQTT topics must not overlap
] as const;

/**
 * Type representing the possible validator types for OIBus form attributes.
 *
 * @example 'REQUIRED'
 */
export type OIBusAttributeValidatorType = (typeof OIBUS_ATTRIBUTE_VALIDATOR_TYPES)[number];

/**
 * Validator configuration for OIBus form attributes.
 * Defines validation rules and their parameters.
 */
export interface OIBusAttributeValidator {
  /**
   * The type of validator to apply.
   *
   * @example 'REQUIRED'
   */
  type: OIBusAttributeValidatorType;

  /**
   * Arguments for the validator.
   * For example, for MINIMUM validator: ["10"] would set minimum value to 10.
   *
   * @example []
   */
  arguments: Array<string>;
}

/**
 * Display properties for individual form attributes.
 * Controls layout and visibility in form view.
 */
interface OIBusAttributeDisplayProperties {
  /**
   * The row position in the form layout (1-based index).
   *
   * @example 1
   */
  row: number;

  /**
   * The number of columns this attribute should span.
   *
   * @example 6
   */
  columns: number;

  /**
   * Whether this attribute should be displayed in view mode.
   *
   * @example true
   */
  displayInViewMode: boolean;
}

/**
 * Display properties for object-type form attributes.
 * Controls visibility and styling of object containers.
 */
interface OIBusObjectDisplayProperties {
  /**
   * Whether this object should be visible in the form.
   *
   * @example true
   */
  visible: boolean;

  /**
   * Whether this object should be wrapped in a visual box/container.
   *
   * @example true
   */
  wrapInBox: boolean;
}

/**
 * Condition that determines when an attribute should be enabled/disabled.
 * Used for dynamic form behavior based on other field values.
 */
export interface OIBusEnablingCondition {
  /**
   * Path to the attribute that should be enabled/disabled.
   *
   * @example "protocol"
   */
  targetPathFromRoot: string;

  /**
   * Path to the attribute whose value determines the enabling condition.
   *
   * @example "connection.type"
   */
  referralPathFromRoot: string;

  /**
   * Values of the referral attribute that will enable the target attribute.
   *
   * @example ["MQTT"]
   */
  values: Array<string | number | boolean>;
}

/**
 * Base interface for all OIBus form attributes.
 * Contains common properties for all attribute types.
 */
interface BaseOIBusAttribute {
  /**
   * The type of this attribute.
   *
   * @example "string"
   */
  type: OIBusAttributeType;

  /**
   * The unique key/identifier for this attribute.
   *
   * @example "serverUrl"
   */
  key: string;

  /**
   * Translation key for internationalization.
   *
   * @example "connection.serverUrl"
   */
  translationKey: string;

  /**
   * Validators to apply to this attribute.
   */
  validators: Array<OIBusAttributeValidator>;
}

/**
 * Base interface for displayable OIBus form attributes.
 * Extends BaseOIBusAttribute with display properties.
 */
export interface BaseOIBusDisplayableAttribute extends BaseOIBusAttribute {
  /**
   * Display properties for this attribute.
   */
  displayProperties: OIBusAttributeDisplayProperties;
}

/**
 * Object-type attribute that groups related attributes.
 * Used to create nested form structures.
 */
export interface OIBusObjectAttribute extends BaseOIBusAttribute {
  /**
   * The type of this attribute (always "object").
   */
  type: 'object';

  /**
   * Child attributes contained within this object.
   */
  attributes: Array<OIBusAttribute>;

  /**
   * Conditions that determine when this object should be enabled.
   */
  enablingConditions: Array<OIBusEnablingCondition>;

  /**
   * Display properties for this object.
   */
  displayProperties: OIBusObjectDisplayProperties;
}

/**
 * Numeric input attribute.
 */
export interface OIBusNumberAttribute extends BaseOIBusDisplayableAttribute {
  /**
   * The type of this attribute (always "number").
   */
  type: 'number';

  /**
   * Default value for this attribute.
   *
   * @example 1883
   */
  defaultValue: number | null;

  /**
   * Unit of measurement for this number (e.g., "ms", "kb").
   * Displayed next to the input field.
   *
   * @example "ms"
   */
  unit: string | null;
}

/**
 * Secret/password input attribute.
 * Value is masked in the UI.
 */
export interface OIBusSecretAttribute extends BaseOIBusDisplayableAttribute {
  /**
   * The type of this attribute (always "secret").
   */
  type: 'secret';
}

/**
 * Text input attribute.
 */
export interface OIBusStringAttribute extends BaseOIBusDisplayableAttribute {
  /**
   * The type of this attribute (always "string").
   */
  type: 'string';

  /**
   * Default value for this attribute.
   *
   * @example "oibus-client"
   */
  defaultValue: string | null;
}

/**
 * Code editor attribute for SQL or JSON content.
 */
export interface OIBusCodeAttribute extends BaseOIBusDisplayableAttribute {
  /**
   * The type of this attribute (always "code").
   */
  type: 'code';

  /**
   * Type of content for syntax highlighting.
   *
   * @example "sql"
   */
  contentType: 'sql' | 'json';

  /**
   * Default value for this attribute.
   *
   * @example "SELECT * FROM table"
   */
  defaultValue: string | null;
}

/**
 * Dropdown select attribute with predefined string options.
 */
export interface OIBusStringSelectAttribute extends BaseOIBusDisplayableAttribute {
  /**
   * The type of this attribute (always "string-select").
   */
  type: 'string-select';

  /**
   * Available options for selection.
   *
   * @example ["MQTT", "AMQP", "HTTP"]
   */
  selectableValues: Array<string>;

  /**
   * Default selected value.
   *
   * @example "MQTT"
   */
  defaultValue: string | null;
}

/**
 * Boolean (checkbox/toggle) attribute.
 */
export interface OIBusBooleanAttribute extends BaseOIBusDisplayableAttribute {
  /**
   * The type of this attribute (always "boolean").
   */
  type: 'boolean';

  /**
   * Default value for this attribute.
   *
   * @example false
   */
  defaultValue: boolean;
}

/**
 * Date/time picker attribute.
 */
export interface OIBusInstantAttribute extends BaseOIBusDisplayableAttribute {
  /**
   * The type of this attribute (always "instant").
   */
  type: 'instant';
}

/**
 * Scan mode selection attribute.
 * Used for configuring how often data should be collected.
 */
export interface OIBusScanModeAttribute extends BaseOIBusDisplayableAttribute {
  /**
   * The type of this attribute (always "scan-mode").
   */
  type: 'scan-mode';

  /**
   * What types of scan modes are acceptable.
   * POLL: Regular interval polling
   * SUBSCRIPTION: Real-time subscription
   * SUBSCRIPTION_AND_POLL: Both real-time and polling
   *
   * @example "POLL"
   */
  acceptableType: 'POLL' | 'SUBSCRIPTION_AND_POLL' | 'SUBSCRIPTION';
}

/**
 * Certificate upload/selection attribute.
 */
export interface OIBusCertificateAttribute extends BaseOIBusDisplayableAttribute {
  /**
   * The type of this attribute (always "certificate").
   */
  type: 'certificate';
}

/**
 * Array attribute for managing collections of objects.
 * Used for repeatable sections in forms.
 */
export interface OIBusArrayAttribute extends BaseOIBusAttribute {
  /**
   * The type of this attribute (always "array").
   */
  type: 'array';

  /**
   * Whether to paginate the array elements.
   *
   * @example true
   */
  paginate: boolean;

  /**
   * Number of elements to display per page when paginated.
   *
   * @example 5
   */
  numberOfElementPerPage: number;

  /**
   * The object attribute that defines the structure of each array element.
   */
  rootAttribute: OIBusObjectAttribute;
}

/**
 * Timezone selection attribute.
 */
export interface OIBusTimezoneAttribute extends BaseOIBusDisplayableAttribute {
  /**
   * The type of this attribute (always "timezone").
   */
  type: 'timezone';

  /**
   * Default timezone value.
   *
   * @example "UTC"
   */
  defaultValue: string | null;
}

/**
 * Union type representing all possible OIBus form attributes.
 * Includes both displayable attributes and array/object containers.
 */
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

/**
 * Union type representing OIBus form attributes that can be used as controls.
 * Excludes object and array types which are containers rather than controls.
 */
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

/**
 * Union type representing OIBus form attributes that can be displayed directly.
 * Excludes array type which is a container for displayable attributes.
 */
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
