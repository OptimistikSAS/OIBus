import { afterNextRender, DestroyRef, Directive, ElementRef, inject, input } from '@angular/core';

import { TranslateService } from '@ngx-translate/core';

/** Header cells whose width is fixed by the design: the row actions, the statuses, and any column opting out. */
const FIXED_COLUMNS = '[class*="oib-actions-column"], .status-column, .oib-fixed-column';
/** Narrowest width a column can be resized to, in pixels. */
export const MIN_COLUMN_WIDTH = 48;
/** Width change of one arrow key press on a resize handle, in pixels. */
export const KEYBOARD_RESIZE_STEP = 16;
const STORAGE_KEY_PREFIX = 'oibus.column-widths.';

/**
 * Lets the user resize the columns of a table by dragging the right border of their header (or with the arrow keys once
 * it has the focus); a double click on a border restores the default widths.
 *
 * Moving a border only changes the two sides of it: the column on its left, and the columns on its right, the nearest one
 * first, so that the table keeps the width of its container. The row actions and status columns keep their width (as any
 * header with the `oib-fixed-column` class).
 *
 * The widths are kept as shares of the space of the resizable columns, so they follow the size of the window. Give a key
 * to remember them in the browser: `<table class="table oib-table" oibResizableColumns="south-list">`.
 */
@Directive({
  selector: 'table[oibResizableColumns]',
  host: { class: 'oib-resizable-columns' }
})
export class ResizableColumnsDirective {
  private readonly table: HTMLTableElement = inject(ElementRef).nativeElement;
  private readonly translateService = inject(TranslateService);

  /** Key under which the widths are remembered in the browser; empty to forget them when the table is destroyed. */
  readonly storageKey = input('', { alias: 'oibResizableColumns' });

