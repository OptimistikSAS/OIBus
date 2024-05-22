import { SouthConnectorDTO } from './south-connector.model';

/**
 * DTO for subscriptions
 */
export type SubscriptionDTO = string;

export interface OIBusSubscription {
  type: 'south';
  subscription: SouthConnectorDTO;
}
