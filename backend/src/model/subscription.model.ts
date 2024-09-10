import { SubscriptionDTO } from '../../../shared/model/subscription.model';

export interface Subscription {
  south: {
    id: string;
    type: string;
    name: string;
  };
}

export const toSubscriptionDTO = (subscription: Subscription): SubscriptionDTO => {
  return {
    southId: subscription.south.id,
    southType: subscription.south.type,
    southName: subscription.south.name
  };
};