  /** The header cells the widths apply to: they are reset when the columns change. */
  private headers: Array<HTMLTableCellElement> = [];
  /** Widths of the resizable columns, as shares of their space; null for the default widths. */
  private shares: Array<number> | null = null;
  private containerWidth = 0;

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      this.synchronize();
      // headers can be added or removed by the template, and their content rewritten (removing the handles), by the
      // translate directive for instance
      const mutationObserver = new MutationObserver(() => this.synchronize());
      mutationObserver.observe(this.table.tHead ?? this.table, { childList: true, subtree: true });
      const resizeObserver = new ResizeObserver(() => this.onContainerResize());
      resizeObserver.observe(this.table.parentElement ?? this.table);
      destroyRef.onDestroy(() => {
        mutationObserver.disconnect();
        resizeObserver.disconnect();
      });
    });
  }

  private synchronize() {
    const headers = Array.from(this.table.tHead?.rows[0]?.cells ?? []);
    if (headers.length !== this.headers.length || headers.some((header, index) => header !== this.headers[index])) {
      this.headers = headers;
      this.shares = this.restoreShares();
      this.applyShares();
    }
    const resizable = this.resizableHeaders();
    resizable.forEach((header, index) => {
      // the last resizable column has no resizable column on its right to give or take its width
      const handle = header.querySelector<HTMLElement>(':scope > .oib-column-resizer');
      if (index === resizable.length - 1) {
        handle?.remove();
      } else if (!handle) {
        header.append(this.createHandle(header));
      }
    });
    this.updateHandleValues();
  }

  private resizableHeaders(): Array<HTMLTableCellElement> {
    return this.headers.filter(header => !header.matches(FIXED_COLUMNS));
  }

  private createHandle(header: HTMLTableCellElement): HTMLElement {
    const handle = document.createElement('span');
    handle.className = 'oib-column-resizer';
    handle.tabIndex = 0;
    handle.setAttribute('role', 'separator');
    handle.setAttribute('aria-orientation', 'vertical');
    handle.setAttribute('aria-valuemin', '0');
    handle.setAttribute('aria-valuemax', '100');
    handle.setAttribute('aria-label', this.translateService.instant('common.resize-column'));
    handle.addEventListener('pointerdown', event => this.startDrag(event, header, handle));
    handle.addEventListener('keydown', event => this.onKeydown(event, header));
    handle.addEventListener('dblclick', () => this.reset());
    // a click on the border must not reach the header (sorting)
    handle.addEventListener('click', event => event.stopPropagation());
    return handle;
  }

  private startDrag(event: PointerEvent, header: HTMLTableCellElement, handle: HTMLElement) {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    handle.focus();
    const startX = event.clientX;
    const startWidths = this.currentWidths();
    const index = this.resizableHeaders().indexOf(header);
    const ownerDocument = this.table.ownerDocument;
    ownerDocument.body.classList.add('oib-column-resizing');
    handle.classList.add('active');

    const onMove = (moveEvent: PointerEvent) => this.applyWidths(this.resize(startWidths, index, moveEvent.clientX - startX));
    const onEnd = () => {
      ownerDocument.removeEventListener('pointermove', onMove);
      ownerDocument.removeEventListener('pointerup', onEnd);
      ownerDocument.removeEventListener('pointercancel', onEnd);
      ownerDocument.body.classList.remove('oib-column-resizing');
      handle.classList.remove('active');
      this.saveShares();
    };
    ownerDocument.addEventListener('pointermove', onMove);
    ownerDocument.addEventListener('pointerup', onEnd);
    ownerDocument.addEventListener('pointercancel', onEnd);
  }

  private onKeydown(event: KeyboardEvent, header: HTMLTableCellElement) {
    const delta = { ArrowLeft: -KEYBOARD_RESIZE_STEP, ArrowRight: KEYBOARD_RESIZE_STEP }[event.key];
    if (delta === undefined) {
      return;
    }
    event.preventDefault();
    this.applyWidths(this.resize(this.currentWidths(), this.resizableHeaders().indexOf(header), delta));
    this.saveShares();
  }

  /**
   * Moves the right border of the column `index` by `delta` pixels: the column takes (or gives) the width of the columns
   * on its right, the nearest one first, none going under the minimum width.
   */
  private resize(widths: Array<number>, index: number, delta: number): Array<number> {
    const result = [...widths];
    if (delta < 0) {
      const shrink = Math.min(-delta, Math.max(0, result[index] - MIN_COLUMN_WIDTH));
      result[index] -= shrink;
      result[index + 1] += shrink;
      return result;
    }
    let remaining = delta;
    for (let next = index + 1; next < result.length && remaining > 0; next++) {
      const taken = Math.min(remaining, Math.max(0, result[next] - MIN_COLUMN_WIDTH));
      result[next] -= taken;
      remaining -= taken;
    }
    result[index] += delta - remaining;
    return result;
  }

  private currentWidths(): Array<number> {
    return this.resizableHeaders().map(header => header.getBoundingClientRect().width);
  }

  private applyWidths(widths: Array<number>) {
    const total = widths.reduce((sum, width) => sum + width, 0);
    this.shares = total > 0 ? widths.map(width => width / total) : null;
    this.resizableHeaders().forEach((header, index) => (header.style.width = `${widths[index]}px`));
    this.updateHandleValues();
  }

  /** Sizes the resizable columns from their shares of the space left by the fixed ones. */
  private applyShares() {
    const resizable = this.resizableHeaders();
    resizable.forEach(header => (header.style.width = ''));
    const shares = this.shares;
    if (!shares) {
      return;
    }
    // without explicit widths, the resizable columns fill the space the fixed ones leave
    const space = this.currentWidths().reduce((sum, width) => sum + width, 0);
    if (space > 0) {
      resizable.forEach((header, index) => (header.style.width = `${shares[index] * space}px`));
    }
  }

  private onContainerResize() {
    const width = (this.table.parentElement ?? this.table).getBoundingClientRect().width;
    if (width !== this.containerWidth) {
      this.containerWidth = width;
      this.applyShares();
      this.updateHandleValues();
    }
  }

  private reset() {
    this.shares = null;
    this.applyShares();
    this.updateHandleValues();
    this.saveShares();
  }

  /** The value of a handle is the share of its column, in percent. */
  private updateHandleValues() {
    const widths = this.currentWidths();
    const total = widths.reduce((sum, width) => sum + width, 0);
    this.resizableHeaders().forEach((header, index) => {
      const value = total > 0 ? Math.round((widths[index] / total) * 100) : 0;
      header.querySelector(':scope > .oib-column-resizer')?.setAttribute('aria-valuenow', `${value}`);
    });
  }

  private restoreShares(): Array<number> | null {
    if (!this.storageKey()) {
      return null;
    }
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY_PREFIX + this.storageKey()) ?? 'null');
      const count = this.resizableHeaders().length;
      if (Array.isArray(stored) && stored.length === count && stored.every(share => typeof share === 'number' && share > 0)) {
        return stored;
      }
    } catch {
      // unreadable or unavailable storage: default widths
    }
    return null;
  }

  private saveShares() {
    if (!this.storageKey()) {
      return;
    }
    try {
      const key = STORAGE_KEY_PREFIX + this.storageKey();
      if (this.shares) {
        localStorage.setItem(key, JSON.stringify(this.shares));
      } else {
        localStorage.removeItem(key);
      }
    } catch {
      // unavailable storage: the widths are kept until the table is destroyed
    }
  }
}
