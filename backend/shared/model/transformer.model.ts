import { OIBusObjectAttribute } from './form.model';
import { ItemLightDTO, SouthConnectorLightDTO, SouthItemGroupLightDTO } from './south-connector.model';
import { Instant, UserInfo } from './types';

export const INPUT_TYPES = ['any', 'time-values', 'setpoint'];
export type InputType = (typeof INPUT_TYPES)[number];

export const DATA_SOURCE_TYPES = ['south', 'oibus-api', 'oianalytics-setpoint'];
export type DataSourceType = (typeof DATA_SOURCE_TYPES)[number];

export const OUTPUT_TYPES = ['any', 'time-values', 'opcua', 'mqtt', 'modbus', 'oianalytics'];
export type OutputType = (typeof OUTPUT_TYPES)[number];

export const CUSTOM_TRANSFORMER_LANGUAGES = ['javascript', 'typescript'];
export type TransformerLanguage = (typeof CUSTOM_TRANSFORMER_LANGUAGES)[number];

export interface InputTemplate {
  type: InputType;
  data: string;
  description: string;
}

/**
 * Manifest for a transformer type.
 * Describes the configuration schema and capabilities of a transformer type.
 */
export interface TransformerManifest {
  /**
   * The unique identifier of the transformer type.
   * @example "csv-to-mqtt"
   */
  id: string;

  /**
   * The input data type that the transformer accepts.
   * @example "any"
   */
  inputType: InputType;

  /**
   * The output data type that the transformer produces.
   * @example "mqtt"
   */
  outputType: OutputType;

  /**
   * The configuration schema for the transformer settings.
   */
  settings: OIBusObjectAttribute;
}

/**
 * Base Data Transfer Object for a transformer.
 * Represents the common properties of both custom and standard transformers.
 */
export interface BaseTransformerDTO {
  /**
   * The unique identifier of the transformer.
   * @example "transformer123"
   */
  id: string;

  /**
   * The type of the transformer ('custom' or 'standard').
   * @example "custom"
   */
  type: 'custom' | 'standard';

  /**
   * The input data type that the transformer accepts.
   * @example "string"
   */
  inputType: InputType;

  /**
   * The output data type that the transformer produces.
   * @example "number"
   */
  outputType: OutputType;

  /**
   * The manifest describing the transformer's input/output structure and attributes.
   */
  manifest: OIBusObjectAttribute;
}

/**
 * Data Transfer Object for a custom transformer.
 * Extends the base transformer with custom-specific properties.
 */
export interface CustomTransformerDTO extends BaseTransformerDTO {
  /**
   * The type of the transformer (always 'custom' for this interface).
   */
  type: 'custom';

  /**
   * The name of the custom transformer.
   * @example "String to Number"
   */
  name: string;

  /**
   * A description of what the custom transformer does.
   * @example "Converts string input to numeric output"
   */
  description: string;

  /**
   * The custom JavaScript code that implements the transformation logic.
   * @example "function transform(input) { return parseFloat(input); }"
   */
  customCode: string;

  /**
   * The language used
   * @example "javascript"
   */
  language: TransformerLanguage;

  /**
   * The maximum execution time for the custom code in milliseconds.
   * @example 2000
   */
  timeout: number;

  /**
   * The user who created the transformer. Only present for custom transformers.
   */
  createdBy: UserInfo;

  /**
   * The user who last updated the transformer. Only present for custom transformers.
   */
  updatedBy: UserInfo;

  /**
   * The date and time when the transformer was created.
   * @example "2023-10-31T12:34:56.789Z"
   */
  createdAt: Instant;

  /**
   * The date and time when the transformer was last updated.
   * @example "2023-10-31T13:45:00.123Z"
   */
  updatedAt: Instant;
}

/**
 * Data Transfer Object for a standard transformer.
 * Extends the base transformer with standard-specific properties.
 */
export interface StandardTransformerDTO extends BaseTransformerDTO {
  /**
   * The name of the standard function that implements the transformation.
   * @example "toUpperCase"
   */
  functionName: string;

  /**
   * The type of the transformer (always 'standard' for this interface).
   */
  type: 'standard';
}

/**
 * Union type representing either a custom or standard transformer.
 */
export type TransformerDTO = CustomTransformerDTO | StandardTransformerDTO;

interface BaseSourceOrigin {
  type: DataSourceType;
}

export interface SourceOriginSouthDTO extends BaseSourceOrigin {
  type: 'south';

  /**
   * The south associated to the transformer
   */
  south: SouthConnectorLightDTO;

  /**
   * The group associated to the transformer (mutually exclusive with items)
   */
  group?: SouthItemGroupLightDTO;

  /**
   * The list of items associated to the transformer
   */
  items: Array<ItemLightDTO>;
}

export interface SourceOriginOIAnalyticsDTO extends BaseSourceOrigin {
  type: 'oianalytics-setpoint';
}

export interface SourceOriginAPIDTO extends BaseSourceOrigin {
  type: 'oibus-api';
  dataSourceId: string;
}

export type TransformerSourceDTO = SourceOriginSouthDTO | SourceOriginOIAnalyticsDTO | SourceOriginAPIDTO;

export interface SourceOriginSouthCommandDTO extends BaseSourceOrigin {
  type: 'south';

  /**
   * The south ID associated to the transformer
   */
  southId: string;

  /**
   * The group ID associated to the transformer (mutually exclusive with items)
   */
  groupId?: string;

