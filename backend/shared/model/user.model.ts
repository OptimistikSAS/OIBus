import { BaseEntity, Language, Timezone } from './types';

/**
 * Parameters for searching users.
 * Used to query users based on login and pagination.
 */
export interface UserSearchParam {
  /**
   * The login username of the user to search for.
   * Can be `undefined` to search for all users.
   * @example "john.doe"
   */
  login: string | undefined;

  /**
   * The page number for paginated results.
   * @example 1
   */
  page: number;
}

/**
 * Data Transfer Object for a user.
 * Represents a user with their personal information, login credentials, preferences, and display name.
 */
export interface UserDTO extends BaseEntity {
  /**
   * The login username of the user.
   * @example "john.doe"
   */
  login: string;

  /**
   * The first name of the user.
   * Can be `null` if not provided.
   * @example "John"
   */
  firstName: string | null;

  /**
   * The last name of the user.
   * Can be `null` if not provided.
   * @example "Doe"
   */
  lastName: string | null;

  /**
   * The email address of the user.
   * Can be `null` if not provided.
   * @example "john.doe@example.com"
   */
  email: string | null;

  /**
   * The preferred language of the user.
   * @example "en"
   */
  language: Language;

  /**
   * The preferred timezone of the user.
   * @example "Europe/Paris"
   */
  timezone: Timezone;

  /**
   * The friendly display name of the user.
   * @example "John Doe"
   */
  friendlyName: string;
}

/**
 * Command Data Transfer Object for creating or updating a user.
 * Used as the request body for user creation/update endpoints.
 */
export interface UserCommandDTO {
  /**
   * The login username of the user.
   * @example "john.doe"
   */
  login: string;

  /**
   * The first name of the user.
   * Can be `null` if not provided.
   * @example "John"
   */
  firstName: string | null;

  /**
   * The last name of the user.
   * Can be `null` if not provided.
   * @example "Doe"
   */
  lastName: string | null;

  /**
   * The email address of the user.
   * Can be `null` if not provided.
   * @example "john.doe@example.com"
   */
  email: string | null;

  /**
   * The preferred language of the user.
   * @example "en"
   */
  language: Language;

  /**
   * The preferred timezone of the user.
   * @example "Europe/Paris"
   */
  timezone: Timezone;
}

/**
 * Command for changing a user's password.
 * Used as the request body for password change endpoints.
 */
export interface ChangePasswordCommand {
  /**
   * The current password of the user.
   * @example "oldPassword123"
   */
  currentPassword: string;

  /**
   * The new password for the user.
   * @example "newSecurePassword456"
   */
  newPassword: string;
}
