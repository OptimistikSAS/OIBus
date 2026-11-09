import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { TranslateDirective } from '@ngx-translate/core';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { provideI18nTesting } from '../../i18n/mock-i18n';
import { KEYBOARD_RESIZE_STEP, MIN_COLUMN_WIDTH, ResizableColumnsDirective } from './resizable-columns.directive';

// the global styles are not loaded in the specs: the table and its fixed columns are sized by the host
@Component({
  template: `
    <div class="table-host">
      <table [oibResizableColumns]="storageKey()">
        <thead>
          <tr>
            <th class="status-column"></th>
            <th translate="common.yes"></th>
            <th>Type</th>
            @if (showDescription()) {
              <th>Description</th>
            }
            <th class="oib-actions-column-2"></th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td></td>
            <td>name</td>
            <td>type</td>
            @if (showDescription()) {
              <td>description</td>
            }
            <td></td>
          </tr>
        </tbody>
      </table>
    </div>
  `,
  styles: `
    .table-host {
      width: 800px;
    }
    table {
      width: 100%;
      table-layout: fixed;
      border-spacing: 0;
    }
    th {
      padding: 0;
    }
    .status-column,
    .oib-actions-column-2 {
      width: 50px;
    }
  `,
  imports: [ResizableColumnsDirective, TranslateDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestComponent {
  readonly storageKey = signal('test-table');
  readonly showDescription = signal(true);
}

class ResizableColumnsTester {
  readonly fixture = TestBed.createComponent(TestComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly handles = this.root.getByRole('separator', { name: 'Resize column' });

  get headers(): Array<HTMLTableCellElement> {
    return Array.from((this.fixture.nativeElement as HTMLElement).querySelectorAll('th'));
  }

  widths(): Array<number> {
    return this.headers.map(header => Math.round(header.getBoundingClientRect().width));
  }

  handle(index: number): HTMLElement {
    return this.handles.nth(index).element() as HTMLElement;
  }

  drag(index: number, delta: number) {
    const handle = this.handle(index);
    const start = handle.getBoundingClientRect().left;
    handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: start }));
    document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: start + delta }));
    document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: start + delta }));
  }
}

const STORAGE_KEY = 'oibus.column-widths.test-table';

describe('ResizableColumnsDirective', () => {
  let tester: ResizableColumnsTester;

  beforeEach(async () => {
    localStorage.removeItem(STORAGE_KEY);
    TestBed.configureTestingModule({ providers: [provideI18nTesting()] });
    tester = new ResizableColumnsTester();
    await tester.fixture.whenStable();
  });

  afterEach(() => localStorage.removeItem(STORAGE_KEY));

  test('should add a handle between the resizable columns only', async () => {
    // not on the status nor the actions columns, nor on the last resizable column (the actions are on its right)
    await expect.poll(() => tester.handles.elements().length).toBe(2);
    expect(tester.headers[1].querySelector('.oib-column-resizer')).not.toBeNull();
    expect(tester.headers[2].querySelector('.oib-column-resizer')).not.toBeNull();
    expect(tester.headers[3].querySelector('.oib-column-resizer')).toBeNull();
    // the translated header keeps its handle
    expect(tester.headers[1].textContent).toBe('Yes');
    expect(tester.widths()).toEqual([50, 233, 233, 233, 50]);
  });

  test('should resize a column with a drag, taking the width of the next column', async () => {
    await expect.poll(() => tester.handles.elements().length).toBe(2);

    tester.drag(0, 100);

    expect(tester.widths()).toEqual([50, 333, 133, 233, 50]);
    expect(document.body.classList).not.toContain('oib-column-resizing');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).map((share: number) => Math.round(share * 700))).toEqual([333, 133, 233]);
  });

  test('should take the width of the further columns once the next one is at its minimum width', async () => {
    await expect.poll(() => tester.handles.elements().length).toBe(2);

    tester.drag(0, 300);

    const third = 700 / 3;
    expect(tester.widths()).toEqual([50, 533, MIN_COLUMN_WIDTH, Math.round(third - (300 - (third - MIN_COLUMN_WIDTH))), 50]);
  });

  test('should not shrink a column under its minimum width', async () => {
    await expect.poll(() => tester.handles.elements().length).toBe(2);

    tester.drag(1, -400);

    expect(tester.widths()).toEqual([50, 233, MIN_COLUMN_WIDTH, Math.round((2 * 700) / 3 - MIN_COLUMN_WIDTH), 50]);
  });

  test('should resize a column with the arrow keys', async () => {
    await expect.poll(() => tester.handles.elements().length).toBe(2);

    tester.handle(0).focus();
    await expect.element(tester.handles.nth(0)).toHaveFocus();
    tester.handle(0).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(tester.widths()).toEqual([50, 233 + KEYBOARD_RESIZE_STEP, 233 - KEYBOARD_RESIZE_STEP, 233, 50]);
    await expect.element(tester.handles.nth(0)).toHaveAttribute('aria-valuenow', '36');

    tester.handle(1).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(tester.widths()).toEqual([50, 233 + KEYBOARD_RESIZE_STEP, 233 - 2 * KEYBOARD_RESIZE_STEP, 233 + KEYBOARD_RESIZE_STEP, 50]);

    tester.handle(1).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(tester.widths()).toEqual([50, 233 + KEYBOARD_RESIZE_STEP, 233 - 2 * KEYBOARD_RESIZE_STEP, 233 + KEYBOARD_RESIZE_STEP, 50]);
  });

  test('should restore the default widths on a double click', async () => {
    await expect.poll(() => tester.handles.elements().length).toBe(2);
    tester.drag(0, 100);

    tester.handle(0).dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

    expect(tester.widths()).toEqual([50, 233, 233, 233, 50]);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  test('should keep the shares of the columns when the table is resized', async () => {
    await expect.poll(() => tester.handles.elements().length).toBe(2);
    tester.drag(0, 100);

    (tester.fixture.nativeElement.querySelector('div') as HTMLElement).style.width = '1500px';

    // the shares stay those of the drag: 1/3 + 100 px, 1/3 - 100 px and 1/3 of 700 px
    await expect.poll(() => tester.widths()).toEqual([50, 667, 267, 467, 50]);
  });

  test('should restore the remembered widths', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([0.5, 0.25, 0.25]));
    const otherTester = new ResizableColumnsTester();
    await otherTester.fixture.whenStable();

    await expect.poll(() => otherTester.widths()).toEqual([50, 350, 175, 175, 50]);
  });

  test('should ignore remembered widths that do not match the columns', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([0.5, 0.5]));
    const otherTester = new ResizableColumnsTester();
    await otherTester.fixture.whenStable();

    await expect.poll(() => otherTester.handles.elements().length).toBe(2);
    expect(otherTester.widths()).toEqual([50, 233, 233, 233, 50]);
  });

  test('should reset the widths when the columns change', async () => {
    await expect.poll(() => tester.handles.elements().length).toBe(2);
    tester.drag(0, 100);

    tester.fixture.componentInstance.showDescription.set(false);

    // the type column is now the last resizable one: it loses its handle
    await expect.poll(() => tester.handles.elements().length).toBe(1);
    expect(tester.widths()).toEqual([50, 350, 350, 50]);
  });

  test('should not remember the widths without a key', async () => {
    tester.fixture.componentInstance.storageKey.set('');
    await tester.fixture.whenStable();
    await expect.poll(() => tester.handles.elements().length).toBe(2);

    tester.drag(0, 100);

    expect(tester.widths()).toEqual([50, 333, 133, 233, 50]);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
