import { BaseEntity } from './types';
import { IPFilterDTO } from '../../../shared/model/ip-filter.model';

export interface IPFilter extends BaseEntity {
  address: string;
  description: string;
}

export interface IPFilterCommand {
  address: string;
  description: string;
}

export const toIPFilterDTO = (ipFilter: IPFilter): IPFilterDTO => {
  return {
    id: ipFilter.id,
    address: ipFilter.address,
    description: ipFilter.description
  };
};
