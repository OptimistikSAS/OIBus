import { TestBed } from '@angular/core/testing';

import { LogsComponent } from './logs.component';
import { provideI18nTesting } from '../../i18n/mock-i18n';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { LogService } from '../services/log.service';
import { DEFAULT_TZ, Page } from '../../../../backend/shared/model/types';
import { Group, Item, LogDTO, Scope } from '../../../../backend/shared/model/logs.model';
import { BehaviorSubject, of, Subscription } from 'rxjs';
import { emptyPage, toPage } from '../shared/test-utils';
import { DateTime } from 'luxon';
import { PageLoader } from '../shared/page-loader.service';
import { TYPEAHEAD_DEBOUNCE_TIME } from '../shared/form/typeahead';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { createMock, MockObject, stubRoute } from '../../test/vitest-create-mock';
import { provideNgbConfigTesting } from '../shared/form/oi-ngb-testing';

class LogsComponentTester {
  readonly fixture = TestBed.createComponent(LogsComponent);
  readonly component = this.fixture.componentInstance;
  readonly root = page.getByCss(`#${this.fixture.nativeElement.id}`);
  readonly emptyContainer = this.root.getByCss('.empty');
  readonly logs = this.root.getByCss('tbody tr');
  readonly autoReloadButton = this.root.getByCss('#auto-reload-toggle');
  readonly searchButton = this.root.getByCss('#search-button');
  readonly pauseIcon = this.root.getByCss('#auto-reload-toggle .fa-pause');
  readonly playIcon = this.root.getByCss('#auto-reload-toggle .fa-play');
  readonly buttonContainer = this.root.getByCss('.search-buttons');
  readonly clearLevelsButton = this.root.getByCss('#clear-levels-button');
  readonly clearScopeTypesButton = this.root.getByCss('#clear-scope-types-button');
  readonly filterChips = this.root.getByCss('.filter-chip');
  readonly contextMenuBackdrop = this.root.getByCss('.context-menu-backdrop');
  readonly contextMenuItems = this.root.getByCss('.context-menu .dropdown-item');

  setEmbedded(embedded: boolean) {
    this.fixture.componentRef.setInput('embedded', embedded);
    this.fixture.detectChanges();
  }

  cells(rowIndex: number) {
    return this.logs.nth(rowIndex).getByCss('td');
  }
}

