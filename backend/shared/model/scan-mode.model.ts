import { BaseEntity, Instant } from './types';

/**
 * Data Transfer Object for a scan mode.
 * Represents a configured scan mode with its metadata and schedule.
 */
export interface ScanModeDTO extends BaseEntity {
  /**
   * The name of the scan mode.
   * @example "Daily Backup Scan"
   */
  name: string;

  /**
   * A description of the scan mode's purpose or behavior.
   * @example "Scans for new backup data every day at midnight"
   */
  description: string;

  /**
   * A cron expression defining the scan schedule.
   * @example "0 0 * * *"
   */
  cron: string;
}

/**
 * Command DTO for creating or updating a scan mode.
 * Used as the request body for scan mode creation/update endpoints.
 */
export interface ScanModeCommandDTO {
  /**
   * The name of the scan mode.
   * @example "Daily Backup Scan"
   */
  name: string;

  /**
   * A description of the scan mode's purpose or behavior.
   * @example "Scans for new backup data every day at midnight"
   */
  description: string;

  /**
   * A cron expression defining the scan schedule.
   * @example "0 0 * * *"
   */
  cron: string;
}

/**
 * Result of validating a cron expression.
 * Includes validation status, error messages, and execution details.
 */
export interface ValidatedCronExpression {
  /**
   * Whether the cron expression is valid.
   * @example true
   */
  isValid: boolean;

  /**
   * Error message if the cron expression is invalid.
   * Empty string if the expression is valid.
   * @example ""
   */
  errorMessage: string;

  /**
   * The next 5 execution times for the cron expression.
   * Empty if the expression is invalid.
   * @example ["2023-01-01T00:00:00Z", "2023-01-02T00:00:00Z", "2023-01-03T00:00:00Z", "2023-01-04T00:00:00Z", "2023-01-05T00:00:00Z"]
   */
  nextExecutions: Array<Instant>;

  /**
   * A human-readable description of the cron expression.
   * @example "At 00:00 every day"
   */
  humanReadableForm: string;
}
