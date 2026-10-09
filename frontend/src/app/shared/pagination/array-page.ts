import { Page } from '@oibus/shared/common/types';

/**
 * An immutable Page implementation backed by an array.
 * Changing the page creates a new page, so that a component displaying it (e.g. an OnPush `oib-pagination`) is refreshed.
 */
export class ArrayPage<T> implements Page<T> {
  readonly content: Array<T>;
  readonly totalElements: number;
  readonly totalPages: number;

  constructor(
    private readonly array: Array<T>,
    readonly size: number,
    readonly number = 0
  ) {
    this.content = array.slice(number * size, Math.min(array.length, (number + 1) * size));
    this.totalElements = array.length;
    this.totalPages = Math.ceil(array.length / size);
  }

  /**
   * Returns the page of the given number, backed by the same array.
   */
  gotoPage(pageNumber: number): ArrayPage<T> {
    return pageNumber === this.number ? this : new ArrayPage(this.array, this.size, pageNumber);
  }
}
