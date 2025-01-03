import { BaseEntity } from './types';

export interface Transformer extends BaseEntity {
  name: string;
  description: string;
  inputType: string;
  outputType: string;
  code: string;
}
