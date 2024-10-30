export type Instant = string;

export interface BaseEntity {
  id: string;
}

export type BaseFolders = Record<'archive' | 'error' | 'cache', string>;
