import { BaseEntity, Language, Timezone } from '../../shared/model/types';

export interface User extends BaseEntity {
  login: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  language: Language;
  timezone: Timezone;
}
