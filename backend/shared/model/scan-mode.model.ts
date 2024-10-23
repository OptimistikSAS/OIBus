import { BaseEntity, Instant } from './types';

/**
 * DTO for scan modes
 */
export interface ScanModeDTO extends BaseEntity {
  name: string;
  description: string;
  cron: string;
}

/**
 * Command DTO for scan modes
 */
export interface ScanModeCommandDTO {
  name: string;
  description: string;
  cron: string;
}

export interface ValidatedCronExpression {
  nextExecutions: Array<Instant>;
  humanReadableForm: string;
}
