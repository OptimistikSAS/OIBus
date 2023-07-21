import { BaseEntity } from './types';

/**
 * DTO for IP filters
 */
export interface IpFilterDTO extends BaseEntity {
  address: string;
  description: string;
}

/**
 * Command DTO for IP filter
 */
export interface IpFilterCommandDTO {
  address: string;
  description: string;
}
