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
 * Minimum length of a user password. Following NIST SP 800-63B, the policy only sets a minimum and a (long) maximum length,
 * without any composition rule.
 */
export const PASSWORD_MIN_LENGTH = 8;

/**
 * Maximum length of a user password.
 */
export const PASSWORD_MAX_LENGTH = 128;
