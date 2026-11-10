import { SouthExploreErrorKind } from '../../shared/model/domain/south-connector.model';

export type Instant = string;

export interface BaseEntity {
  id: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export type BaseFolders = Record<'archive' | 'error' | 'cache', string>;

export class NotFoundError extends Error {}
export class OIBusValidationError extends Error {}
export class OIBusTestingError extends Error {}

/** A data source could not be explored, with why when it can be told (see `exploreErrorKind()`) */
export class OIBusExploreError extends OIBusTestingError {
  constructor(
    message: string,
    readonly kind: SouthExploreErrorKind | null
  ) {
    super(message);
  }
}
