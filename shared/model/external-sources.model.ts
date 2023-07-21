import { BaseEntity } from './types';

/**
 * DTO for external sources
 * An external source is a remote data source that send data to OIBus directly to its API
 */
export interface ExternalSourceDTO extends BaseEntity {
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
