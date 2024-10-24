import { BaseEntity } from './types';

export interface IPFilterDTO extends BaseEntity {
  address: string;
  description: string;
}

export interface IPFilterCommandDTO {
  address: string;
  description: string;
}
