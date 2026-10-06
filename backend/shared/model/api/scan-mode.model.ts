import { BaseEntity, Instant } from '../common/types';
import { ActivationWindow, ScanModeInterval, ScanModeType } from '../domain/scan-mode.model';

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
   * Which scheduling mechanism drives this scan mode.
   * @example "cron"
   */
  type: ScanModeType;

  /**
   * A cron expression defining the scan schedule. Empty when `type` is `"interval"`.
   * @example "0 0 * * *"
   */
  cron: string;

  /**
   * The fixed period between two ticks. `null` when `type` is `"cron"`.
   */
  interval: ScanModeInterval | null;

  /**
   * Optional activation window gating every tick. `null` means always active.
   */
  activationWindow: ActivationWindow | null;

  /**
   * Whether the activation window can never trigger again (for instance its end date is already
   * past). Computed server-side; drives a non-blocking warning in the UI.
   * @example false
   */
  activationWindowExpired: boolean;
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
   * Which scheduling mechanism drives this scan mode.
   * @example "cron"
   */
  type: ScanModeType;

  /**
   * A cron expression defining the scan schedule. Ignored when `type` is `"interval"`.
   * @example "0 0 * * *"
   */
  cron: string;

  /**
   * The fixed period between two ticks. Required when `type` is `"interval"`.
   */
  interval: ScanModeInterval | null;

  /**
   * Optional activation window gating every tick. `null` means always active.
   */
  activationWindow: ActivationWindow | null;
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
   * The next 3 execution times for the cron expression.
   * Empty array if the expression is invalid.
   * @example ["2024-01-01T00:00:00.000Z", "2024-01-02T00:00:00.000Z", "2024-01-03T00:00:00.000Z"]
   */
  nextExecutions: Array<Instant>;

  /**
   * A human-readable description of the cron expression.
   * @example "At 00:00 every day"
   */
  humanReadableForm: string;
}
