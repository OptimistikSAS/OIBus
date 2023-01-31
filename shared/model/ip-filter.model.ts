/**
 * DTO for IP filters
 */
export interface IpFilterDTO {
  id: string;
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
