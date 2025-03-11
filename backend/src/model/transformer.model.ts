import { BaseEntity } from './types';
import { OIBusDataType } from '../../shared/model/engine.model';

export interface BaseTransformer {
  id: string;
  name: string;
  description: string;
  inputType: OIBusDataType;
  outputType: OIBusDataType;
  type: 'custom' | 'standard';
}

export interface CustomTransformer extends BaseEntity, BaseTransformer {
  type: 'custom';
  customCode: string;
}

export interface StandardTransformer extends BaseTransformer {
  standardCode: string;
  type: 'standard';
}

export type Transformer = CustomTransformer | StandardTransformer;

export interface TransformerLight {
  id: string;
  name: string;
  description: string;
  inputType: OIBusDataType;
  outputType: OIBusDataType;
  type: 'custom' | 'standard';
}
