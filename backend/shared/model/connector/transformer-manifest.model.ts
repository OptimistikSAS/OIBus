import { OIBusObjectAttribute } from './form.model';

export const INPUT_TYPES = ['file', 'setpoint', 'record-list'] as const;
export type InputType = (typeof INPUT_TYPES)[number];

export const OUTPUT_TYPES = ['file', 'record-list', 'opcua', 'mqtt', 'modbus', 'oianalytics'] as const;
export type OutputType = (typeof OUTPUT_TYPES)[number];

/**
 * Manifest for a transformer type.
 * Describes the configuration schema and capabilities of a transformer type.
 */
export interface TransformerManifest {
  /**
   * The unique identifier of the transformer type.
   * @example "file-to-mqtt"
   */
  id: string;

  /**
   * The input data type that the transformer accepts.
   * @example "file"
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
