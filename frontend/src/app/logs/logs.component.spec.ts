import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { DateTime } from 'luxon';
import { NEVER, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { LogDTO } from '@oibus/shared/api/logs.model';
import { Page } from '@oibus/shared/common/types';
import { Group, Item, LogLevel, LogSearchParam, Scope, ScopeType } from '@oibus/shared/domain/logs.model';

import { provideI18nTesting } from '../../i18n/mock-i18n';
import { createMock, MockObject } from '../../test/vitest-create-mock';
import { LogService } from '../services/log.service';
import { DefaultValidationErrorsComponent } from '../shared/default-validation-errors/default-validation-errors.component';
import { provideNgbConfigTesting } from '../shared/form/oi-ngb-testing';
import { emptyPage, toPage } from '../shared/utils/page.utils';
import { LogsComponent } from './logs.component';

class LogsComponentTester {
  readonly fixture = TestBed.createComponent(LogsComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly title = this.root.getByRole('heading', { level: 1 });
  readonly searchAreaToggle = this.root.getByCss('.accordion-button');
  readonly form = this.root.getByCss('form');
  readonly searchButton = this.form.getByRole('button', { name: 'Search', exact: true });
  readonly autoReloadButton = this.root.getByRole('button', { name: /auto-reload/ });
  readonly messageContent = this.root.getByLabelText('Log contains');
  readonly scopeInput = this.root.getByLabelText('Scopes');
  readonly itemInput = this.root.getByLabelText('Items');
  readonly groupInput = this.root.getByLabelText('Groups');
  readonly startDate = this.root.getByCss('#start');
  readonly clearLevelsButton = this.root.getByCss('#clear-levels-button');
  readonly clearScopeTypesButton = this.root.getByCss('#clear-scope-types-button');
  readonly emptyMessage = this.root.getByText('No log found');
  readonly headers = this.root.getByCss('thead th');
  readonly rows = this.root.getByCss('tbody tr');
  readonly pagination = this.root.getByCss('ngb-pagination');
  readonly contextMenu = this.root.getByCss('.context-menu');
  readonly contextMenuBackdrop = this.root.getByCss('.context-menu-backdrop');

  /** A filter chip (level, scope type, or selected scope/item/group) of the search form */
  chip(name: string) {
    return this.form.getByRole('button', { name, exact: true });
  }

  cells(rowIndex: number) {
    return this.rows.nth(rowIndex).getByRole('cell');
  }

  contextMenuItem(name: string) {
    return this.contextMenu.getByRole('button', { name });
  }
}

const START = '2022-12-31T23:00:00.000Z';
const END = '2023-02-28T23:00:00.000Z';
const SEARCH_URL = `/?start=${START}&end=${END}&levels=info&levels=error&page=2`;
/** The criteria of SEARCH_URL */
const URL_CRITERIA: LogSearchParam = {
  messageContent: undefined,
  scopeTypes: [],
  scopeIds: [],
  itemIds: [],
  groupIds: [],
  start: START,
  end: END,
  levels: ['info', 'error'],
  page: 2
};

const scope: Scope = { scopeId: 's1', scopeName: 'My South' };
const item: Item = { itemId: 'i1', itemName: 'Temperature', scopeId: 's1', scopeName: 'My South' };
const group: Group = { groupId: 'g1', groupName: 'Sensors', scopeId: 's1', scopeName: 'My South' };

function buildLog(overrides: Partial<LogDTO> = {}): LogDTO {
  return {
    timestamp: '2023-01-01T00:00:00.000Z',
    level: 'error',
    scopeType: 'internal',
    scopeId: null,
    scopeName: null,
    itemId: null,
    itemName: null,
    groupId: null,
    groupName: null,
    message: 'my log 1',
    ...overrides
  };
}

const logs: Array<LogDTO> = [
  buildLog(),
  buildLog({ timestamp: '2023-01-02T00:00:00.000Z', level: 'warn', scopeId: 'engine', message: 'my log 2' }),
  buildLog({
    timestamp: '2023-01-03T00:00:00.000Z',
    level: 'info',
    scopeType: 'south',
    scopeId: 's1',
    scopeName: 'My South',
    itemId: 'i1',
    itemName: 'Temperature',
    groupId: 'g1',
    groupName: 'Sensors',
    message: 'my log 3'
  })
];
const logPage: Page<LogDTO> = toPage(logs);

describe('LogsComponent', () => {
  let logService: MockObject<LogService>;

  /** Navigates to the given URL (the query params are the search criteria), then creates the component with the given inputs */
  async function createTester(
    url = SEARCH_URL,
    inputs: { scopeId?: string; scopeType?: ScopeType; embedded?: boolean } = {}
  ): Promise<LogsComponentTester> {
    await TestBed.inject(Router).navigateByUrl(url);
    const tester = new LogsComponentTester();
    for (const [name, value] of Object.entries(inputs)) {
      tester.fixture.componentRef.setInput(name, value);
    }
    return tester;
  }

  /** Waits for a new search and returns its criteria */
  async function lastSearch(expectedCalls: number): Promise<LogSearchParam> {
    await vi.waitFor(() => expect(logService.search).toHaveBeenCalledTimes(expectedCalls));
    return logService.search.mock.lastCall![0];
  }

  beforeEach(() => {
    logService = createMock(LogService);
    logService.search.mockReturnValue(of(logPage));

    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), provideRouter([]), provideNgbConfigTesting(), { provide: LogService, useValue: logService }]
    });
  });

  afterEach(() => vi.useRealTimers());

  describe('standalone logs page', () => {
    test('should display a message when no log is found', async () => {
      logService.search.mockReturnValue(of(emptyPage<LogDTO>()));
      const tester = await createTester();

      await expect.element(tester.title).toHaveTextContent('Logs');
      await expect.element(tester.emptyMessage).toBeInTheDocument();
      await expect.element(tester.rows).not.toBeInTheDocument();
    });

    test('should search the logs with the criteria of the URL and display them', async () => {
      const tester = await createTester();

      await expect.element(tester.rows).toHaveLength(3);
      expect(logService.search).toHaveBeenCalledExactlyOnceWith(URL_CRITERIA);
      await expect.element(tester.emptyMessage).not.toBeInTheDocument();
      await expect.element(tester.headers).toHaveLength(7);
      await expect.element(tester.headers.nth(0)).toHaveTextContent('Level');

      await expect.element(tester.cells(0)).toHaveLength(7);
      await expect.element(tester.cells(0).nth(0).getByRole('img', { name: 'Error' })).toBeInTheDocument();
      await expect.element(tester.cells(0).nth(1)).toHaveTextContent('1 Jan 2023, 01:00:00.000');
      await expect.element(tester.cells(0).nth(2)).toHaveTextContent('Internal');
      await expect.element(tester.cells(0).nth(3)).toHaveTextContent('');
      await expect.element(tester.cells(0).nth(4)).toHaveTextContent('');
      await expect.element(tester.cells(0).nth(5)).toHaveTextContent('');
      await expect.element(tester.cells(0).nth(6)).toHaveTextContent('my log 1');

      // internal scopes are translated
      await expect.element(tester.cells(1).nth(0).getByRole('img', { name: 'Warning' })).toBeInTheDocument();
      await expect.element(tester.cells(1).nth(2)).toHaveTextContent('Internal');
      await expect.element(tester.cells(1).nth(3)).toHaveTextContent('Engine');

      await expect.element(tester.cells(2).nth(1)).toHaveTextContent('3 Jan 2023, 01:00:00.000');
      await expect.element(tester.cells(2).nth(2)).toHaveTextContent('South');
      await expect.element(tester.cells(2).nth(3)).toHaveTextContent('My South');
      await expect.element(tester.cells(2).nth(4)).toHaveTextContent('Temperature');
      await expect.element(tester.cells(2).nth(5)).toHaveTextContent('Sensors');
      await expect.element(tester.cells(2).nth(6)).toHaveTextContent('my log 3');
    });

    test.each<[LogLevel, string, string]>([
      ['error', 'Error', 'fa-times-circle'],
      ['warn', 'Warning', 'fa-exclamation-triangle'],
      ['info', 'Info', 'fa-info-circle'],
      ['debug', 'Debug', 'fa-bug'],
      ['trace', 'Trace', 'fa-search'],
      // no dedicated icon: falls back to the error one
      ['silent', 'Silent', 'fa-times-circle']
    ])('should display the %s level with its own icon', async (level, label, icon) => {
      logService.search.mockReturnValue(of(toPage([buildLog({ level })])));
      const tester = await createTester();

      await expect.element(tester.cells(0).nth(0).getByRole('img', { name: label })).toHaveClass(icon);
    });

    test('should search the last 24 hours by default', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2024-05-10T10:20:30.000Z'));
      await createTester('/');

      const criteria = await lastSearch(1);
      expect(criteria).toEqual({ ...URL_CRITERIA, start: expect.any(String), end: undefined, levels: [], page: 0 });
      expect(DateTime.fromISO(criteria.start!).toUTC().toISO()).toBe('2024-05-09T10:20:59.999Z');
    });

    test('should restore the scope, item and group filters of the URL', async () => {
      logService.getScopeById.mockImplementation(id => (id === 's1' ? of(scope) : throwError(() => new Error('not found'))));
      logService.getItemById.mockReturnValue(of(item));
      logService.getGroupById.mockReturnValue(of(group));
      const tester = await createTester(`${SEARCH_URL}&scopeIds=s1&scopeIds=deleted&itemIds=i1&groupIds=g1`);

      await expect.element(tester.chip('My South')).toBeInTheDocument();
      await expect.element(tester.chip('Temperature')).toBeInTheDocument();
      await expect.element(tester.chip('Sensors')).toBeInTheDocument();
      // the selected items and groups are prefixed with the name of their connector
      await expect.element(tester.form.getByText('My South:')).toHaveLength(2);
      expect(logService.getScopeById).toHaveBeenCalledWith('deleted');
      expect(await lastSearch(1)).toEqual({ ...URL_CRITERIA, scopeIds: ['s1', 'deleted'], itemIds: ['i1'], groupIds: ['g1'] });

      // the scope which could not be loaded is dropped from the next search
      await tester.chip('Warning').click();
      expect(await lastSearch(2)).toEqual({
        ...URL_CRITERIA,
        levels: ['info', 'error', 'warn'],
        scopeIds: ['s1'],
        itemIds: ['i1'],
        groupIds: ['g1'],
        page: 0
      });
    });

    test('should search with the criteria of the form', async () => {
      const tester = await createTester();
      await expect.element(tester.rows).toHaveLength(3);

      await tester.messageContent.fill('boom');
      await tester.searchButton.click();

      expect(await lastSearch(2)).toEqual({ ...URL_CRITERIA, messageContent: 'boom', page: 0 });
      expect(TestBed.inject(Router).url).toContain('messageContent=boom');
    });

    test('should not search when the start date is after the end date', async () => {
      TestBed.createComponent(DefaultValidationErrorsComponent);
      const tester = await createTester();
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');
      await expect.element(tester.rows).toHaveLength(3);

      await tester.startDate.fillWithDate('2023-06-01');
      await expect.element(tester.root.getByText('The end date must be after the start date')).toBeInTheDocument();
      await tester.searchButton.click();

      expect(navigate).not.toHaveBeenCalled();
      expect(logService.search).toHaveBeenCalledTimes(1);
    });

    test('should disable the search button while searching', async () => {
      logService.search.mockReturnValue(NEVER);
      const tester = await createTester();

      await expect.element(tester.searchButton).toBeDisabled();
    });

    test('should display no log and allow a new search when the search fails', async () => {
      logService.search.mockReturnValue(throwError(() => new Error('search failed')));
      const tester = await createTester();

      await expect.element(tester.emptyMessage).toBeInTheDocument();
      await expect.element(tester.searchButton).toBeEnabled();

      logService.search.mockReturnValue(of(logPage));
      await tester.searchButton.click();
      await expect.element(tester.rows).toHaveLength(3);
    });

    test('should load the page clicked in the pagination', async () => {
      logService.search.mockReturnValue(of(toPage(logs, 100, 2, 20)));
      const tester = await createTester();

      await tester.pagination.getByRole('link', { name: '4', exact: true }).click();

      expect(await lastSearch(2)).toEqual({ ...URL_CRITERIA, page: 3 });
    });
  });

  describe('level and scope type filters', () => {
    test('should toggle a level when clicking its chip and search immediately', async () => {
      const tester = await createTester();
      // levels of the URL
      await expect.element(tester.chip('Error')).toHaveAttribute('aria-pressed', 'true');
      await expect.element(tester.chip('Info')).toHaveAttribute('aria-pressed', 'true');
      await expect.element(tester.chip('Warning')).toHaveAttribute('aria-pressed', 'false');

      await tester.chip('Warning').click();
      expect(await lastSearch(2)).toEqual({ ...URL_CRITERIA, levels: ['info', 'error', 'warn'], page: 0 });
      await expect.element(tester.chip('Warning')).toHaveAttribute('aria-pressed', 'true');

      await tester.chip('Info').click();
      expect(await lastSearch(3)).toEqual({ ...URL_CRITERIA, levels: ['error', 'warn'], page: 0 });
      await expect.element(tester.chip('Info')).toHaveAttribute('aria-pressed', 'false');
    });

    test('should clear the levels', async () => {
      const tester = await createTester();

      await tester.clearLevelsButton.click();

      expect(await lastSearch(2)).toEqual({ ...URL_CRITERIA, levels: [], page: 0 });
      await expect.element(tester.chip('Error')).toHaveAttribute('aria-pressed', 'false');
      await expect.element(tester.clearLevelsButton).not.toBeInTheDocument();
    });

    test('should toggle a scope type when clicking its chip and search immediately', async () => {
      const tester = await createTester();
      await expect.element(tester.clearScopeTypesButton).not.toBeInTheDocument();

      await tester.chip('South').click();
      expect(await lastSearch(2)).toEqual({ ...URL_CRITERIA, scopeTypes: ['south'], page: 0 });
      await expect.element(tester.chip('South')).toHaveAttribute('aria-pressed', 'true');
      await expect.element(tester.chip('North')).toHaveAttribute('aria-pressed', 'false');

      await tester.chip('South').click();
      expect(await lastSearch(3)).toEqual({ ...URL_CRITERIA, scopeTypes: [], page: 0 });
      await expect.element(tester.chip('South')).toHaveAttribute('aria-pressed', 'false');
    });

    test('should clear the scope types', async () => {
      const tester = await createTester(`${SEARCH_URL}&scopeTypes=north&scopeTypes=internal`);
      await expect.element(tester.chip('North')).toHaveAttribute('aria-pressed', 'true');

      await tester.clearScopeTypesButton.click();

      expect(await lastSearch(2)).toEqual({ ...URL_CRITERIA, scopeTypes: [], page: 0 });
      await expect.element(tester.chip('North')).toHaveAttribute('aria-pressed', 'false');
      await expect.element(tester.clearScopeTypesButton).not.toBeInTheDocument();
    });
  });

  describe('scope, item and group filters', () => {
    test('should add a scope chosen in the suggestions, and remove it', async () => {
      logService.suggestScopes.mockReturnValue(of([scope]));
      const tester = await createTester();

      await tester.scopeInput.fill('My');
      await page.getByRole('option', { name: 'My South' }).click();

      expect(logService.suggestScopes).toHaveBeenCalledWith('My');
      await expect.element(tester.scopeInput).toHaveValue('');
      expect(await lastSearch(2)).toEqual({ ...URL_CRITERIA, scopeIds: ['s1'], page: 0 });

      await tester.chip('My South').click();

      expect(await lastSearch(3)).toEqual({ ...URL_CRITERIA, page: 0 });
      await expect.element(tester.chip('My South')).not.toBeInTheDocument();
    });

    test('should add an item chosen in the suggestions, and remove it', async () => {
      logService.suggestItems.mockReturnValue(of([item]));
      const tester = await createTester();

      await tester.itemInput.fill('Temp');
      // the connector name tells apart items of different connectors
      await page.getByRole('option', { name: 'Temperature (My South)' }).click();

      expect(logService.suggestItems).toHaveBeenCalledWith('Temp', undefined);
      await expect.element(tester.itemInput).toHaveValue('');
      await expect.element(tester.form.getByText('My South:')).toBeInTheDocument();
      expect(await lastSearch(2)).toEqual({ ...URL_CRITERIA, itemIds: ['i1'], page: 0 });

      await tester.chip('Temperature').click();

      expect(await lastSearch(3)).toEqual({ ...URL_CRITERIA, page: 0 });
      await expect.element(tester.chip('Temperature')).not.toBeInTheDocument();
    });

    test('should add a group chosen in the suggestions, and remove it', async () => {
      logService.suggestGroups.mockReturnValue(of([group]));
      const tester = await createTester();

      await tester.groupInput.fill('Sens');
      await page.getByRole('option', { name: 'Sensors (My South)' }).click();

      expect(logService.suggestGroups).toHaveBeenCalledWith('Sens', undefined);
      await expect.element(tester.groupInput).toHaveValue('');
      expect(await lastSearch(2)).toEqual({ ...URL_CRITERIA, groupIds: ['g1'], page: 0 });

      await tester.chip('Sensors').click();

      expect(await lastSearch(3)).toEqual({ ...URL_CRITERIA, page: 0 });
      await expect.element(tester.chip('Sensors')).not.toBeInTheDocument();
    });
  });

  describe('auto-reload', () => {
    // rxjs timers (polling, debounce) use setInterval: fake it only, so that Angular keeps rendering
    beforeEach(() => vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }));

    test('should refresh the logs every 10 seconds, except when paused', async () => {
      const tester = await createTester();
      await expect.element(tester.autoReloadButton).toHaveAccessibleName('Pause auto-reload');

      await vi.advanceTimersByTimeAsync(0);
      expect(logService.search).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(10_000);
      expect(logService.search).toHaveBeenCalledTimes(2);

      await tester.autoReloadButton.click();
      await expect.element(tester.autoReloadButton).toHaveAccessibleName('Resume auto-reload');
      await vi.advanceTimersByTimeAsync(30_000);
      expect(logService.search).toHaveBeenCalledTimes(2);

      await tester.autoReloadButton.click();
      await expect.element(tester.autoReloadButton).toHaveAccessibleName('Pause auto-reload');
      await vi.advanceTimersByTimeAsync(10_000);
      expect(logService.search).toHaveBeenCalledTimes(3);
      expect(logService.search).toHaveBeenLastCalledWith(URL_CRITERIA);
    });

    test('should not refresh the logs while the page is hidden', async () => {
      let visibilityState: DocumentVisibilityState = 'visible';
      vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibilityState);
      const tester = await createTester();
      await expect.element(tester.autoReloadButton).toBeInTheDocument();

      await vi.advanceTimersByTimeAsync(0);
      expect(logService.search).toHaveBeenCalledTimes(1);

      visibilityState = 'hidden';
      document.dispatchEvent(new Event('visibilitychange'));
      await vi.advanceTimersByTimeAsync(60_000);
      expect(logService.search).toHaveBeenCalledTimes(1);

      // Back to the tab: immediate refresh
      visibilityState = 'visible';
      document.dispatchEvent(new Event('visibilitychange'));
      await vi.advanceTimersByTimeAsync(0);
      expect(logService.search).toHaveBeenCalledTimes(2);
    });
  });

  describe('log row context menu', () => {
    async function openContextMenu(): Promise<LogsComponentTester> {
      const tester = await createTester();
      await expect.element(tester.rows).toHaveLength(3);
      await tester.rows.nth(0).click({ button: 'right' });
      await expect.element(tester.contextMenu).toBeInTheDocument();
      return tester;
    }

    test('should open on right-click instead of the native menu', async () => {
      let nativeMenuPrevented = false;
      document.addEventListener('contextmenu', event => (nativeMenuPrevented = event.defaultPrevented), { once: true });

      const tester = await openContextMenu();

      expect(nativeMenuPrevented).toBe(true);
      await expect.element(tester.contextMenu.getByText('Search around this log')).toBeInTheDocument();
      await expect.element(tester.contextMenu.getByRole('button')).toHaveLength(5);
    });

    test('should close on escape', async () => {
      const tester = await openContextMenu();

      await userEvent.keyboard('{Escape}');

      await expect.element(tester.contextMenu).not.toBeInTheDocument();
    });

    test.each<'left' | 'right'>(['left', 'right'])('should close on a %s click outside of the menu', async button => {
      const tester = await openContextMenu();

      await tester.contextMenuBackdrop.click({ button, position: { x: 5, y: 5 } });

      await expect.element(tester.contextMenu).not.toBeInTheDocument();
      expect(logService.search).toHaveBeenCalledTimes(1);
    });

    test('should search around the timestamp of the log and clear every other filter', async () => {
      logService.getScopeById.mockReturnValue(of(scope));
      const tester = await createTester(`${SEARCH_URL}&scopeIds=s1&messageContent=boom`);
      await expect.element(tester.chip('My South')).toBeInTheDocument();
      await tester.rows.nth(0).click({ button: 'right' });

      await tester.contextMenuItem('± 5 minutes').click();

      expect(await lastSearch(2)).toEqual({
        messageContent: undefined,
        start: '2022-12-31T23:55:00.000Z',
        end: '2023-01-01T00:05:00.000Z',
        levels: [],
        scopeTypes: [],
        scopeIds: [],
        itemIds: [],
        groupIds: [],
        page: 0
      });
      await expect.element(tester.contextMenu).not.toBeInTheDocument();
      await expect.element(tester.chip('My South')).not.toBeInTheDocument();
      await expect.element(tester.chip('Error')).toHaveAttribute('aria-pressed', 'false');
      await expect.element(tester.messageContent).toHaveValue('');
    });
  });

  describe('embedded in a connector or history query page', () => {
    test('should only search the logs of a north connector', async () => {
      logService.getScopeById.mockReturnValue(of({ scopeId: 'other', scopeName: 'Other' }));
      // the scope filters of the URL do not apply
      const tester = await createTester(`${SEARCH_URL}&scopeTypes=south&scopeIds=other`, {
        scopeId: 'north1',
        scopeType: 'north',
        embedded: true
      });

      await expect.element(tester.rows).toHaveLength(3);
      expect(logService.search).toHaveBeenCalledExactlyOnceWith({ ...URL_CRITERIA, scopeTypes: ['north'], scopeIds: ['north1'] });
      await expect.element(tester.title).not.toBeInTheDocument();
      // no scope column
      await expect.element(tester.headers).toHaveLength(5);
      await expect.element(tester.cells(0)).toHaveLength(5);
      // the search area is collapsed
      await expect.element(tester.form).not.toBeInTheDocument();

      await tester.searchAreaToggle.click();

      await expect.element(tester.form).toBeInTheDocument();
      await expect.element(tester.scopeInput).not.toBeInTheDocument();
      await expect.element(tester.itemInput).not.toBeInTheDocument();
      await expect.element(tester.groupInput).not.toBeInTheDocument();
      await expect.element(tester.chip('South')).not.toBeInTheDocument();

      await tester.chip('Warning').click();
      expect(await lastSearch(2)).toEqual({
        ...URL_CRITERIA,
        levels: ['info', 'error', 'warn'],
        scopeTypes: ['north'],
        scopeIds: ['north1'],
        page: 0
      });
    });

    test('should search the items and groups of a south connector only', async () => {
      logService.suggestItems.mockReturnValue(of([item]));
      logService.suggestGroups.mockReturnValue(of([group]));
      const tester = await createTester(SEARCH_URL, { scopeId: 's1', scopeType: 'south', embedded: true });
      await tester.searchAreaToggle.click();
      await expect.element(tester.scopeInput).not.toBeInTheDocument();

      await tester.itemInput.fill('Temp');
      // no need to tell apart the connector of the items
      await page.getByRole('option', { name: 'Temperature', exact: true }).click();
      expect(logService.suggestItems).toHaveBeenCalledWith('Temp', 's1');
      await expect.element(tester.chip('Temperature')).toBeInTheDocument();

      await tester.groupInput.fill('Sens');
      await page.getByRole('option', { name: 'Sensors', exact: true }).click();
      expect(logService.suggestGroups).toHaveBeenCalledWith('Sens', 's1');
      await expect.element(tester.chip('Sensors')).toBeInTheDocument();

      await expect.element(tester.form.getByText('My South:')).not.toBeInTheDocument();
      expect(await lastSearch(3)).toEqual({
        ...URL_CRITERIA,
        scopeTypes: ['south'],
        scopeIds: ['s1'],
        itemIds: ['i1'],
        groupIds: ['g1'],
        page: 0
      });
    });

    test('should search the items, but not the groups, of a history query', async () => {
      const tester = await createTester(SEARCH_URL, { scopeId: 'h1', scopeType: 'history-query', embedded: true });
      await tester.searchAreaToggle.click();

      await expect.element(tester.itemInput).toBeInTheDocument();
      await expect.element(tester.groupInput).not.toBeInTheDocument();
      await expect.element(tester.scopeInput).not.toBeInTheDocument();
    });
  });
});
