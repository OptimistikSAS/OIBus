import { SouthConnectorDTO } from './south-connector.model';
import { ExternalSourceDTO } from './external-sources.model';

/**
 * DTO for subscriptions
 */
export type SubscriptionDTO = string;
export type ExternalSubscriptionDTO = string;

export interface OIBusSubscription {
  type: 'south' | 'external-source';
  externalSubscription?: ExternalSourceDTO;
  subscription?: SouthConnectorDTO;
}
