import { TestBed } from '@angular/core/testing';

import { EditorView } from '@codemirror/view';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { OIBusContent, OIBusTimeValue, OIBusTimeValueContent } from '@oibus/shared/common/content.model';

import { provideI18nTesting } from '../../../../../i18n/mock-i18n';
import { ContentDisplayMode, ItemTestResultComponent } from './item-test-result.component';

class ItemTestResultComponentTester {
  readonly fixture = TestBed.createComponent(ItemTestResultComponent);
  readonly component = this.fixture.componentInstance;
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly spinner = this.root.getByCss('oib-loading-spinner');
  readonly message = this.root.getByCss('#message-container');
  readonly table = this.root.getByCss('#tableView');
  readonly tableHeaders = this.root.getByCss('.grid-table-header > div');
  readonly tableRows = this.root.getByCss('.grid-table-row');
  readonly noValues = this.root.getByText('There are no values to display');
  readonly pagination = this.root.getByCss('oib-pagination');
  readonly editor = this.root.getByCss('.cm-editor');
  readonly progressbar = this.root.getByCss('oib-progressbar');
  readonly availableDisplayModes = vi.fn<(modes: Array<ContentDisplayMode>) => void>();
  readonly currentDisplayMode = vi.fn<(mode: ContentDisplayMode | null) => void>();

  constructor() {
    this.component.availableDisplayModes.subscribe(this.availableDisplayModes);
    this.component.currentDisplayMode.subscribe(this.currentDisplayMode);
  }

  /** The whole document of the code editor (the DOM only contains the visible lines). */
  async editorContent(): Promise<string> {
    await expect.element(this.editor).toBeInTheDocument();
    return EditorView.findFromDOM(this.editor.element() as HTMLElement)!.state.doc.toString();
  }

  /** Displays the current result with another display mode, the way the parent component does. */
  switchTo(mode: ContentDisplayMode) {
    this.component.changeDisplayMode(mode);
    this.component.displayResult();
  }
}

function timeValues(count: number): OIBusTimeValueContent {
  return {
    type: 'time-values',
    content: Array.from({ length: count }, (_, index): OIBusTimeValue => ({
      pointId: `point${index}`,
      timestamp: '2024-01-01T00:00:00.000Z',
      data: { value: `${index}`, quality: 'good' }
    }))
  };
}