describe('LogsComponent', () => {
  let tester: LogsComponentTester;
  let logService: MockObject<LogService>;
  let pageLoader: MockObject<PageLoader>;
  let pageLoads$: BehaviorSubject<number>;

  const emptyLogPage: Page<LogDTO> = emptyPage();
  const logPage: Page<LogDTO> = toPage([
    {
      timestamp: '2023-01-01T00:00:00.000Z',
      level: 'error',
      scopeType: 'internal',
      scopeName: null,
      scopeId: null,
      itemId: null,
      itemName: null,
      groupId: null,
      groupName: null,
      message: 'my log 1'
    },
    {
      timestamp: '2023-01-02T00:00:00.000Z',
      level: 'error',
      scopeType: 'south',
      scopeId: 'southId',
      scopeName: 'My South',
      itemId: null,
      itemName: null,
      groupId: null,
      groupName: null,
      message: 'my log 2'
    }
  ]);

  const route = stubRoute({
    queryParams: {
      start: DateTime.fromISO('2023-01-01T00:00', { zone: DEFAULT_TZ }).toUTC().toISO({ includeOffset: true }),
      end: DateTime.fromISO('2023-03-01T00:00', { zone: DEFAULT_TZ }).toUTC().toISO({ includeOffset: true }),
      levels: ['info', 'error'],
      page: '2'
    }
  });

  beforeEach(() => {
    logService = createMock(LogService);
    pageLoader = createMock(PageLoader);
    pageLoads$ = new BehaviorSubject<number>(0);

    pageLoader.pageLoads$ = pageLoads$.asObservable();

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideRouter([]),
        provideHttpClientTesting(),
        provideNgbConfigTesting(),
        { provide: LogService, useValue: logService },
        { provide: PageLoader, useValue: pageLoader },
        { provide: ActivatedRoute, useValue: route }
      ]
    });

    tester = new LogsComponentTester();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('should have empty page', async () => {
    logService.search.mockReturnValue(of(emptyLogPage));
    tester.fixture.detectChanges();

    await expect.element(tester.emptyContainer).toHaveTextContent('No log found');
  });

  test('should have log page', async () => {
    logService.search.mockReturnValue(of(logPage));
    tester.fixture.detectChanges();

    await vi.waitFor(() => {
      expect(logService.search).toHaveBeenCalledWith({
        messageContent: undefined,
        scopeTypes: [],
        scopeIds: [],
        itemIds: [],
        groupIds: [],
        start: '2022-12-31T23:00:00.000Z',
        end: '2023-02-28T23:00:00.000Z',
        levels: ['info', 'error'],
        page: 2
      });
    });
    tester.fixture.detectChanges();
    await expect.element(tester.logs).toHaveLength(2);

    await expect.element(tester.cells(0)).toHaveLength(7);
    await expect.element(tester.cells(0).nth(1)).toHaveTextContent('1 Jan 2023, 01:00:00');
    await expect.element(tester.cells(0).nth(2)).toHaveTextContent('Internal');
    expect(tester.cells(0).nth(3).element().textContent?.trim()).toBe('');
    expect(tester.cells(0).nth(4).element().textContent?.trim()).toBe('');
    expect(tester.cells(0).nth(5).element().textContent?.trim()).toBe('');
    await expect.element(tester.cells(0).nth(6)).toHaveTextContent('my log 1');

    await expect.element(tester.cells(1).nth(1)).toHaveTextContent('2 Jan 2023, 01:00:00');
    await expect.element(tester.cells(1).nth(2)).toHaveTextContent('South');
    await expect.element(tester.cells(1).nth(3)).toHaveTextContent('My South');
    expect(tester.cells(1).nth(4).element().textContent?.trim()).toBe('');
    expect(tester.cells(1).nth(5).element().textContent?.trim()).toBe('');
    await expect.element(tester.cells(1).nth(6)).toHaveTextContent('my log 2');
  });

  test('should add selected scope and clear input on typeahead selection', () => {
    const scope: Scope = { scopeId: 'testId', scopeName: 'Test Scope' };

    const event = {
      item: scope,
      preventDefault: vi.fn()
    } as any;

    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockImplementation(() => Promise.resolve(true));

    const form = tester.component.searchForm;
    form.controls.scopeIds.setValue('someValue');

    tester.component.selectScope(event);

    expect(tester.component.selectedScopes()).toContain(scope);
    expect(form.controls.scopeIds.value).toBe('');
    expect(event.preventDefault).toHaveBeenCalled();
  });

  test('should remove selected scope', () => {
    const scopes: Array<Scope> = [
      { scopeId: '1', scopeName: 'A' },
      { scopeId: '2', scopeName: 'B' }
    ];
    tester.component.selectedScopes.set(scopes);

    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockImplementation(() => Promise.resolve(true));

    tester.component.removeScope(scopes[0]);

    expect(tester.component.selectedScopes()).toEqual([scopes[1]]);
  });

  test('should return correct class for known log level', () => {
    const result = tester.component.getLevelClass('error');
    expect(result).toBe('fa fa-times-circle level-red');
  });

  test('should fallback to red icon for unknown log level', () => {
    const result = tester.component.getLevelClass('unknown' as any);
    expect(result).toBe('fa fa-times-circle level-red');
  });

  test('should build search params from route', () => {
    const params = tester.component.toSearchParams(route as any);
    expect(params.messageContent).toBeUndefined();
    expect(params.scopeTypes).toEqual([]);
    expect(params.levels).toEqual(['info', 'error']);
    expect(params.page).toBe(2);
  });

  test('should refresh the logs every 10 seconds regardless of page or end date, but not when paused', async () => {
    vi.useFakeTimers();
    logService.search.mockReturnValue(of(logPage));

    tester.fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(0);
    tester.fixture.detectChanges();

    expect(logService.search).toHaveBeenCalledTimes(1);

    // Advance 10s → second refresh
    await vi.advanceTimersByTimeAsync(10_000);
    tester.fixture.detectChanges();
    expect(logService.search).toHaveBeenCalledTimes(2);

    // Pause → next 10s tick should be suppressed
    tester.component.paused.set(true);
    await vi.advanceTimersByTimeAsync(10_000);
    tester.fixture.detectChanges();
    expect(logService.search).toHaveBeenCalledTimes(2);

    // Unpause → next 10s tick fires again
    tester.component.paused.set(false);
    await vi.advanceTimersByTimeAsync(10_000);
    tester.fixture.detectChanges();
    expect(logService.search).toHaveBeenCalledTimes(3);
  });

  describe('Pause/resume functionality', () => {
    beforeEach(() => {
      logService.search.mockReturnValue(of(logPage));
    });

    test('should initially have auto-reload enabled', async () => {
      vi.useFakeTimers();
      tester.setEmbedded(false);
      vi.advanceTimersByTime(100);

      expect(tester.component.paused()).toBe(false);
      await expect.element(tester.pauseIcon).toBeInTheDocument();
      await expect.element(tester.playIcon).not.toBeInTheDocument();
    });

    test('should display pause icon when auto-reload is active', async () => {
      vi.useFakeTimers();
      tester.setEmbedded(false);
      vi.advanceTimersByTime(100);

      await expect.element(tester.pauseIcon).toBeInTheDocument();
      await expect.element(tester.playIcon).not.toBeInTheDocument();
    });

    test('should display play icon when auto-reload is paused', async () => {
      vi.useFakeTimers();
      tester.component.paused.set(true);
      tester.setEmbedded(false);
      vi.advanceTimersByTime(100);

      await expect.element(tester.autoReloadButton).toBeInTheDocument();
      await expect.element(tester.pauseIcon).not.toBeInTheDocument();
      await expect.element(tester.playIcon).toBeInTheDocument();
    });

    test('should toggle auto-reload state when button is clicked', async () => {
      vi.useFakeTimers();
      tester.setEmbedded(false);
      vi.advanceTimersByTime(100);

      expect(tester.component.paused()).toBe(false);
      await expect.element(tester.pauseIcon).toBeInTheDocument();

      await tester.autoReloadButton.click();
      vi.advanceTimersByTime(100);
      tester.fixture.detectChanges();

      expect(tester.component.paused()).toBe(true);
      await expect.element(tester.playIcon).toBeInTheDocument();
      await expect.element(tester.pauseIcon).not.toBeInTheDocument();

      await tester.autoReloadButton.click();
      vi.advanceTimersByTime(100);
      tester.fixture.detectChanges();

      expect(tester.component.paused()).toBe(false);
      await expect.element(tester.pauseIcon).toBeInTheDocument();
      await expect.element(tester.playIcon).not.toBeInTheDocument();
    });

    test('should have both pause/resume and search buttons in the same container', async () => {
      vi.useFakeTimers();
      tester.setEmbedded(false);
      vi.advanceTimersByTime(100);

      await expect.element(tester.buttonContainer).toBeInTheDocument();
      expect(tester.buttonContainer.element().children.length).toBe(2);
      await expect.element(tester.autoReloadButton).toBeInTheDocument();
      await expect.element(tester.searchButton).toBeInTheDocument();
    });

    test('should use correct button classes', async () => {
      vi.useFakeTimers();
      tester.setEmbedded(false);
      vi.advanceTimersByTime(100);

      await expect.element(tester.autoReloadButton).toBeInTheDocument();
      expect(tester.autoReloadButton.element().classList).toContain('btn');
      expect(tester.autoReloadButton.element().classList).toContain('btn-primary');
      await expect.element(tester.searchButton).toBeInTheDocument();
      expect(tester.searchButton.element().classList).toContain('btn');
      expect(tester.searchButton.element().classList).toContain('btn-primary');
    });
  });

  describe('Clickable level and scope-type filter chips', () => {
    beforeEach(() => {
      logService.search.mockReturnValue(of(logPage));
    });

    test('should display a clickable chip for every level and scope type', async () => {
      tester.fixture.detectChanges();

      // 5 levels + 4 scope types
      await expect.element(tester.filterChips).toHaveLength(9);
    });

    test('should toggle a level filter when clicking a chip and immediately search', () => {
      const router = TestBed.inject(Router);
      const navigateSpy = vi.spyOn(router, 'navigate').mockImplementation(() => Promise.resolve(true));
      tester.fixture.detectChanges();

      // Route already has levels: ['info', 'error'] — add 'warn' via the method
      tester.component.toggleLevel('warn');

      expect(navigateSpy).toHaveBeenCalledWith(
        [],
        expect.objectContaining({ queryParams: expect.objectContaining({ levels: ['info', 'error', 'warn'] }) })
      );

      // Remove 'info' (already active)
      navigateSpy.mockClear();
      tester.component.toggleLevel('info');

      expect(navigateSpy).toHaveBeenCalledWith(
        [],
        expect.objectContaining({ queryParams: expect.objectContaining({ levels: ['error', 'warn'] }) })
      );
    });

    test('should clear all level filters when clicking the level clear button', async () => {
      const router = TestBed.inject(Router);
      const navigateSpy = vi.spyOn(router, 'navigate').mockImplementation(() => Promise.resolve(true));
      tester.fixture.detectChanges();

      // The route has levels: ['info', 'error'], so the clear button should be visible
      await expect.element(tester.clearLevelsButton).toBeInTheDocument();
      await tester.clearLevelsButton.click();

      expect(navigateSpy).toHaveBeenCalledWith([], expect.objectContaining({ queryParams: expect.objectContaining({ levels: [] }) }));
    });

    test('should toggle a scope-type filter when clicking a chip and immediately search', () => {
      const router = TestBed.inject(Router);
      const navigateSpy = vi.spyOn(router, 'navigate').mockImplementation(() => Promise.resolve(true));
      tester.fixture.detectChanges();

      tester.component.toggleScopeType('south');

      expect(navigateSpy).toHaveBeenCalledWith(
        [],
        expect.objectContaining({ queryParams: expect.objectContaining({ scopeTypes: ['south'] }) })
      );

      navigateSpy.mockClear();
      tester.component.toggleScopeType('south');

      expect(navigateSpy).toHaveBeenCalledWith([], expect.objectContaining({ queryParams: expect.objectContaining({ scopeTypes: [] }) }));
    });

    test('should clear all scope-type filters when clicking the scope-type clear button', async () => {
      const router = TestBed.inject(Router);
      const navigateSpy = vi.spyOn(router, 'navigate').mockImplementation(() => Promise.resolve(true));
      tester.fixture.detectChanges();
      tester.component.searchForm.controls.scopeTypes.setValue(['south']);
      tester.fixture.detectChanges();

      await expect.element(tester.clearScopeTypesButton).toBeInTheDocument();
      await tester.clearScopeTypesButton.click();

      expect(navigateSpy).toHaveBeenCalledWith([], expect.objectContaining({ queryParams: expect.objectContaining({ scopeTypes: [] }) }));
    });
  });

  describe('Contextual time search on row context menu', () => {
    beforeEach(() => {
      logService.search.mockReturnValue(of(logPage));
    });

    test('should open a context menu with 5 time-window options on right-click, suppressing the native menu', async () => {
      tester.fixture.detectChanges();

      const preventDefault = vi.fn();
      tester.component.openContextMenu({ preventDefault, clientX: 120, clientY: 340 } as unknown as MouseEvent, '2023-01-01T00:00:00.000Z');
      tester.fixture.detectChanges();

      expect(preventDefault).toHaveBeenCalled();
      expect(tester.component.contextMenu()).toEqual({ x: 120, y: 340, timestamp: '2023-01-01T00:00:00.000Z' });
      await expect.element(tester.contextMenuBackdrop).toBeInTheDocument();
      await expect.element(tester.contextMenuItems).toHaveLength(5);
    });

    test('should close the context menu on escape', () => {
      tester.fixture.detectChanges();
      tester.component.openContextMenu(
        { preventDefault: vi.fn(), clientX: 0, clientY: 0 } as unknown as MouseEvent,
        '2023-01-01T00:00:00.000Z'
      );

      expect(tester.component.contextMenu()).not.toBeNull();

      tester.component.closeContextMenu();

      expect(tester.component.contextMenu()).toBeNull();
    });

    test('should close the context menu when clicking the backdrop', async () => {
      tester.fixture.detectChanges();
      tester.component.openContextMenu(
        { preventDefault: vi.fn(), clientX: 0, clientY: 0 } as unknown as MouseEvent,
        '2023-01-01T00:00:00.000Z'
      );
      tester.fixture.detectChanges();

      await tester.contextMenuBackdrop.click();

      expect(tester.component.contextMenu()).toBeNull();
    });

    test('should search a window around the timestamp and clear every other filter', () => {
      const router = TestBed.inject(Router);
      const navigateSpy = vi.spyOn(router, 'navigate').mockImplementation(() => Promise.resolve(true));
      tester.fixture.detectChanges();
      tester.component.selectedScopes.set([{ scopeId: '1', scopeName: 'A' }]);

      tester.component.searchAroundTimestamp('2020-01-01T12:00:00.000Z', 5);

      expect(navigateSpy).toHaveBeenCalledWith([], {
        queryParams: {
          start: '2020-01-01T11:55:00.000Z',
          end: '2020-01-01T12:05:00.000Z',
          messageContent: null,
          levels: [],
          scopeTypes: [],
          scopeIds: [],
          itemIds: [],
          groupIds: [],
          page: 0
        }
      });
      expect(tester.component.contextMenu()).toBeNull();
      expect(tester.component.selectedScopes()).toEqual([]);
    });
  });

  describe('other utility methods and streams', () => {
    test('scopeTypeahead should call service and set noLogMatchingWarning', () => {
      vi.useFakeTimers();
      const scopes1: Array<Scope> = [{ scopeId: '1', scopeName: 'A' }];
      logService.suggestScopes.mockReturnValue(of(scopes1));
      let result: Array<Scope> | undefined;
      tester.component.scopeTypeahead(of('foo')).subscribe(r => (result = r));
      vi.advanceTimersByTime(TYPEAHEAD_DEBOUNCE_TIME);
      expect(logService.suggestScopes).toHaveBeenCalledWith('foo');
      expect(result).toBe(scopes1);
      expect(tester.component.noLogMatchingWarning()).toBe(false);

      const scopes2: Array<Scope> = [];
      logService.suggestScopes.mockReturnValue(of(scopes2));
      tester.component.scopeTypeahead(of('bar')).subscribe(r => (result = r));
      vi.advanceTimersByTime(TYPEAHEAD_DEBOUNCE_TIME);
      expect(logService.suggestScopes).toHaveBeenCalledWith('bar');
      expect(result).toBe(scopes2);
      expect(tester.component.noLogMatchingWarning()).toBe(true);
    });

    test('triggerSearch should navigate with correct queryParams', () => {
      const router = TestBed.inject(Router);
      vi.spyOn(router, 'navigate').mockImplementation(() => Promise.resolve(true));

      tester.component.searchForm.patchValue({
        start: 'AAA',
        end: 'BBB',
        messageContent: 'MSG',
        levels: ['info'],
        scopeTypes: ['south'],
        scopeIds: null,
        page: 0
      });
      const sc: Scope = { scopeId: 'X', scopeName: 'NX' };
      tester.component.selectedScopes.set([sc]);

      tester.component.triggerSearch();
      expect(router.navigate).toHaveBeenCalledWith([], {
        queryParams: {
          start: 'AAA',
          end: 'BBB',
          messageContent: 'MSG',
          levels: ['info'],
          scopeTypes: ['south'],
          scopeIds: ['X'],
          itemIds: [],
          groupIds: [],
          page: 0
        }
      });
    });

    test('ngOnDestroy should unsubscribe the subscription', () => {
      const sub: Subscription = tester.component.subscription;
      expect(sub.closed).toBe(false);
      tester.component.ngOnDestroy();
      expect(sub.closed).toBe(true);
    });

    test('selectScope should add a scope, clear input and preventDefault', () => {
      const scope: Scope = { scopeId: '1', scopeName: 'N' };
      const ev: any = { item: scope, preventDefault: vi.fn() };
      const router = TestBed.inject(Router);
      vi.spyOn(router, 'navigate').mockImplementation(() => Promise.resolve(true));

      tester.component.selectScope(ev);
      expect(tester.component.selectedScopes()).toEqual([scope]);
      expect(tester.component.searchForm.controls.scopeIds.value).toBe('');
      expect(ev.preventDefault).toHaveBeenCalled();
    });

    test('removeScope should remove the given scope', () => {
      const a: Scope = { scopeId: 'A', scopeName: 'A' };
      const b: Scope = { scopeId: 'B', scopeName: 'B' };
      const router = TestBed.inject(Router);
      vi.spyOn(router, 'navigate').mockImplementation(() => Promise.resolve(true));

      tester.component.selectedScopes.set([a, b]);
      tester.component.removeScope(a);
      expect(tester.component.selectedScopes()).toEqual([b]);
    });

    test('itemFormatter should append the owning connector/history name in parenthesis', () => {
      const item: Item = { itemId: '1', itemName: 'Temperature', scopeId: 's1', scopeName: 'My South' };
      expect(tester.component.itemFormatter(item)).toBe('Temperature (My South)');
    });

    test('itemFormatter should pass the raw input string through unchanged (e.g. when the field is reset to empty)', () => {
      expect(tester.component.itemFormatter('')).toBe('');
      expect(tester.component.itemFormatter('some typed text')).toBe('some typed text');
    });

    test('groupFormatter should append the owning connector/history name in parenthesis', () => {
      const group: Group = { groupId: '1', groupName: 'Sensors', scopeId: 's1', scopeName: 'My South' };
      expect(tester.component.groupFormatter(group)).toBe('Sensors (My South)');
    });

    test('groupFormatter should pass the raw input string through unchanged (e.g. when the field is reset to empty)', () => {
      expect(tester.component.groupFormatter('')).toBe('');
      expect(tester.component.groupFormatter('some typed text')).toBe('some typed text');
    });

    test('scopeFormatter should pass the raw input string through unchanged (e.g. when the field is reset to empty)', () => {
      expect(tester.component.scopeFormatter('')).toBe('');
      expect(tester.component.scopeFormatter('some typed text')).toBe('some typed text');
    });

    test('selectedItemsByScope should group selected items by their owning scope, preserving first-seen order', () => {
      const a: Item = { itemId: 'a', itemName: 'A', scopeId: 's1', scopeName: 'South 1' };
      const b: Item = { itemId: 'b', itemName: 'B', scopeId: 's2', scopeName: 'South 2' };
      const c: Item = { itemId: 'c', itemName: 'C', scopeId: 's1', scopeName: 'South 1' };
      tester.component.selectedItems.set([a, b, c]);

      expect(tester.component.selectedItemsByScope()).toEqual([
        { scopeId: 's1', scopeName: 'South 1', entries: [a, c] },
        { scopeId: 's2', scopeName: 'South 2', entries: [b] }
      ]);
    });

    test('selectedGroupsByScope should group selected groups by their owning scope, preserving first-seen order', () => {
      const a: Group = { groupId: 'a', groupName: 'A', scopeId: 's1', scopeName: 'South 1' };
      const b: Group = { groupId: 'b', groupName: 'B', scopeId: 's2', scopeName: 'South 2' };
      tester.component.selectedGroups.set([a, b]);

      expect(tester.component.selectedGroupsByScope()).toEqual([
        { scopeId: 's1', scopeName: 'South 1', entries: [a] },
        { scopeId: 's2', scopeName: 'South 2', entries: [b] }
      ]);
    });

    test('getLevelClass should return correct class or fallback', () => {
      const cmp = tester.component;
      expect(cmp.getLevelClass('error')).toBe('fa fa-times-circle level-red');
      expect(cmp.getLevelClass('warn')).toBe('fa fa-exclamation-triangle level-yellow');
      expect(cmp.getLevelClass('info')).toBe('fa fa-info-circle level-green');
      expect(cmp.getLevelClass('debug')).toBe('fa fa-bug level-blue');
      expect(cmp.getLevelClass('trace')).toBe('fa fa-search level-grey');
      expect(cmp.getLevelClass('nonsense' as any)).toBe('fa fa-times-circle level-red');
    });
  });
});
