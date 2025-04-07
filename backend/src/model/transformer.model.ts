import { BaseEntity } from './types';
import { OibFormControl } from '../../shared/model/form.model';

export interface BaseTransformer {
  id: string;
  name: string;
  description: string;
  inputType: string;
  outputType: string;
  type: 'custom' | 'standard';
}

export interface CustomTransformer extends BaseEntity, BaseTransformer {
  type: 'custom';
  customCode: string;
  customManifest: Array<OibFormControl>;
}

export interface StandardTransformer extends BaseTransformer {
  type: 'standard';
}

export type Transformer = CustomTransformer | StandardTransformer;

export interface TransformerLight {
  id: string;
  name: string;
  description: string;
  inputType: string;
  outputType: string;
  type: 'custom' | 'standard';
}
