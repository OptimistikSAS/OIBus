import { TestBed } from '@angular/core/testing';

import { LogsComponent } from './logs.component';
import { provideI18nTesting } from '../../i18n/mock-i18n';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { LogService } from '../services/log.service';
import { DEFAULT_TZ, Page } from '../../../../backend/shared/model/types';
import { LogDTO, Scope } from '../../../../backend/shared/model/logs.model';
import { BehaviorSubject, of, Subscription } from 'rxjs';
import { emptyPage, toPage } from '../shared/test-utils';
import { DateTime } from 'luxon';
import { PageLoader } from '../shared/page-loader.service';
import { TYPEAHEAD_DEBOUNCE_TIME } from '../shared/form/typeahead';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { createMock, MockObject, stubRoute } from '../../test/vitest-create-mock';

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
  readonly buttonContainer = this.root.getByCss('.d-flex.gap-2');

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

    expect(logService.search).toHaveBeenCalledWith({
      messageContent: undefined,
      scopeTypes: [],
      scopeIds: [],
      itemIds: [],
      start: '2022-12-31T23:00:00.000Z',
      end: '2023-02-28T23:00:00.000Z',
      levels: ['info', 'error'],
      page: 2
    });
    await expect.element(tester.logs).toHaveLength(2);

    await expect.element(tester.cells(0)).toHaveLength(6);
    await expect.element(tester.cells(0).nth(1)).toHaveTextContent('1 Jan 2023, 01:00:00');
    await expect.element(tester.cells(0).nth(2)).toHaveTextContent('Internal');
    expect(tester.cells(0).nth(3).element().textContent?.trim()).toBe('');
    expect(tester.cells(0).nth(4).element().textContent?.trim()).toBe('');
    await expect.element(tester.cells(0).nth(5)).toHaveTextContent('my log 1');

    await expect.element(tester.cells(1).nth(1)).toHaveTextContent('2 Jan 2023, 01:00:00');
    await expect.element(tester.cells(1).nth(2)).toHaveTextContent('South');
    await expect.element(tester.cells(1).nth(3)).toHaveTextContent('My South');
    expect(tester.cells(1).nth(4).element().textContent?.trim()).toBe('');
    await expect.element(tester.cells(1).nth(5)).toHaveTextContent('my log 2');
  });

  test('should add selected scope and clear input on typeahead selection', () => {
    const scope: Scope = { scopeId: 'testId', scopeName: 'Test Scope' };

    const event = {
      item: scope,
      preventDefault: vi.fn()
    } as any;

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

    tester.component.removeScope(scopes[0]);

    expect(tester.component.selectedScopes()).toEqual([scopes[1]]);
  });

  test('should return correct class for known log level', () => {
    const result = tester.component.getLevelClass('error');
    expect(result).toBe('red-dot');
  });

  test('should fallback to red-dot for unknown log level', () => {
    const result = tester.component.getLevelClass('unknown' as any);
    expect(result).toBe('red-dot');
  });

  test('should build search params from route', () => {
    const params = tester.component.toSearchParams(route as any);
    expect(params.messageContent).toBeUndefined();
    expect(params.scopeTypes).toEqual([]);
    expect(params.levels).toEqual(['info', 'error']);
    expect(params.page).toBe(2);
  });

  test('should fetch logs periodically if page is 0, no end date, and not paused', () => {
    vi.useFakeTimers();
    pageLoader.pageLoads$ = new BehaviorSubject<number>(0);
    tester.component.autoReloadPaused.set(false);
    logService.search.mockReturnValue(of(logPage));

    vi.advanceTimersByTime(10_000);
    tester.fixture.detectChanges();

    expect(logService.search).toHaveBeenCalledTimes(2);
  });

  describe('Auto-reload functionality', () => {
    beforeEach(() => {
      logService.search.mockReturnValue(of(logPage));
    });

    test('should initially have auto-reload enabled', async () => {
      vi.useFakeTimers();
      tester.setEmbedded(false);
      vi.advanceTimersByTime(100);

      expect(tester.component.autoReloadPaused()).toBe(false);
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
      tester.component.autoReloadPaused.set(true);
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

      expect(tester.component.autoReloadPaused()).toBe(false);
      await expect.element(tester.pauseIcon).toBeInTheDocument();

      await tester.autoReloadButton.click();
      vi.advanceTimersByTime(100);
      tester.fixture.detectChanges();

      expect(tester.component.autoReloadPaused()).toBe(true);
      await expect.element(tester.playIcon).toBeInTheDocument();
      await expect.element(tester.pauseIcon).not.toBeInTheDocument();

      await tester.autoReloadButton.click();
      vi.advanceTimersByTime(100);
      tester.fixture.detectChanges();

      expect(tester.component.autoReloadPaused()).toBe(false);
      await expect.element(tester.pauseIcon).toBeInTheDocument();
      await expect.element(tester.playIcon).not.toBeInTheDocument();
    });

    test('should not trigger immediate reload when resuming with end date', async () => {
      vi.useFakeTimers();
      tester.setEmbedded(false);
      vi.advanceTimersByTime(100);

      tester.component.searchForm.patchValue({ end: '2023-01-01T00:00:00.000Z' });

      tester.component.autoReloadPaused.set(true);
      vi.advanceTimersByTime(100);

      await expect.element(tester.autoReloadButton).toBeInTheDocument();
      await tester.autoReloadButton.click();
      vi.advanceTimersByTime(100);

      expect(tester.component.autoReloadPaused()).toBe(false);
      expect(pageLoader.loadPage).not.toHaveBeenCalled();
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
      tester.component.selectScope(ev);
      expect(tester.component.selectedScopes()).toEqual([scope]);
      expect(tester.component.searchForm.controls.scopeIds.value).toBe('');
      expect(ev.preventDefault).toHaveBeenCalled();
    });

    test('removeScope should remove the given scope', () => {
      const a: Scope = { scopeId: 'A', scopeName: 'A' };
      const b: Scope = { scopeId: 'B', scopeName: 'B' };
      tester.component.selectedScopes.set([a, b]);
      tester.component.removeScope(a);
      expect(tester.component.selectedScopes()).toEqual([b]);
    });

    test('getLevelClass should return correct class or fallback', () => {
      const cmp = tester.component;
      expect(cmp.getLevelClass('error')).toBe('red-dot');
      expect(cmp.getLevelClass('warn')).toBe('yellow-dot');
      expect(cmp.getLevelClass('info')).toBe('green-dot');
      expect(cmp.getLevelClass('debug')).toBe('blue-dot');
      expect(cmp.getLevelClass('trace')).toBe('grey-dot');
      expect(cmp.getLevelClass('nonsense' as any)).toBe('red-dot');
    });
  });
});
