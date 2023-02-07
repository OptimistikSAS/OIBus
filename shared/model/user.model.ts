import { Language, Timezone } from './types';

export interface UserSearchParam {
  login: string | null;
  page: number;
}

export interface UserLight {
  id: string;
  login: string;
  friendlyName: string;
}

export interface UserCommandDTO {
  login: string;
  password?: string;
  firstName: string;
  lastName: string;
  email: string;
  language: Language;
  timezone: Timezone;
}

export interface User {
  id: string;
  login: string;
  password?: string;
  firstName: string;
  lastName: string;
  email: string;
  language: Language;
  timezone: Timezone;
  friendlyName: string;
}
