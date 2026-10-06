import { BaseEntity } from './types';

export interface User extends BaseEntity {
  login: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  language: string;
  timezone: string;
}

/** What the user repository persists when creating or updating a user (the password is handled separately). */
export type UserCommand = Omit<User, keyof BaseEntity>;
