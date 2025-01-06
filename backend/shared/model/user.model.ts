import { BaseEntity, Language, Timezone } from './types';

export interface UserSearchParam {
  login?: string;
  page?: number;
}

export interface UserLight {
  id: string;
  login: string;
  friendlyName: string;
}

export interface UserDTO extends BaseEntity {
  login: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  language: Language;
  timezone: Timezone;
  friendlyName: string;
}

export interface UserCommandDTO {
  login: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  language: Language;
  timezone: Timezone;
}

export interface ChangePasswordCommand {
  currentPassword: string;
  newPassword: string;
}
