import { BaseEntity } from './types';

export interface IPFilter extends BaseEntity {
  address: string;
  description: string;
}
