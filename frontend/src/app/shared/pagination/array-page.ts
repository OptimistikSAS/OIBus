/**
 * A Page implementation backed by an array.
 */
import { Page } from '../../../../../shared/model/types';

export class ArrayPage<T> implements Page<T> {
  private _content: Array<T> = [];
  private _number: number | null = null;
  private _totalPages: number;

  constructor(private array: Array<T>, public readonly size: number) {
    this._totalPages = Math.ceil(array.length / size);
    this.gotoPage(0);
  }

  get content(): Array<T> {
    return this._content;
  }

  get totalElements(): number {
    return this.array.length;
  }

  get number() {
    return this._number as number;
  }

  get totalPages(): number {
    return this._totalPages;
  }

  gotoPage(pageNumber: number) {
    if (this._number !== pageNumber) {
      this._number = pageNumber;
      this._content = this.array.slice(pageNumber * this.size, Math.min(this.array.length, (pageNumber + 1) * this.size));
    }
  }
}
