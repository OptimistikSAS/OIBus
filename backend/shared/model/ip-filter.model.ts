import { BaseEntity } from './types';

/**
 * Data Transfer Object for an IP filter.
 * Represents a configured IP filter with its address and description.
 *
 * @example
 * {
 *   "id": "aBc12F",
 *   "address": "192.168.1.1",
 *   "description": "Allow traffic from the local admin workstation"
 * }
 */
export interface IPFilterDTO extends BaseEntity {
  /**
   * The IP address or CIDR block to filter.
   * Can be an IPv4 address, IPv6 address, or CIDR notation.
   * @example "192.168.1.1"
   */
  address: string;

  /**
   * A description of the purpose or reason for this IP filter.
   * @example "Allow traffic from the local admin workstation"
   */
  description: string;
}

/**
 * Command DTO for creating or updating an IP filter.
 * Used as the request body for IP filter creation/update endpoints.
 *
 * @example
 * {
 *   "address": "192.168.1.1",
 *   "description": "Allow traffic from the local admin workstation"
 * }
 */
export interface IPFilterCommandDTO {
  /**
   * The IP address or CIDR block to filter.
   * Can be an IPv4 address, IPv6 address, or CIDR notation.
   * @example "192.168.1.1"
   */
  address: string;

  /**
   * A description of the purpose or reason for this IP filter.
   * @example "Allow traffic from the local admin workstation"
   */
  description: string;
}
