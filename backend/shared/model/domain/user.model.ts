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
