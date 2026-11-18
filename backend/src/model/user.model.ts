import { BaseEntity } from './types';

export interface User extends BaseEntity {
  login: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  language: string;
  timezone: string;
  /** Set on the default account while it has the default password, cleared once the password is changed. */
  mustChangePassword: boolean;
}

/** What the user repository persists when creating or updating a user (the password is handled separately). */
export type UserCommand = Omit<User, keyof BaseEntity | 'mustChangePassword'>;
