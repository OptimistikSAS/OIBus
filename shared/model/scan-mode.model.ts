/**
 * DTO for scan modes
 */
export interface ScanModeDTO {
  id: string;
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
