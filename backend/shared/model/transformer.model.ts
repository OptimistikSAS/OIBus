import { OIBusDataType } from './engine.model';

export interface BaseTransformerDTO {
  id: string;
  type: 'custom' | 'standard';
  name: string;
  description: string;
  inputType: OIBusDataType;
  outputType: OIBusDataType;
}

export interface CustomTransformerDTO extends BaseTransformerDTO {
  type: 'custom';
  customCode: string;
}

export interface StandardTransformerDTO extends BaseTransformerDTO {
  type: 'standard';
  standardCode: string;
}

export type TransformerDTO = CustomTransformerDTO | StandardTransformerDTO;

export interface TransformerLightDTO {
  id: string;
  type: 'custom' | 'standard';
  name: string;
  description: string;
  inputType: OIBusDataType;
  outputType: OIBusDataType;
}

export interface CustomTransformerCommand {
  name: string;
  description: string;
  inputType: OIBusDataType;
  outputType: OIBusDataType;
  customCode: string;
}

export interface TransformerSearchParam {
  name?: string;
  type?: 'standard' | 'custom';
  inputType?: OIBusDataType;
  outputType?: OIBusDataType;
  page?: number;
}
