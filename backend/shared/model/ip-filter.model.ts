import { BaseEntity } from './types';

/**
 * Data Transfer Object for an IP filter.
 * Represents a configured IP filter with its address and description.
 */
export interface IPFilterDTO extends BaseEntity {
  /**
   * A regex pattern matched against the remote client's IP address.
   * A plain IP address (e.g. `192.168.1.1`) is treated as a literal pattern.
   * Use `*` to allow all addresses, or a regex prefix like `192\.168\.` to allow an entire subnet.
   * Both IPv4 and IPv6 addresses (including IPv4-mapped IPv6) are supported.
   * @example "192\\.168\\.1\\..*"
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
 */
export interface IPFilterCommandDTO {
  /**
   * A regex pattern matched against the remote client's IP address.
   * A plain IP address (e.g. `192.168.1.1`) is treated as a literal pattern.
   * Use `*` to allow all addresses, or a regex prefix like `192\.168\.` to allow an entire subnet.
   * Both IPv4 and IPv6 addresses (including IPv4-mapped IPv6) are supported.
   * @example "192\\.168\\.1\\..*"
   */
  address: string;

  /**
   * A description of the purpose or reason for this IP filter.
   * @example "Allow traffic from the local admin workstation"
   */
  description: string;
}
