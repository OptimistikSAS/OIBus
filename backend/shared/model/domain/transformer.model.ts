export const DATA_SOURCE_TYPES = ['south', 'oibus-api', 'oianalytics-setpoint'];
export type DataSourceType = (typeof DATA_SOURCE_TYPES)[number];

export const CUSTOM_TRANSFORMER_LANGUAGES = ['javascript', 'typescript'];
export type TransformerLanguage = (typeof CUSTOM_TRANSFORMER_LANGUAGES)[number];

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
