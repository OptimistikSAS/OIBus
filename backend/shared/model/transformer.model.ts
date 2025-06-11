import { OibFormControl } from './form.model';

export interface BaseTransformerDTO {
  id: string;
  type: 'custom' | 'standard';
  inputType: string;
  outputType: string;
  manifest: Array<OibFormControl>;
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
  inputType: string;
  transformer: TransformerDTO;
  options: object;
}

export interface CustomTransformerCommand {
  name: string;
  description: string;
  inputType: string;
  outputType: string;
  customCode: string;
  customManifest: Array<OibFormControl>;
}

export interface TransformerSearchParam {
  type?: 'standard' | 'custom';
  inputType?: string;
  outputType?: string;
  page?: number;
}
