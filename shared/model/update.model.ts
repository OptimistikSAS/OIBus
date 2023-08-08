/**
 * DTO for update check
 */
export interface OibusUpdateDTO {
  hasAvailableUpdate: boolean;
  actualVersion: string;
  latestVersion: string;
  changelog: string | null;
}

export interface OibusUpdateCheckResponse {
  latestVersion: string;
  changelog: string | null;
}
