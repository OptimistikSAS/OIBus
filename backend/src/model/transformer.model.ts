import { BaseEntity } from './types';
import { OibFormControl } from '../../shared/model/form.model';

export interface BaseTransformer {
  id: string;
  inputType: string;
  outputType: string;
  type: 'custom' | 'standard';
}

export interface CustomTransformer extends BaseEntity, BaseTransformer {
  type: 'custom';
  name: string;
  description: string;
  customCode: string;
  customManifest: Array<OibFormControl>;
}

export interface StandardTransformer extends BaseTransformer {
  functionName: string;
  type: 'standard';
}

export type Transformer = CustomTransformer | StandardTransformer;

export interface TransformerWithOptions {
  transformer: Transformer;
  options: object;
  inputType: string;
}

export interface TransformerLight {
  id: string;
  inputType: string;
  outputType: string;
  type: 'custom' | 'standard';
}
