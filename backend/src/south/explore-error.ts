import { SouthExploreErrorKind } from '../../shared/model/domain/south-connector.model';

import { OIBusExploreError } from '../model/types';
import { getErrorMessage } from '../service/utils';

/**
 * The error codes of a data source reached, whose user may not list what it holds: file system (folder scanner),
 * PostgreSQL (SQLSTATE `insufficient_privilege`), MySQL, Oracle and SQLite.
 */
const PERMISSION_CODES = new Set([
  'EACCES',
  'EPERM',
  '42501',
  'ER_TABLEACCESS_DENIED_ERROR',
  'ER_COLUMNACCESS_DENIED_ERROR',
  'ER_SPECIFIC_ACCESS_DENIED_ERROR',
  'ORA-01031',
  'SQLITE_PERM',
  'SQLITE_AUTH'
]);

/**
 * The numbers of the MSSQL errors of a user that may not read the system tables listing the tables of a database:
 * permission denied on an object (229) or a column (230), in the database (262), on the server (297, 300), and no access
 * to the database under the current security context (916).
 */
const MSSQL_PERMISSION_NUMBERS = new Set([229, 230, 262, 297, 300, 916]);

/**
 * The error codes of a data source that could not be reached: network, MSSQL connection errors, PostgreSQL authentication
 * and missing database, MySQL access and missing database, Oracle and its driver, SQLite file and missing folder.
 */
const CONNECTION_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'EAI_AGAIN',
  'ENOENT',
  'ENOTDIR',
  'ESOCKET',
  'ETIMEOUT',
  'ELOGIN',
  'EINSTLOOKUP',
  'ECONNCLOSED',
  '28P01',
  '28000',
  '3D000',
  'ER_ACCESS_DENIED_ERROR',
  'ER_DBACCESS_DENIED_ERROR',
  'ER_BAD_DB_ERROR',
  'PROTOCOL_CONNECTION_LOST',
  'ORA-01017',
  'ORA-12154',
  'ORA-12170',
  'ORA-12514',
  'ORA-12541',
  'NJS-500',
  'NJS-501',
  'NJS-503',
  'NJS-510',
  'NJS-515',
  'NJS-518',
  'SQLITE_CANTOPEN',
  'SQLITE_NOTADB'
]);

interface DriverError {
  code?: unknown;
  number?: unknown;
  cause?: unknown;
  originalError?: unknown;
}

/**
 * Why a data source could not be explored, told from the error its driver raised (or the one it wraps): `permission`
 * when it was reached but its user may not list what it holds, `connection` when it could not be reached - null when
 * it can't be told.
 */
export function exploreErrorKind(error: unknown): SouthExploreErrorKind | null {
  for (let current = error, depth = 0; current && typeof current === 'object' && depth < 5; depth++) {
    const { code, number, cause, originalError } = current as DriverError;
    if (typeof code === 'string' && PERMISSION_CODES.has(code)) {
      return 'permission';
    }
    if (code === 'EREQUEST' && typeof number === 'number' && MSSQL_PERMISSION_NUMBERS.has(number)) {
      return 'permission';
    }
    if (typeof code === 'string' && CONNECTION_CODES.has(code)) {
      return 'connection';
    }
    current = originalError ?? cause;
  }
  return null;
}

/**
 * The error of an explore that failed, with why (see `exploreErrorKind()`) - `fallback` when the driver doesn't tell, e.g.
 * `connection` when connecting failed.
 */
export function toExploreError(error: unknown, fallback: SouthExploreErrorKind | null = null): OIBusExploreError {
  if (error instanceof OIBusExploreError) {
    return error;
  }
  return new OIBusExploreError(getErrorMessage(error), exploreErrorKind(error) ?? fallback);
}
