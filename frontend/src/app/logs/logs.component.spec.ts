import { TestBed } from '@angular/core/testing';

import { LogsComponent } from './logs.component';
import { ComponentTester } from 'ngx-speculoos';
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
import { createMock, MockObject, stubRoute } from '../../test/vitest-create-mock';

class LogsComponentTester extends ComponentTester<LogsComponent> {
  constructor() {
    super(LogsComponent);
  }

  get emptyContainer() {
    return this.element('.empty');
  }

  get logs() {
    return this.elements('tbody tr');
  }

  get autoReloadButton() {
    return this.button('#auto-reload-toggle');
  }

  get searchButton() {
    return this.button('#search-button');
  }

  get pauseIcon() {
    return this.element('#auto-reload-toggle .fa-pause');
  }

  get playIcon() {
    return this.element('#auto-reload-toggle .fa-play');
  }

  setEmbedded(embedded: boolean) {
    this.fixture.componentRef.setInput('embedded', embedded);
    this.detectChanges();
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
      message: 'my log 1'
    },
    {
      timestamp: '2023-01-02T00:00:00.000Z',
      level: 'error',
      scopeType: 'south',
      scopeId: 'southId',
      scopeName: 'My South',
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
    await tester.change();

    expect(tester.emptyContainer!.textContent).toContain('No log found');
  });

  test('should have log page', async () => {
    logService.search.mockReturnValue(of(logPage));
    await tester.change();
    await Promise.resolve();
    await tester.change();

    expect(logService.search).toHaveBeenCalledWith({
      messageContent: undefined,
      scopeTypes: [],
      scopeIds: [],
      start: '2022-12-31T23:00:00.000Z',
      end: '2023-02-28T23:00:00.000Z',
      levels: ['info', 'error'],
      page: 2
    });
    expect(tester.logs.length).toBe(2);

    expect(tester.logs[0].elements('td').length).toBe(5);
    expect(tester.logs[0].elements('td')[1].textContent).toContain('1 Jan 2023, 01:00:00');
    expect(tester.logs[0].elements('td')[2].textContent).toContain('Internal');
    expect(tester.logs[0].elements('td')[3].textContent?.trim()).toBe('');
    expect(tester.logs[0].elements('td')[4].textContent).toContain('my log 1');

    expect(tester.logs[1].elements('td')[1].textContent).toContain('2 Jan 2023, 01:00:00');
    expect(tester.logs[1].elements('td')[2].textContent).toContain('South');
    expect(tester.logs[1].elements('td')[3].textContent).toContain('My South');
    expect(tester.logs[1].elements('td')[4].textContent).toContain('my log 2');
  });

  test('should add selected scope and clear input on typeahead selection', () => {
    const scope: Scope = { scopeId: 'testId', scopeName: 'Test Scope' };

    const event = {
      item: scope,
      preventDefault: vi.fn()
    } as any;

    const form = tester.componentInstance.searchForm;
    form.controls.scopeIds.setValue('someValue');

    tester.componentInstance.selectScope(event);

    expect(tester.componentInstance.selectedScopes()).toContain(scope);
    expect(form.controls.scopeIds.value).toBe('');
    expect(event.preventDefault).toHaveBeenCalled();
  });

  test('should remove selected scope', () => {
    const scopes: Array<Scope> = [
      { scopeId: '1', scopeName: 'A' },
      { scopeId: '2', scopeName: 'B' }
    ];
    tester.componentInstance.selectedScopes.set(scopes);

    tester.componentInstance.removeScope(scopes[0]);

    expect(tester.componentInstance.selectedScopes()).toEqual([scopes[1]]);
  });

  test('should return correct class for known log level', () => {
    const result = tester.componentInstance.getLevelClass('error');
    expect(result).toBe('red-dot');
  });

  test('should fallback to red-dot for unknown log level', () => {
    const result = tester.componentInstance.getLevelClass('unknown' as any);
    expect(result).toBe('red-dot');
  });

  test('should build search params from route', () => {
    const params = tester.componentInstance.toSearchParams(route as any);
    expect(params.messageContent).toBeUndefined();
    expect(params.scopeTypes).toEqual([]);
    expect(params.levels).toEqual(['info', 'error']);
    expect(params.page).toBe(2);
  });

  test('should fetch logs periodically if page is 0, no end date, and not paused', async () => {
    vi.useFakeTimers();
    pageLoader.pageLoads$ = new BehaviorSubject<number>(0);
    tester.componentInstance.autoReloadPaused.set(false);
    logService.search.mockReturnValue(of(logPage));

    await tester.change();
    vi.advanceTimersByTime(10_000);
    await tester.change();

    expect(logService.search).toHaveBeenCalledTimes(2);
  });

  describe('Auto-reload functionality', () => {
    beforeEach(() => {
      logService.search.mockReturnValue(of(logPage));
    });

    test('should initially have auto-reload enabled', () => {
      vi.useFakeTimers();
      tester.setEmbedded(false);
      vi.advanceTimersByTime(100);

      expect(tester.componentInstance.autoReloadPaused()).toBe(false);
      expect(tester.pauseIcon).toBeTruthy();
      expect(tester.playIcon).toBeFalsy();
    });

    test('should display pause icon when auto-reload is active', () => {
      vi.useFakeTimers();
      tester.setEmbedded(false);
      vi.advanceTimersByTime(100);

      expect(tester.pauseIcon).toBeTruthy();
      expect(tester.playIcon).toBeFalsy();
    });

    test('should display play icon when auto-reload is paused', () => {
      vi.useFakeTimers();
      tester.componentInstance.autoReloadPaused.set(true);
      tester.setEmbedded(false);
      vi.advanceTimersByTime(100);

      expect(tester.autoReloadButton).toBeTruthy();
      expect(tester.pauseIcon).toBeFalsy();
      expect(tester.playIcon).toBeTruthy();
    });

    test('should toggle auto-reload state when button is clicked', async () => {
      vi.useFakeTimers();
      tester.setEmbedded(false);
      vi.advanceTimersByTime(100);

      expect(tester.componentInstance.autoReloadPaused()).toBe(false);
      expect(tester.pauseIcon).toBeTruthy();

      tester.autoReloadButton!.click();
      vi.advanceTimersByTime(100);
      await tester.change();

      expect(tester.componentInstance.autoReloadPaused()).toBe(true);
      expect(tester.playIcon).toBeTruthy();
      expect(tester.pauseIcon).toBeFalsy();

      tester.autoReloadButton!.click();
      vi.advanceTimersByTime(100);
      await tester.change();

      expect(tester.componentInstance.autoReloadPaused()).toBe(false);
      expect(tester.pauseIcon).toBeTruthy();
      expect(tester.playIcon).toBeFalsy();
    });

    test('should not trigger immediate reload when resuming with end date', async () => {
      vi.useFakeTimers();
      tester.setEmbedded(false);
      vi.advanceTimersByTime(100);

      tester.componentInstance.searchForm.patchValue({ end: '2023-01-01T00:00:00.000Z' });

      tester.componentInstance.autoReloadPaused.set(true);
      vi.advanceTimersByTime(100);
      await tester.change();

      expect(tester.autoReloadButton).toBeTruthy();
      tester.autoReloadButton!.click();
      vi.advanceTimersByTime(100);

      expect(tester.componentInstance.autoReloadPaused()).toBe(false);
      expect(pageLoader.loadPage).not.toHaveBeenCalled();
    });

    test('should have both pause/resume and search buttons in the same container', () => {
      vi.useFakeTimers();
      tester.setEmbedded(false);
      vi.advanceTimersByTime(100);

      const buttonContainer = tester.element('.d-flex.gap-2');
      expect(buttonContainer).toBeTruthy();
      expect(buttonContainer?.nativeElement.children.length).toBe(2);
      expect(tester.autoReloadButton).toBeTruthy();
      expect(tester.searchButton).toBeTruthy();
    });

    test('should use correct button classes', () => {
      vi.useFakeTimers();
      tester.setEmbedded(false);
      vi.advanceTimersByTime(100);

      expect(tester.autoReloadButton).toBeTruthy();
      expect(tester.autoReloadButton?.nativeElement.classList).toContain('btn');
      expect(tester.autoReloadButton?.nativeElement.classList).toContain('btn-primary');
      expect(tester.searchButton).toBeTruthy();
      expect(tester.searchButton?.nativeElement.classList).toContain('btn');
      expect(tester.searchButton?.nativeElement.classList).toContain('btn-primary');
    });
  });

  describe('other utility methods and streams', () => {
    test('scopeTypeahead should call service and set noLogMatchingWarning', () => {
      vi.useFakeTimers();
      const scopes1: Array<Scope> = [{ scopeId: '1', scopeName: 'A' }];
      logService.suggestScopes.mockReturnValue(of(scopes1));
      let result: Array<Scope> | undefined;
      tester.componentInstance.scopeTypeahead(of('foo')).subscribe(r => (result = r));
      vi.advanceTimersByTime(TYPEAHEAD_DEBOUNCE_TIME);
      expect(logService.suggestScopes).toHaveBeenCalledWith('foo');
      expect(result).toBe(scopes1);
      expect(tester.componentInstance.noLogMatchingWarning()).toBe(false);

      const scopes2: Array<Scope> = [];
      logService.suggestScopes.mockReturnValue(of(scopes2));
      tester.componentInstance.scopeTypeahead(of('bar')).subscribe(r => (result = r));
      vi.advanceTimersByTime(TYPEAHEAD_DEBOUNCE_TIME);
      expect(logService.suggestScopes).toHaveBeenCalledWith('bar');
      expect(result).toBe(scopes2);
      expect(tester.componentInstance.noLogMatchingWarning()).toBe(true);
    });

    test('triggerSearch should navigate with correct queryParams', () => {
      const router = TestBed.inject(Router);
      vi.spyOn(router, 'navigate').mockImplementation(() => Promise.resolve(true));

      tester.componentInstance.searchForm.patchValue({
        start: 'AAA',
        end: 'BBB',
        messageContent: 'MSG',
        levels: ['info'],
        scopeTypes: ['south'],
        scopeIds: null,
        page: 0
      });
      const sc: Scope = { scopeId: 'X', scopeName: 'NX' };
      tester.componentInstance.selectedScopes.set([sc]);

      tester.componentInstance.triggerSearch();
      expect(router.navigate).toHaveBeenCalledWith([], {
        queryParams: {
          start: 'AAA',
          end: 'BBB',
          messageContent: 'MSG',
          levels: ['info'],
          scopeTypes: ['south'],
          scopeIds: ['X'],
          page: 0
        }
      });
    });

    test('ngOnDestroy should unsubscribe the subscription', () => {
      const sub: Subscription = tester.componentInstance.subscription;
      expect(sub.closed).toBe(false);
      tester.componentInstance.ngOnDestroy();
      expect(sub.closed).toBe(true);
    });

    test('selectScope should add a scope, clear input and preventDefault', () => {
      const scope: Scope = { scopeId: '1', scopeName: 'N' };
      const ev: any = { item: scope, preventDefault: vi.fn() };
      tester.componentInstance.selectScope(ev);
      expect(tester.componentInstance.selectedScopes()).toEqual([scope]);
      expect(tester.componentInstance.searchForm.controls.scopeIds.value).toBe('');
      expect(ev.preventDefault).toHaveBeenCalled();
    });

    test('removeScope should remove the given scope', () => {
      const a: Scope = { scopeId: 'A', scopeName: 'A' };
      const b: Scope = { scopeId: 'B', scopeName: 'B' };
      tester.componentInstance.selectedScopes.set([a, b]);
      tester.componentInstance.removeScope(a);
      expect(tester.componentInstance.selectedScopes()).toEqual([b]);
    });

    test('getLevelClass should return correct class or fallback', () => {
      const cmp = tester.componentInstance;
      expect(cmp.getLevelClass('error')).toBe('red-dot');
      expect(cmp.getLevelClass('warn')).toBe('yellow-dot');
      expect(cmp.getLevelClass('info')).toBe('green-dot');
      expect(cmp.getLevelClass('debug')).toBe('blue-dot');
      expect(cmp.getLevelClass('trace')).toBe('grey-dot');
      expect(cmp.getLevelClass('nonsense' as any)).toBe('red-dot');
    });
  });
});
