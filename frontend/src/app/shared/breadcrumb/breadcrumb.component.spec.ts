import { TestBed } from '@angular/core/testing';
import { Router, ActivatedRoute, RouterEvent } from '@angular/router';
import { provideRouter } from '@angular/router';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { BreadcrumbComponent } from './breadcrumb.component';
import { NorthConnectorService } from '../../services/north-connector.service';
import { SouthConnectorService } from '../../services/south-connector.service';
import { HistoryQueryService } from '../../services/history-query.service';
import { of, throwError, Subject } from 'rxjs';
import { NorthConnectorDTO, NorthConnectorManifest } from '../../../../../backend/shared/model/north-connector.model';
import { SouthConnectorDTO } from '../../../../../backend/shared/model/south-connector.model';
import { HistoryQueryDTO } from '../../../../../backend/shared/model/history-query.model';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { createMock, MockObject, stubRoute } from '../../../test/vitest-create-mock';

class BreadcrumbComponentTester {
  readonly fixture = TestBed.createComponent(BreadcrumbComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly breadcrumbItems = this.root.getByCss('.breadcrumb-item');
  readonly breadcrumbLinks = this.root.getByCss('.breadcrumb-item a');

  item(index: number) {
    return this.breadcrumbItems.nth(index);
  }
}

describe('BreadcrumbComponent', () => {
  let tester: BreadcrumbComponentTester;
  let router: MockObject<Router>;
  let northConnectorService: MockObject<NorthConnectorService>;
  let southConnectorService: MockObject<SouthConnectorService>;
  let historyQueryService: MockObject<HistoryQueryService>;
  let routerEvents: Subject<RouterEvent>;
  let currentUrl: string;

  const mockNorthConnector: NorthConnectorDTO = {
    id: 'north-1',
    name: 'console-test',
    type: 'console',
    enabled: true,
    description: '',
    settings: {},
    caching: {
      trigger: {
        scanMode: { id: 'scan-mode-1', name: 'scan-mode-1' },
        numberOfElements: 10,
        numberOfFiles: 5
      },
      throttling: {
        runMinDelay: 1000,
        maxSize: 100,
        maxNumberOfElements: 1000
      },
      error: {
        retryInterval: 5000,
        retryCount: 3,
        retentionDuration: 24
      },
      archive: {
        enabled: false,
        retentionDuration: 48
      }
    }
  } as NorthConnectorDTO;

  const mockNorthManifest = {
    id: 'console'
  } as NorthConnectorManifest;

  const mockSouthConnector: SouthConnectorDTO = {
    id: 'south-1',
    name: 'test-south',
    type: 'mqtt',
    enabled: true,
    description: '',
    settings: {}
  } as SouthConnectorDTO;

  const mockHistoryQuery: HistoryQueryDTO = {
    id: 'history-1',
    name: 'test-history',
    status: 'PENDING',
    northType: 'console',
    southType: 'mqtt',
    northSettings: {},
    southSettings: {},
    queryTimeRange: {
      startTime: '2024-01-01T00:00:00Z',
      endTime: '2024-01-02T00:00:00Z',
      maxReadInterval: 3600,
      readDelay: 200
    },
    caching: {
      trigger: {
        scanMode: { id: 'scan-mode-1', name: 'scan-mode-1' },
        numberOfElements: 10,
        numberOfFiles: 5
      },
      throttling: {
        runMinDelay: 1000,
        maxSize: 100,
        maxNumberOfElements: 1000
      },
      error: {
        retryInterval: 5000,
        retryCount: 3,
        retentionDuration: 24
      },
      archive: {
        enabled: false,
        retentionDuration: 48
      }
    }
  } as HistoryQueryDTO;

  beforeEach(() => {
    currentUrl = '/';
    routerEvents = new Subject<RouterEvent>();
    router = createMock(Router);
    Object.defineProperty(router, 'url', {
      get: () => currentUrl,
      configurable: true
    });
    Object.defineProperty(router, 'events', {
      get: () => routerEvents.asObservable(),
      configurable: true
    });

    northConnectorService = createMock(NorthConnectorService);
    southConnectorService = createMock(SouthConnectorService);
    historyQueryService = createMock(HistoryQueryService);

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideI18nTesting(),
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: stubRoute() },
        { provide: NorthConnectorService, useValue: northConnectorService },
        { provide: SouthConnectorService, useValue: southConnectorService },
        { provide: HistoryQueryService, useValue: historyQueryService }
      ]
    });
  });

  async function expectBreadcrumbTexts(texts: Array<string>) {
    await expect.element(tester.breadcrumbItems).toHaveLength(texts.length);
    await Promise.all(texts.map((text, index) => expect.element(tester.item(index)).toHaveTextContent(text)));
  }

  test('should not show breadcrumbs on home page', async () => {
    currentUrl = '/';
    TestBed.overrideProvider(ActivatedRoute, { useValue: stubRoute() });
    tester = new BreadcrumbComponentTester();

    tester.fixture.detectChanges();

    await expect.element(tester.breadcrumbItems).toHaveLength(0);
  });

  describe('North routes', () => {
    test('should show breadcrumb for north list', async () => {
      currentUrl = '/north';
      TestBed.overrideProvider(ActivatedRoute, { useValue: stubRoute() });
      tester = new BreadcrumbComponentTester();

      tester.fixture.detectChanges();

      await expectBreadcrumbTexts(['North']);
    });

    test('should show breadcrumb for north create', async () => {
      currentUrl = '/north/create';
      TestBed.overrideProvider(ActivatedRoute, { useValue: stubRoute() });
      tester = new BreadcrumbComponentTester();

      tester.fixture.detectChanges();

      await expectBreadcrumbTexts(['North', 'Create']);
    });

    test('should show breadcrumb for north detail', async () => {
      currentUrl = '/north/north-1';
      TestBed.overrideProvider(ActivatedRoute, { useValue: stubRoute({ params: { northId: 'north-1' } }) });
      northConnectorService.findById.mockReturnValue(of(mockNorthConnector));
      northConnectorService.getNorthManifest.mockReturnValue(of(mockNorthManifest));
      tester = new BreadcrumbComponentTester();

      tester.fixture.detectChanges();

      await expectBreadcrumbTexts(['North', 'console-test (console)']);
      expect(northConnectorService.findById).toHaveBeenCalledWith('north-1');
    });

    test('should show breadcrumb for north edit', async () => {
      currentUrl = '/north/north-1/edit';
      TestBed.overrideProvider(ActivatedRoute, { useValue: stubRoute({ params: { northId: 'north-1' } }) });
      northConnectorService.findById.mockReturnValue(of(mockNorthConnector));
      northConnectorService.getNorthManifest.mockReturnValue(of(mockNorthManifest));
      tester = new BreadcrumbComponentTester();

      tester.fixture.detectChanges();

      await expectBreadcrumbTexts(['North', 'console-test (console)', 'Edit']);
    });

    test('should show breadcrumb for north cache', async () => {
      currentUrl = '/north/north-1/cache';
      TestBed.overrideProvider(ActivatedRoute, { useValue: stubRoute({ params: { northId: 'north-1' } }) });
      northConnectorService.findById.mockReturnValue(of(mockNorthConnector));
      northConnectorService.getNorthManifest.mockReturnValue(of(mockNorthManifest));
      tester = new BreadcrumbComponentTester();

      tester.fixture.detectChanges();

      await expectBreadcrumbTexts(['North', 'console-test (console)', 'Cache']);
    });

    test('should handle error when loading north connector', async () => {
      currentUrl = '/north/north-1';
      TestBed.overrideProvider(ActivatedRoute, { useValue: stubRoute({ params: { northId: 'north-1' } }) });
      northConnectorService.findById.mockReturnValue(throwError(() => new Error('Not found')));
      tester = new BreadcrumbComponentTester();

      tester.fixture.detectChanges();

      await expectBreadcrumbTexts(['North', 'north-1']);
    });
  });

  describe('South routes', () => {
    test('should show breadcrumb for south list', async () => {
      currentUrl = '/south';
      TestBed.overrideProvider(ActivatedRoute, { useValue: stubRoute() });
      tester = new BreadcrumbComponentTester();

      tester.fixture.detectChanges();

      await expectBreadcrumbTexts(['South']);
    });

    test('should show breadcrumb for south create', async () => {
      currentUrl = '/south/create';
      TestBed.overrideProvider(ActivatedRoute, { useValue: stubRoute() });
      tester = new BreadcrumbComponentTester();

      tester.fixture.detectChanges();

      await expectBreadcrumbTexts(['South', 'Create']);
    });

    test('should show breadcrumb for south detail', async () => {
      currentUrl = '/south/south-1';
      TestBed.overrideProvider(ActivatedRoute, { useValue: stubRoute({ params: { southId: 'south-1' } }) });
      southConnectorService.findById.mockReturnValue(of(mockSouthConnector));
      tester = new BreadcrumbComponentTester();

      tester.fixture.detectChanges();

      await expectBreadcrumbTexts(['South', 'test-south (mqtt)']);
      expect(southConnectorService.findById).toHaveBeenCalledWith('south-1');
    });

    test('should show breadcrumb for south edit', async () => {
      currentUrl = '/south/south-1/edit';
      TestBed.overrideProvider(ActivatedRoute, { useValue: stubRoute({ params: { southId: 'south-1' } }) });
      southConnectorService.findById.mockReturnValue(of(mockSouthConnector));
      tester = new BreadcrumbComponentTester();

      tester.fixture.detectChanges();

      await expectBreadcrumbTexts(['South', 'test-south (mqtt)', 'Edit']);
    });

    test('should handle error when loading south connector', async () => {
      currentUrl = '/south/south-1';
      TestBed.overrideProvider(ActivatedRoute, { useValue: stubRoute({ params: { southId: 'south-1' } }) });
      southConnectorService.findById.mockReturnValue(throwError(() => new Error('Not found')));
      tester = new BreadcrumbComponentTester();

      tester.fixture.detectChanges();

      await expectBreadcrumbTexts(['South', 'south-1']);
    });
  });

  describe('History query routes', () => {
    test('should show breadcrumb for history queries list', async () => {
      currentUrl = '/history-queries';
      TestBed.overrideProvider(ActivatedRoute, { useValue: stubRoute() });
      tester = new BreadcrumbComponentTester();

      tester.fixture.detectChanges();

      await expectBreadcrumbTexts(['History']);
    });

    test('should show breadcrumb for history query create', async () => {
      currentUrl = '/history-queries/create';
      TestBed.overrideProvider(ActivatedRoute, { useValue: stubRoute() });
      tester = new BreadcrumbComponentTester();

      tester.fixture.detectChanges();

      await expectBreadcrumbTexts(['History', 'Create']);
    });

    test('should show breadcrumb for history query detail', async () => {
      currentUrl = '/history-queries/history-1';
      TestBed.overrideProvider(ActivatedRoute, { useValue: stubRoute({ params: { historyQueryId: 'history-1' } }) });
      historyQueryService.findById.mockReturnValue(of(mockHistoryQuery));
      tester = new BreadcrumbComponentTester();

      tester.fixture.detectChanges();

      await expectBreadcrumbTexts(['History', 'test-history']);
      expect(historyQueryService.findById).toHaveBeenCalledWith('history-1');
    });

    test('should show breadcrumb for history query edit', async () => {
      currentUrl = '/history-queries/history-1/edit';
      TestBed.overrideProvider(ActivatedRoute, { useValue: stubRoute({ params: { historyQueryId: 'history-1' } }) });
      historyQueryService.findById.mockReturnValue(of(mockHistoryQuery));
      tester = new BreadcrumbComponentTester();

      tester.fixture.detectChanges();

      await expectBreadcrumbTexts(['History', 'test-history', 'Edit']);
    });

    test('should show breadcrumb for history query cache', async () => {
      currentUrl = '/history-queries/history-1/cache';
      TestBed.overrideProvider(ActivatedRoute, { useValue: stubRoute({ params: { historyQueryId: 'history-1' } }) });
      historyQueryService.findById.mockReturnValue(of(mockHistoryQuery));
      tester = new BreadcrumbComponentTester();

      tester.fixture.detectChanges();

      await expectBreadcrumbTexts(['History', 'test-history', 'Cache']);
    });

    test('should handle error when loading history query', async () => {
      currentUrl = '/history-queries/history-1';
      TestBed.overrideProvider(ActivatedRoute, { useValue: stubRoute({ params: { historyQueryId: 'history-1' } }) });
      historyQueryService.findById.mockReturnValue(throwError(() => new Error('Not found')));
      tester = new BreadcrumbComponentTester();

      tester.fixture.detectChanges();

      await expectBreadcrumbTexts(['History', 'history-1']);
    });
  });

  describe('Engine routes', () => {
    test('should show breadcrumb for engine', async () => {
      currentUrl = '/engine';
      TestBed.overrideProvider(ActivatedRoute, { useValue: stubRoute() });
      tester = new BreadcrumbComponentTester();

      tester.fixture.detectChanges();

      await expectBreadcrumbTexts(['Engine']);
    });

    test('should show breadcrumb for engine edit', async () => {
      currentUrl = '/engine/edit';
      TestBed.overrideProvider(ActivatedRoute, { useValue: stubRoute() });
      tester = new BreadcrumbComponentTester();

      tester.fixture.detectChanges();

      await expectBreadcrumbTexts(['Engine', 'Edit engine settings']);
    });

    test('should show breadcrumb for engine oianalytics', async () => {
      currentUrl = '/engine/oianalytics';
      TestBed.overrideProvider(ActivatedRoute, { useValue: stubRoute() });
      tester = new BreadcrumbComponentTester();

      tester.fixture.detectChanges();

      await expectBreadcrumbTexts(['Engine', 'OIAnalytics registration']);
    });
  });

  describe('Other routes', () => {
    test('should show breadcrumb for logs', async () => {
      currentUrl = '/logs';
      TestBed.overrideProvider(ActivatedRoute, { useValue: stubRoute() });
      tester = new BreadcrumbComponentTester();

      tester.fixture.detectChanges();

      await expectBreadcrumbTexts(['Logs']);
    });

    test('should show breadcrumb for about', async () => {
      currentUrl = '/about';
      TestBed.overrideProvider(ActivatedRoute, { useValue: stubRoute() });
      tester = new BreadcrumbComponentTester();

      tester.fixture.detectChanges();

      await expectBreadcrumbTexts(['About']);
    });

    test('should show breadcrumb for user settings', async () => {
      currentUrl = '/user-settings';
      TestBed.overrideProvider(ActivatedRoute, { useValue: stubRoute() });
      tester = new BreadcrumbComponentTester();

      tester.fixture.detectChanges();

      await expectBreadcrumbTexts(['Settings']);
    });
  });

  describe('Navigation events', () => {
    test('should update breadcrumbs on navigation', async () => {
      currentUrl = '/north';
      TestBed.overrideProvider(ActivatedRoute, { useValue: stubRoute() });
      tester = new BreadcrumbComponentTester();

      tester.fixture.detectChanges();
      await expectBreadcrumbTexts(['North']);

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          provideRouter([]),
          provideI18nTesting(),
          { provide: Router, useValue: router },
          { provide: ActivatedRoute, useValue: stubRoute() },
          { provide: NorthConnectorService, useValue: northConnectorService },
          { provide: SouthConnectorService, useValue: southConnectorService },
          { provide: HistoryQueryService, useValue: historyQueryService }
        ]
      });

      currentUrl = '/south';
      tester = new BreadcrumbComponentTester();

      tester.fixture.detectChanges();
      await expectBreadcrumbTexts(['South']);
    });
  });

  describe('Breadcrumb links', () => {
    test('should make breadcrumb items clickable except the last one', async () => {
      currentUrl = '/north/north-1';
      TestBed.overrideProvider(ActivatedRoute, { useValue: stubRoute({ params: { northId: 'north-1' } }) });
      northConnectorService.findById.mockReturnValue(of(mockNorthConnector));
      northConnectorService.getNorthManifest.mockReturnValue(of(mockNorthManifest));
      tester = new BreadcrumbComponentTester();

      tester.fixture.detectChanges();

      await expectBreadcrumbTexts(['North', 'console-test (console)']);
      await expect.element(tester.breadcrumbLinks).toHaveLength(1);
      await expect.element(tester.breadcrumbLinks.nth(0)).toHaveTextContent('North');
      await expect.element(tester.item(1).getByCss('a')).toHaveLength(0);
    });

    test('should not make the last breadcrumb item a link', async () => {
      currentUrl = '/north/north-1/cache';
      TestBed.overrideProvider(ActivatedRoute, { useValue: stubRoute({ params: { northId: 'north-1' } }) });
      northConnectorService.findById.mockReturnValue(of(mockNorthConnector));
      northConnectorService.getNorthManifest.mockReturnValue(of(mockNorthManifest));
      tester = new BreadcrumbComponentTester();

      tester.fixture.detectChanges();

      await expect.element(tester.item(2).getByCss('a')).toHaveLength(0);
      await expect.element(tester.item(2)).toHaveTextContent('Cache');
    });
  });
});
