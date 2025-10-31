export type Instant = string;

export interface BaseEntity {
  id: string;
}

export type BaseFolders = Record<'archive' | 'error' | 'cache', string>;

export class NotFoundError extends Error {}
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
  }
}