describe('ItemTestResultComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideI18nTesting()]
    });
  });

  test('should display an info message', async () => {
    const tester = new ItemTestResultComponentTester();

    tester.component.displayInfo('Test info message');

    await expect.element(tester.message).toHaveTextContent('Test info message');
    await expect.element(tester.message).toHaveClass('alert-primary');
    expect(tester.availableDisplayModes).toHaveBeenCalledWith([]);
    expect(tester.currentDisplayMode).toHaveBeenCalledWith(null);
  });

  test('should display a spinner while loading', async () => {
    const tester = new ItemTestResultComponentTester();

    tester.component.displayLoading();

    await expect.element(tester.spinner).toBeInTheDocument();
    await expect.element(tester.message).not.toBeInTheDocument();
  });

  test('should display an item error and drop the result', async () => {
    const tester = new ItemTestResultComponentTester();
    tester.component.displayResult(timeValues(1));
    await expect.element(tester.table).toBeVisible();

    tester.component.displayError('boom');

    await expect.element(tester.message).toHaveTextContent('Error when testing itemboom');
    await expect.element(tester.message).toHaveClass('alert-danger');
    await expect.element(tester.table).not.toBeInTheDocument();
    expect(tester.availableDisplayModes).toHaveBeenLastCalledWith([]);
    expect(tester.currentDisplayMode).toHaveBeenLastCalledWith(null);
    expect(tester.component.result()).toBeNull();
  });

  test('should display a display error and keep the result', async () => {
    const tester = new ItemTestResultComponentTester();
    tester.component.displayResult(timeValues(1));

    tester.component.displayError('cannot display', 'display-result-error');

    await expect.element(tester.message).toHaveTextContent('Error when displaying item, please try another view modecannot display');
    await expect.element(tester.table).not.toBeInTheDocument();
    expect(tester.currentDisplayMode).toHaveBeenLastCalledWith('table');
    expect(tester.component.result()).toEqual(timeValues(1));
  });

  test('should display time values in a table', async () => {
    const tester = new ItemTestResultComponentTester();

    tester.component.displayResult(timeValues(2));

    await expect.element(tester.tableHeaders).toHaveLength(4);
    await expect.element(tester.tableHeaders.nth(1)).toHaveTextContent('Point Id');
    await expect.element(tester.tableRows).toHaveLength(2);
    await expect.element(tester.tableRows.nth(1)).toMatchTextContent(/2024-01-01T00:00:00.000Zpoint11.*"quality": "good"/);
    await expect.element(tester.pagination).not.toBeVisible();
    expect(tester.availableDisplayModes).toHaveBeenCalledWith(['table', 'json', 'any']);
    expect(tester.currentDisplayMode).toHaveBeenCalledWith('table');
  });

  test('should paginate the table', async () => {
    const tester = new ItemTestResultComponentTester();
    tester.component.displayResult(timeValues(25));
    await expect.element(tester.tableRows).toHaveLength(10);

    await tester.pagination.getByRole('link', { name: '3' }).click();

    await expect.element(tester.tableRows).toHaveLength(5);
    await expect.element(tester.tableRows.nth(0)).toMatchTextContent('point20');
  });

  test('should display a caption when there are no time values', async () => {
    const tester = new ItemTestResultComponentTester();

    tester.component.displayResult(timeValues(0));

    await expect.element(tester.noValues).toBeVisible();
    await expect.element(tester.table).not.toBeInTheDocument();
  });

  test('should display a CSV file in a table', async () => {
    const tester = new ItemTestResultComponentTester();

    tester.component.displayResult({ type: 'any', filePath: 'file.csv', content: 'name,value\nfoo,1\nbar,2' });

    await expect.element(tester.tableHeaders).toHaveLength(2);
    await expect.element(tester.tableHeaders.nth(0)).toHaveTextContent('name');
    await expect.element(tester.tableRows).toHaveLength(2);
    await expect.element(tester.tableRows.nth(1)).toHaveTextContent('bar2');
    expect(tester.availableDisplayModes).toHaveBeenCalledWith(['table', 'any']);
  });

  test('should display a record list in a table', async () => {
    const tester = new ItemTestResultComponentTester();

    tester.component.displayResult({
      type: 'record-list',
      content: [
        { name: 'foo', value: 1 },
        { name: 'bar', value: null }
      ]
    });

    await expect.element(tester.tableHeaders).toHaveLength(2);
    await expect.element(tester.tableRows).toHaveLength(2);
    await expect.element(tester.tableRows.nth(0)).toHaveTextContent('foo1');
    await expect.element(tester.tableRows.nth(1)).toHaveTextContent('bar');
    expect(tester.availableDisplayModes).toHaveBeenCalledWith(['table', 'json']);
  });

  test('should display time values as JSON', async () => {
    const tester = new ItemTestResultComponentTester();
    tester.component.displayResult(timeValues(1));

    tester.switchTo('json');

    await expect.element(tester.table).not.toBeInTheDocument();
    await expect.poll(() => tester.editorContent()).toBe(JSON.stringify(timeValues(1).content, null, 2));
  });

  test('should pretty-print raw content which is JSON', async () => {
    const tester = new ItemTestResultComponentTester();

    tester.component.displayResult({ type: 'any-content', content: '{"a":1}' });

    expect(tester.availableDisplayModes).toHaveBeenCalledWith(['any']);
    await expect.poll(() => tester.editorContent()).toBe('{\n  "a": 1\n}');
  });

  test('should display raw content which is not JSON as is', async () => {
    const tester = new ItemTestResultComponentTester();

    tester.component.displayResult({ type: 'any', filePath: 'file.txt', content: 'plain text' });

    await expect.poll(() => tester.editorContent()).toBe('plain text');
  });

  test('should display a caption when the raw content is empty', async () => {
    const tester = new ItemTestResultComponentTester();

    tester.component.displayResult({ type: 'any-content', content: '' });

    await expect.element(tester.noValues).toBeVisible();
    await expect.element(tester.editor).not.toBeInTheDocument();
  });

  test('should write a large content by chunks', async () => {
    const tester = new ItemTestResultComponentTester();
    const content = 'x'.repeat(250_000);

    tester.component.displayResult({ type: 'any-content', content });

    await expect.poll(() => tester.editorContent()).toHaveLength(250_000);
    await expect.element(tester.progressbar).not.toBeInTheDocument();
  });

  test('should drop stale table mode when a new result no longer supports it', async () => {
    const tester = new ItemTestResultComponentTester();
    tester.component.displayResult(timeValues(1));
    await expect.element(tester.table).toBeVisible();

    const transformed: OIBusContent = { type: 'any-content', content: '[]' };
    tester.component.displayResult(transformed);

    // Transformed any-content result has no table mode -> must switch to 'any', not stay stuck on 'table'.
    expect(tester.currentDisplayMode).toHaveBeenLastCalledWith('any');
    await expect.element(tester.table).not.toBeInTheDocument();
    await expect.poll(() => tester.editorContent()).toBe('[]');
  });
});
