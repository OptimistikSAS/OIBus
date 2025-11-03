export type Instant = string;

export interface BaseEntity {
  id: string;
}

export type BaseFolders = Record<'archive' | 'error' | 'cache', string>;

export class NotFoundError extends Error {}
export class OIBusValidationError extends Error {}
export class OIBusTestingError extends Error {}
