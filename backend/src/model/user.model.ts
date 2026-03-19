import { BaseEntity } from './types';

export interface User extends BaseEntity {
  login: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  language: string;
  timezone: string;
}
