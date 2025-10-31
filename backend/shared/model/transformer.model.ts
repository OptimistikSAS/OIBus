import { OIBusObjectAttribute } from './form.model';

/**
 * Base Data Transfer Object for a transformer.
 * Represents the common properties of both custom and standard transformers.
 *
 * @example
 * {
 *   "id": "transformer123",
 *   "type": "custom",
 *   "inputType": "string",
 *   "outputType": "number",
 *   "manifest": {}, // TODO
 * }
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
  inputType: string;

  /**
   * The output data type that the transformer produces.
   * @example "number"
   */
  outputType: string;

  /**
   * The manifest describing the transformer's input/output structure and attributes.
   */
  manifest: OIBusObjectAttribute;
}

/**
 * Data Transfer Object for a custom transformer.
 * Extends the base transformer with custom-specific properties.
 *
 * @example
 * {
 *   "id": "customTransformer123",
 *   "type": "custom",
 *   "inputType": "string",
 *   "outputType": "number",
 *   "manifest": {}, // TODO
 *   "name": "String to Number",
 *   "description": "Converts string input to numeric output",
 *   "customCode": "function transform(input) { return parseFloat(input); }"
 * }
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
}

/**
 * Data Transfer Object for a standard transformer.
 * Extends the base transformer with standard-specific properties.
 *
 * @example
 * {
 *   "id": "standardTransformer123",
 *   "type": "standard",
 *   "inputType": "string",
 *   "outputType": "string",
 *   "manifest": {}, // TODO
 *   "functionName": "toUpperCase"
 * }
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

/**
 * Data Transfer Object for a transformer with its options.
 * Used when a transformer needs to be applied with specific configuration options.
 *
 * @example
 * {
 *   "inputType": "string",
 *   "transformer": {
 *     "id": "customTransformer123",
 *     "type": "custom",
 *     "inputType": "string",
 *     "outputType": "number",
 *     "manifest": {}, // TODO
 *     "name": "String to Number",
 *     "description": "Converts string input to numeric output",
 *     "customCode": "function transform(input) { return parseFloat(input); }"
 *   },
 *   "options": {
 *     "precision": 2,
 *     "defaultValue": 0
 *   }
 * }
 */
export interface TransformerDTOWithOptions {
  /**
   * The input data type that the transformer accepts.
   * @example "string"
   */
  inputType: string;

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
 * Data Transfer Object for referencing a transformer by ID with its options.
 * Used when only the transformer ID is needed along with configuration options.
 *
 * @example
 * {
 *   "inputType": "string",
 *   "transformerId": "customTransformer123",
 *   "options": {
 *     "precision": 2,
 *     "defaultValue": 0
 *   }
 * }
 */
export interface TransformerIdWithOptions {
  /**
   * The input data type that the transformer accepts.
   * @example "string"
   */
  inputType: string;

  /**
   * The unique identifier of the transformer to be applied.
   * @example "customTransformer123"
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
 *
 * @example
 * {
 *   "type": "custom",
 *   "inputType": "string",
 *   "outputType": "number",
 *   "name": "String to Number",
 *   "description": "Converts string input to numeric output",
 *   "customCode": "function transform(input) { return parseFloat(input); }",
 *   "customManifest": {} // TODO
 * }
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
}

/**
 * Parameters for searching transformers.
 * Used to query transformers based on type, input/output types, and pagination.
 *
 * @example
 * {
 *   "type": "custom",
 *   "inputType": "string",
 *   "outputType": "number",
 *   "page": 1
 * }
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
