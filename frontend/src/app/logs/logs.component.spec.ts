import { fakeAsync, TestBed, tick } from '@angular/core/testing';

import { LogsComponent } from './logs.component';
import { ComponentTester, createMock, stubRoute } from 'ngx-speculoos';
import { provideI18nTesting } from '../../i18n/mock-i18n';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { LogService } from '../services/log.service';
import { DEFAULT_TZ, Page } from '../../../../backend/shared/model/types';
import { LogDTO, Scope } from '../../../../backend/shared/model/logs.model';
import { BehaviorSubject, of, Subscription } from 'rxjs';
import { emptyPage, toPage } from '../shared/test-utils';
import { DateTime } from 'luxon';
import { PageLoader } from '../shared/page-loader.service';
import { TYPEAHEAD_DEBOUNCE_TIME } from '../shared/form/typeahead';

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

  expandSearchAccordion() {
    const accordionButton = this.element('button[ngbAccordionButton]');
    if (accordionButton) {
      (accordionButton.nativeElement as HTMLElement).click();
      this.detectChanges();
    }
  }

  setEmbedded(embedded: boolean) {
    this.fixture.componentRef.setInput('embedded', embedded);
    this.detectChanges();
  }
}

describe('LogsComponent', () => {
  let tester: LogsComponentTester;
  let logService: jasmine.SpyObj<LogService>;
  let pageLoader: jasmine.SpyObj<PageLoader>;
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
    pageLoads$ = new BehaviorSubject<number>(0); // Initialize with 0

    // Mock the pageLoads$ observable
    pageLoader.pageLoads$ = pageLoads$.asObservable();

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideRouter([]),
        provideHttpClient(),
        { provide: LogService, useValue: logService },
        { provide: PageLoader, useValue: pageLoader },
        { provide: ActivatedRoute, useValue: route }
      ]
    });

    tester = new LogsComponentTester();
  });

  it('should have empty page', () => {
    logService.searchLogs.and.returnValue(of(emptyLogPage));
    tester.detectChanges();

    expect(tester.emptyContainer).toContainText('No log found');
  });

  it('should have log page', fakeAsync(() => {
    logService.searchLogs.and.returnValue(of(logPage));
    tester.detectChanges();
    tick();
    tester.detectChanges();

    // Default timezone is Europe/Paris
    expect(logService.searchLogs).toHaveBeenCalledWith({
      messageContent: null,
      scopeTypes: [],
      scopeIds: [],
      start: '2022-12-31T23:00:00.000Z',
      end: '2023-02-28T23:00:00.000Z',
      levels: ['info', 'error'],
      page: 2
    });
    expect(tester.logs.length).toBe(2);

    expect(tester.logs[0].elements('td').length).toBe(5);
    expect(tester.logs[0].elements('td')[1]).toContainText('1 Jan 2023, 01:00:00');
    expect(tester.logs[0].elements('td')[2]).toContainText('Internal');
    expect(tester.logs[0].elements('td')[3]).toHaveText('');
    expect(tester.logs[0].elements('td')[4]).toContainText('my log 1');

    expect(tester.logs[1].elements('td')[1]).toContainText('2 Jan 2023, 01:00:00');
    expect(tester.logs[1].elements('td')[2]).toContainText('South');
    expect(tester.logs[1].elements('td')[3]).toContainText('My South');
    expect(tester.logs[1].elements('td')[4]).toContainText('my log 2');
  }));

  it('should add selected scope and clear input on typeahead selection', () => {
    const scope: Scope = { scopeId: 'testId', scopeName: 'Test Scope' };

    const event = {
      item: scope,
      preventDefault: jasmine.createSpy('preventDefault')
    } as any;

    const form = tester.componentInstance.searchForm;
    form.controls.scopeIds.setValue('someValue');

    tester.componentInstance.selectScope(event);

    expect(tester.componentInstance.selectedScopes()).toContain(scope);
    expect(form.controls.scopeIds.value).toBe('');
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('should remove selected scope', () => {
    const scopes: Array<Scope> = [
      { scopeId: '1', scopeName: 'A' },
      { scopeId: '2', scopeName: 'B' }
    ];
    tester.componentInstance.selectedScopes.set(scopes);

    tester.componentInstance.removeScope(scopes[0]);

    expect(tester.componentInstance.selectedScopes()).toEqual([scopes[1]]);
  });

  it('should return correct class for known log level', () => {
    const result = tester.componentInstance.getLevelClass('error');
    expect(result).toBe('red-dot');
  });

  it('should fallback to red-dot for unknown log level', () => {
    const result = tester.componentInstance.getLevelClass('unknown' as any);
    expect(result).toBe('red-dot');
  });

  it('should build search params from route', () => {
    const params = tester.componentInstance.toSearchParams(route);
    expect(params.messageContent).toBeNull();
    expect(params.scopeTypes).toEqual([]);
    expect(params.levels).toEqual(['info', 'error']);
    expect(params.page).toBe(2);
  });

  it('should fetch logs periodically if page is 0, no end date, and not paused', fakeAsync(() => {
    pageLoader.pageLoads$ = new BehaviorSubject<number>(0);
    tester.componentInstance.autoReloadPaused.set(false);
    logService.searchLogs.and.returnValue(of(logPage));

    tester.detectChanges();
    tick(10_000); // Advance 10 seconds
    tester.detectChanges();

    expect(logService.searchLogs).toHaveBeenCalledTimes(2); // Initial + after timer
  }));

  describe('Auto-reload functionality', () => {
    beforeEach(() => {
      logService.searchLogs.and.returnValue(of(logPage));
    });

    it('should initially have auto-reload enabled', fakeAsync(() => {
      tester.setEmbedded(false); // Ensure accordion is expanded
      tick(100);

      expect(tester.componentInstance.autoReloadPaused()).toBe(false);
      expect(tester.pauseIcon).toBeTruthy();
      expect(tester.playIcon).toBeFalsy();
    }));

    it('should display pause icon when auto-reload is active', fakeAsync(() => {
      tester.setEmbedded(false);
      tick(100);

      expect(tester.pauseIcon).toBeTruthy();
      expect(tester.playIcon).toBeFalsy();
      expect(tester.autoReloadButton?.nativeElement.title).toBe('Pause auto-reload');
    }));

    it('should display play icon when auto-reload is paused', fakeAsync(() => {
      tester.componentInstance.autoReloadPaused.set(true);
      tester.setEmbedded(false);
      tick(100);

      expect(tester.autoReloadButton).toBeTruthy();
      expect(tester.pauseIcon).toBeFalsy();
      expect(tester.playIcon).toBeTruthy();
      expect(tester.autoReloadButton?.nativeElement.title).toBe('Resume auto-reload');
    }));

    it('should toggle auto-reload state when button is clicked', fakeAsync(() => {
      tester.setEmbedded(false);
      tick(100);

      // Initially not paused
      expect(tester.componentInstance.autoReloadPaused()).toBe(false);
      expect(tester.pauseIcon).toBeTruthy();

      // Click to pause
      tester.autoReloadButton!.click();
      tick(100);
      tester.detectChanges();

      expect(tester.componentInstance.autoReloadPaused()).toBe(true);
      expect(tester.playIcon).toBeTruthy();
      expect(tester.pauseIcon).toBeFalsy();

      // Click to resume
      tester.autoReloadButton!.click();
      tick(100);
      tester.detectChanges();

      expect(tester.componentInstance.autoReloadPaused()).toBe(false);
      expect(tester.pauseIcon).toBeTruthy();
      expect(tester.playIcon).toBeFalsy();
    }));

    it('should not trigger immediate reload when resuming with end date', fakeAsync(() => {
      tester.setEmbedded(false);
      tick(100);

      // Set end date in form
      tester.componentInstance.searchForm.patchValue({ end: '2023-01-01T00:00:00.000Z' });

      // Pause and then resume
      tester.componentInstance.autoReloadPaused.set(true);
      tick(100);
      tester.detectChanges();

      // Ensure button is available before clicking
      expect(tester.autoReloadButton).toBeTruthy();
      tester.autoReloadButton!.click();
      tick(100);

      expect(tester.componentInstance.autoReloadPaused()).toBe(false);
      expect(pageLoader.loadPage).not.toHaveBeenCalled();
    }));

    it('should have both pause/resume and search buttons in the same container', fakeAsync(() => {
      tester.setEmbedded(false);
      tick(100);

      const buttonContainer = tester.element('.d-flex.gap-2');
      expect(buttonContainer).toBeTruthy();
      expect(buttonContainer?.nativeElement.children.length).toBe(2);
      expect(tester.autoReloadButton).toBeTruthy();
      expect(tester.searchButton).toBeTruthy();
    }));

    it('should use correct button classes', fakeAsync(() => {
      tester.setEmbedded(false);
      tick(100);

      expect(tester.autoReloadButton).toBeTruthy();
      expect(tester.autoReloadButton?.nativeElement.classList).toContain('btn');
      expect(tester.autoReloadButton?.nativeElement.classList).toContain('btn-primary');
      expect(tester.searchButton).toBeTruthy();
      expect(tester.searchButton?.nativeElement.classList).toContain('btn');
      expect(tester.searchButton?.nativeElement.classList).toContain('btn-primary');
    }));
  });

  describe('other utility methods and streams', () => {
    it('scopeTypeahead should call service and set noLogMatchingWarning', fakeAsync(() => {
      const scopes1: Array<Scope> = [{ scopeId: '1', scopeName: 'A' }];
      logService.suggestByScopeName.and.returnValue(of(scopes1));
      let result: Array<Scope> | undefined;
      tester.componentInstance.scopeTypeahead(of('foo')).subscribe(r => (result = r));
      tick(TYPEAHEAD_DEBOUNCE_TIME);
      expect(logService.suggestByScopeName).toHaveBeenCalledWith('foo');
      expect(result).toBe(scopes1);
      expect(tester.componentInstance.noLogMatchingWarning()).toBe(false);

      const scopes2: Array<Scope> = [];
      logService.suggestByScopeName.and.returnValue(of(scopes2));
      tester.componentInstance.scopeTypeahead(of('bar')).subscribe(r => (result = r));
      tick(TYPEAHEAD_DEBOUNCE_TIME);
      expect(logService.suggestByScopeName).toHaveBeenCalledWith('bar');
      expect(result).toBe(scopes2);
      expect(tester.componentInstance.noLogMatchingWarning()).toBe(true);
    }));

    it('triggerSearch should navigate with correct queryParams', () => {
      const router = TestBed.inject(Router);
      spyOn(router, 'navigate');

      // patch the form
      tester.componentInstance.searchForm.patchValue({
        start: 'AAA',
        end: 'BBB',
        messageContent: 'MSG',
        levels: ['L1'],
        scopeTypes: ['ST'],
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
          levels: ['L1'],
          scopeTypes: ['ST'],
          scopeIds: ['X'],
          page: 0
        }
      });
    });

    it('ngOnDestroy should unsubscribe the subscription', () => {
      const sub: Subscription = tester.componentInstance.subscription;
      expect(sub.closed).toBe(false);
      tester.componentInstance.ngOnDestroy();
      expect(sub.closed).toBe(true);
    });

    it('selectScope should add a scope, clear input and preventDefault', () => {
      const scope: Scope = { scopeId: '1', scopeName: 'N' };
      const ev: any = { item: scope, preventDefault: jasmine.createSpy() };
      tester.componentInstance.selectScope(ev);
      expect(tester.componentInstance.selectedScopes()).toEqual([scope]);
      expect(tester.componentInstance.searchForm.controls.scopeIds.value).toBe('');
      expect(ev.preventDefault).toHaveBeenCalled();
    });

    it('removeScope should remove the given scope', () => {
      const a: Scope = { scopeId: 'A', scopeName: 'A' };
      const b: Scope = { scopeId: 'B', scopeName: 'B' };
      tester.componentInstance.selectedScopes.set([a, b]);
      tester.componentInstance.removeScope(a);
      expect(tester.componentInstance.selectedScopes()).toEqual([b]);
    });

    it('getLevelClass should return correct class or fallback', () => {
      const cmp = tester.componentInstance;
      expect(cmp.getLevelClass('error')).toBe('red-dot');
      expect(cmp.getLevelClass('warn')).toBe('yellow-dot');
      expect(cmp.getLevelClass('info')).toBe('green-dot');
      expect(cmp.getLevelClass('debug')).toBe('blue-dot');
      expect(cmp.getLevelClass('trace')).toBe('grey-dot');
      // unknown → fallback
      expect(cmp.getLevelClass('nonsense' as any)).toBe('red-dot');
    });
  });
});
