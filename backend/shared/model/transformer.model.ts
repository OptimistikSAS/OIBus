import { OibFormControl } from './form.model';

export interface BaseTransformerDTO {
  id: string;
  type: 'custom' | 'standard';
  name: string;
  description: string;
  inputType: string;
  outputType: string;
  manifest: Array<OibFormControl>;
}

export interface CustomTransformerDTO extends BaseTransformerDTO {
  type: 'custom';
  customCode: string;
}

export interface StandardTransformerDTO extends BaseTransformerDTO {
  type: 'standard';
}

export type TransformerDTO = CustomTransformerDTO | StandardTransformerDTO;

export interface TransformerLightDTO {
  id: string;
  type: 'custom' | 'standard';
  name: string;
  description: string;
  inputType: string;
  outputType: string;
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
  name?: string;
  type?: 'standard' | 'custom';
  inputType?: string;
  outputType?: string;
  page?: number;
}
