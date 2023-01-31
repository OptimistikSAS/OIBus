/**
 * DTO for external sources
 * An external source is a remote data source that send data to OIBus directly to its API
 */
export interface ExternalSourceDTO {
  id: string;
  reference: string;
  description: string;
}

/**
 * Command DTO for external sources
 */
export interface ExternalSourceCommandDTO {
  reference: string;
  description: string;
}
