import { BaseEntity } from './types';
import { OIBusObjectAttribute } from '../../shared/model/form.model';
import { TransformerLanguage } from '../../shared/model/transformer.model';
import { SouthConnectorEntityLight } from './south-connector.model';

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
  language: TransformerLanguage;
  customManifest: OIBusObjectAttribute;
}

export interface StandardTransformer extends BaseTransformer {
  functionName: string;
  type: 'standard';
}

export type Transformer = CustomTransformer | StandardTransformer;

export interface NorthTransformerWithOptions {
  id: string;
  transformer: Transformer;
  south: SouthConnectorEntityLight | undefined;
  options: Record<string, unknown>;
  inputType: string;
}

export interface HistoryTransformerWithOptions {
  id: string;
  transformer: Transformer;
  options: Record<string, unknown>;
  inputType: string;
}
