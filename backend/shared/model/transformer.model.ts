import { OIBusObjectAttribute } from './form.model';

export const INPUT_TYPES = ['any', 'time-values', 'setpoint'];
export type InputType = (typeof INPUT_TYPES)[number];

export const OUTPUT_TYPES = ['any', 'time-values', 'opcua', 'mqtt', 'modbus'];
export type OutputType = (typeof OUTPUT_TYPES)[number];

export interface BaseTransformerDTO {
  id: string;
  type: 'custom' | 'standard';
  inputType: InputType;
  outputType: OutputType;
  manifest: OIBusObjectAttribute;
}

export interface CustomTransformerDTO extends BaseTransformerDTO {
  type: 'custom';
  name: string;
  description: string;
  customCode: string;
}

export interface StandardTransformerDTO extends BaseTransformerDTO {
  functionName: string;
  type: 'standard';
}

export type TransformerDTO = CustomTransformerDTO | StandardTransformerDTO;

export interface TransformerDTOWithOptions {
  inputType: InputType;
  transformer: TransformerDTO;
  options: object;
}
export interface BaseTransformerCommand {
  type: 'custom' | 'standard';
  inputType: InputType;
  outputType: OutputType;
}

export interface StandardTransformerCommand extends BaseTransformerCommand {
  type: 'standard';
  functionName: string;
}

export interface CustomTransformerCommand extends BaseTransformerCommand {
  type: 'custom';
  name: string;
  description: string;
  customCode: string;
  customManifest: OIBusObjectAttribute;
}

export type TransformerCommandDTO = StandardTransformerCommand | CustomTransformerCommand;

export interface TransformerSearchParam {
  type?: 'standard' | 'custom';
  inputType?: InputType;
  outputType?: OutputType;
  page?: number;
}