  /**
   * The list of items associated to the transformer
   */
  items: Array<{
    /**
     * The item ID
     */
    id: string;

    /**
     * The name of the item.
     *
     * @example "Temperature Logs"
     */
    name: string;

    /**
     * Whether this item is enabled.
     *
     * @example true
     */
    enabled: boolean;
  }>;
}

export interface SourceOriginOIAnalyticsCommandDTO extends BaseSourceOrigin {
  type: 'oianalytics-setpoint';
}

export interface SourceOriginAPICommandDTO extends BaseSourceOrigin {
  type: 'oibus-api';
  dataSourceId: string;
}

export type TransformerSourceCommandDTO = SourceOriginSouthCommandDTO | SourceOriginOIAnalyticsCommandDTO | SourceOriginAPICommandDTO;

/**
 * Data Transfer Object for a transformer with its options.
 * Used when a transformer needs to be applied with specific configuration options.
 */
export interface TransformerDTOWithOptions {
  /**
   * The id used to match a transformer with options
   * @example "id"
   */
  id: string;

  /**
   * From which source the data comes from
   */
  source: TransformerSourceDTO;

  /**
   * The transformer to be applied.
   */
  transformer: TransformerDTO;

  /**
   * Configuration options for the transformer.
   * @example { "precision": 2, "defaultValue": 0 }
   */
  options: Record<string, unknown>;
}

/**
 * Data Transfer Object for a transformer with its options.
 * Used when a transformer needs to be applied with specific configuration options.
 */
export interface TransformerCommandDTOWithOptions {
  /**
   * The id used to match a transformer with options
   * @example "id"
   */
  id: string;

  /**
   * From which source the data comes from
   */
  source: TransformerSourceCommandDTO;

  /**
   * The transformer to be applied.
   */
  transformerId: string;

  /**
   * Configuration options for the transformer.
   * @example { "precision": 2, "defaultValue": 0 }
   */
  options: Record<string, unknown>;
}

/**
 * Data Transfer Object for a transformer with its options.
 * Used when a transformer needs to be applied with specific configuration options.
 */
export interface HistoryTransformerDTOWithOptions {
  /**
   * The id used to match a transformer with options
   * @example "id"
   */
  id: string;

  /**
   * The list of items associated to the transformer
   */
  items: Array<ItemLightDTO>;

  /**
   * The transformer to be applied.
   */
  transformer: TransformerDTO;

  /**
   * Configuration options for the transformer.
   * @example { "precision": 2, "defaultValue": 0 }
   */
  options: Record<string, unknown>;
}

export interface HistoryTransformerCommandDTOWithOptions {
  /**
   * The id used to match a transformer with options
   * @example "id"
   */
  id: string;

  /**
   * The list of items associated to the transformer
   */
  items: Array<{
    /**
     * The item ID
     */
    id: string;

    /**
     * The name of the item.
     *
     * @example "Temperature Logs"
     */
    name: string;

    /**
     * Whether this item is enabled.
     *
     * @example true
     */
    enabled: boolean;
  }>;

  /**
   * The transformer to be applied.
   */
  transformerId: string;

  /**
   * Configuration options for the transformer.
   * @example { "precision": 2, "defaultValue": 0 }
   */
  options: Record<string, unknown>;
}

/**
 * Command Data Transfer Object for creating or updating a custom transformer.
 */
export interface CustomTransformerCommandDTO {
  /**
   * The type of the transformer (always 'custom' for this interface).
   */
  type: 'custom';

  /**
   * The input data type that the transformer accepts.
   * @example "string"
   */
  inputType: string;

  /**
   * The output data type that the transformer produces.
   * @example "number"
   */
  outputType: string;

  /**
   * The name of the custom transformer.
   * @example "String to Number"
   */
  name: string;

  /**
   * A description of what the custom transformer does.
   * @example "Converts string input to numeric output"
   */
  description: string;

  /**
   * The custom JavaScript code that implements the transformation logic.
   * @example "function transform(input) { return parseFloat(input); }"
   */
  customCode: string;

  /**
   * The manifest describing the transformer's input/output structure and attributes.
   */
  customManifest: OIBusObjectAttribute;

  /**
   * The language of the custom code
   * @example "javascript"
   */
  language: TransformerLanguage;

  /**
   * The maximum execution time for the custom code in milliseconds.
   * @example 2000
   */
  timeout: number;
}

/**
 * Parameters for searching transformers.
 * Used to query transformers based on type, input/output types, and pagination.
 */
export interface TransformerSearchParam {
  /**
   * The type of transformer to search for ('standard', 'custom', or undefined for all types).
   * @example "custom"
   */
  type: 'standard' | 'custom' | undefined;

  /**
   * The input data type to filter transformers by.
   * Can be `undefined` to ignore this filter.
   * @example "string"
   */
  inputType: string | undefined;

  /**
   * The output data type to filter transformers by.
   * Can be `undefined` to ignore this filter.
   * @example "number"
   */
  outputType: string | undefined;

  /**
   * The page number for paginated results.
   * @example 1
   */
  page: number;
}

export interface TransformerTestRequest {
  inputData: string;
  options?: object;
}

export interface TransformerTestResponse {
  output: string;
  metadata: {
    contentType: string;
    contentFile: string;
    contentSize: number;
    createdAt: Instant;
    numberOfElement: number;
  };
}
