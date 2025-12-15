import { TestBed } from '@angular/core/testing';
import { Router, ActivatedRoute, RouterEvent } from '@angular/router';
import { ComponentTester, createMock, stubRoute } from 'ngx-speculoos';
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

class BreadcrumbComponentTester extends ComponentTester<BreadcrumbComponent> {
  constructor() {
    super(BreadcrumbComponent);
  }

  get breadcrumbItems() {
    return this.elements('.breadcrumb-item');
  }

  get breadcrumbLinks() {
    return this.elements('.breadcrumb-item a');
  }
}

describe('BreadcrumbComponent', () => {
  let tester: BreadcrumbComponentTester;
  let router: jasmine.SpyObj<Router>;
  let northConnectorService: jasmine.SpyObj<NorthConnectorService>;
  let southConnectorService: jasmine.SpyObj<SouthConnectorService>;
  let historyQueryService: jasmine.SpyObj<HistoryQueryService>;
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
    startTime: '2024-01-01T00:00:00Z',
    endTime: '2024-01-02T00:00:00Z',
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

  it('should create', () => {
    tester = new BreadcrumbComponentTester();
    expect(tester.componentInstance).toBeTruthy();
  });

  it('should not show breadcrumbs on home page', async () => {
    currentUrl = '/';
    TestBed.overrideProvider(ActivatedRoute, { useValue: stubRoute() });
    tester = new BreadcrumbComponentTester();

    await tester.change();

    expect(tester.breadcrumbItems.length).toBe(0);
  });

  describe('North routes', () => {
    it('should show breadcrumb for north list', async () => {
      currentUrl = '/north';
      TestBed.overrideProvider(ActivatedRoute, { useValue: stubRoute() });
      tester = new BreadcrumbComponentTester();

      await tester.change();

      expect(tester.breadcrumbItems.length).toBe(1);
      expect(tester.breadcrumbItems[0]).toContainText('North');
    });

    it('should show breadcrumb for north create', async () => {
      currentUrl = '/north/create';
      TestBed.overrideProvider(ActivatedRoute, { useValue: stubRoute() });
      tester = new BreadcrumbComponentTester();

      await tester.change();

      expect(tester.breadcrumbItems.length).toBe(2);
      expect(tester.breadcrumbItems[0]).toContainText('North');
      expect(tester.breadcrumbItems[1]).toContainText('Create');
    });

    it('should show breadcrumb for north detail', async () => {
      currentUrl = '/north/north-1';
      TestBed.overrideProvider(ActivatedRoute, { useValue: stubRoute({ params: { northId: 'north-1' } }) });
      northConnectorService.findById.and.returnValue(of(mockNorthConnector));
      northConnectorService.getNorthManifest.and.returnValue(of(mockNorthManifest));
      tester = new BreadcrumbComponentTester();

      await tester.change();

      expect(tester.breadcrumbItems.length).toBe(2);
      expect(tester.breadcrumbItems[0]).toContainText('North');
      expect(tester.breadcrumbItems[1]).toContainText('console-test (console)');
      expect(northConnectorService.findById).toHaveBeenCalledWith('north-1');
    });

    it('should show breadcrumb for north edit', async () => {
      currentUrl = '/north/north-1/edit';
      TestBed.overrideProvider(ActivatedRoute, { useValue: stubRoute({ params: { northId: 'north-1' } }) });
      northConnectorService.findById.and.returnValue(of(mockNorthConnector));
      northConnectorService.getNorthManifest.and.returnValue(of(mockNorthManifest));
      tester = new BreadcrumbComponentTester();

      await tester.change();

      expect(tester.breadcrumbItems.length).toBe(3);
      expect(tester.breadcrumbItems[0]).toContainText('North');
      expect(tester.breadcrumbItems[1]).toContainText('console-test (console)');
      expect(tester.breadcrumbItems[2]).toContainText('Edit');
    });

    it('should show breadcrumb for north cache', async () => {
      currentUrl = '/north/north-1/cache';
      TestBed.overrideProvider(ActivatedRoute, { useValue: stubRoute({ params: { northId: 'north-1' } }) });
      northConnectorService.findById.and.returnValue(of(mockNorthConnector));
      northConnectorService.getNorthManifest.and.returnValue(of(mockNorthManifest));
      tester = new BreadcrumbComponentTester();

      await tester.change();

      expect(tester.breadcrumbItems.length).toBe(3);
      expect(tester.breadcrumbItems[0]).toContainText('North');
      expect(tester.breadcrumbItems[1]).toContainText('console-test (console)');
      expect(tester.breadcrumbItems[2]).toContainText('Cache');
    });

    it('should handle error when loading north connector', async () => {
      currentUrl = '/north/north-1';
      TestBed.overrideProvider(ActivatedRoute, { useValue: stubRoute({ params: { northId: 'north-1' } }) });
      northConnectorService.findById.and.returnValue(throwError(() => new Error('Not found')));
      tester = new BreadcrumbComponentTester();

      await tester.change();

      expect(tester.breadcrumbItems.length).toBe(2);
      expect(tester.breadcrumbItems[0]).toContainText('North');
      expect(tester.breadcrumbItems[1]).toContainText('north-1');
    });
  });

  describe('South routes', () => {
    it('should show breadcrumb for south list', async () => {
      currentUrl = '/south';
      TestBed.overrideProvider(ActivatedRoute, { useValue: stubRoute() });
      tester = new BreadcrumbComponentTester();

      await tester.change();

      expect(tester.breadcrumbItems.length).toBe(1);
      expect(tester.breadcrumbItems[0]).toContainText('South');
    });

    it('should show breadcrumb for south create', async () => {
      currentUrl = '/south/create';
      TestBed.overrideProvider(ActivatedRoute, { useValue: stubRoute() });
      tester = new BreadcrumbComponentTester();

      await tester.change();

      expect(tester.breadcrumbItems.length).toBe(2);
      expect(tester.breadcrumbItems[0]).toContainText('South');
      expect(tester.breadcrumbItems[1]).toContainText('Create');
    });

    it('should show breadcrumb for south detail', async () => {
      currentUrl = '/south/south-1';
      TestBed.overrideProvider(ActivatedRoute, { useValue: stubRoute({ params: { southId: 'south-1' } }) });
      southConnectorService.findById.and.returnValue(of(mockSouthConnector));
      tester = new BreadcrumbComponentTester();

      await tester.change();

      expect(tester.breadcrumbItems.length).toBe(2);
      expect(tester.breadcrumbItems[0]).toContainText('South');
      expect(tester.breadcrumbItems[1]).toContainText('test-south (mqtt)');
      expect(southConnectorService.findById).toHaveBeenCalledWith('south-1');
    });

    it('should show breadcrumb for south edit', async () => {
      currentUrl = '/south/south-1/edit';
      TestBed.overrideProvider(ActivatedRoute, { useValue: stubRoute({ params: { southId: 'south-1' } }) });
      southConnectorService.findById.and.returnValue(of(mockSouthConnector));
      tester = new BreadcrumbComponentTester();

      await tester.change();

      expect(tester.breadcrumbItems.length).toBe(3);
      expect(tester.breadcrumbItems[0]).toContainText('South');
      expect(tester.breadcrumbItems[1]).toContainText('test-south (mqtt)');
      expect(tester.breadcrumbItems[2]).toContainText('Edit');
    });

    it('should handle error when loading south connector', async () => {
      currentUrl = '/south/south-1';
      TestBed.overrideProvider(ActivatedRoute, { useValue: stubRoute({ params: { southId: 'south-1' } }) });
      southConnectorService.findById.and.returnValue(throwError(() => new Error('Not found')));
      tester = new BreadcrumbComponentTester();

      await tester.change();

      expect(tester.breadcrumbItems.length).toBe(2);
      expect(tester.breadcrumbItems[0]).toContainText('South');
      expect(tester.breadcrumbItems[1]).toContainText('south-1');
    });
  });

  describe('History query routes', () => {
    it('should show breadcrumb for history queries list', async () => {
      currentUrl = '/history-queries';
      TestBed.overrideProvider(ActivatedRoute, { useValue: stubRoute() });
      tester = new BreadcrumbComponentTester();

      await tester.change();

      expect(tester.breadcrumbItems.length).toBe(1);
      expect(tester.breadcrumbItems[0]).toContainText('History');
    });

    it('should show breadcrumb for history query create', async () => {
      currentUrl = '/history-queries/create';
      TestBed.overrideProvider(ActivatedRoute, { useValue: stubRoute() });
      tester = new BreadcrumbComponentTester();

      await tester.change();

      expect(tester.breadcrumbItems.length).toBe(2);
      expect(tester.breadcrumbItems[0]).toContainText('History');
      expect(tester.breadcrumbItems[1]).toContainText('Create');
    });

    it('should show breadcrumb for history query detail', async () => {
      currentUrl = '/history-queries/history-1';
      TestBed.overrideProvider(ActivatedRoute, { useValue: stubRoute({ params: { historyQueryId: 'history-1' } }) });
      historyQueryService.findById.and.returnValue(of(mockHistoryQuery));
      tester = new BreadcrumbComponentTester();

      await tester.change();

      expect(tester.breadcrumbItems.length).toBe(2);
      expect(tester.breadcrumbItems[0]).toContainText('History');
      expect(tester.breadcrumbItems[1]).toContainText('test-history');
      expect(historyQueryService.findById).toHaveBeenCalledWith('history-1');
    });

    it('should show breadcrumb for history query edit', async () => {
      currentUrl = '/history-queries/history-1/edit';
      TestBed.overrideProvider(ActivatedRoute, { useValue: stubRoute({ params: { historyQueryId: 'history-1' } }) });
      historyQueryService.findById.and.returnValue(of(mockHistoryQuery));
      tester = new BreadcrumbComponentTester();

      await tester.change();

      expect(tester.breadcrumbItems.length).toBe(3);
      expect(tester.breadcrumbItems[0]).toContainText('History');
      expect(tester.breadcrumbItems[1]).toContainText('test-history');
      expect(tester.breadcrumbItems[2]).toContainText('Edit');
    });

    it('should show breadcrumb for history query cache', async () => {
      currentUrl = '/history-queries/history-1/cache';
      TestBed.overrideProvider(ActivatedRoute, { useValue: stubRoute({ params: { historyQueryId: 'history-1' } }) });
      historyQueryService.findById.and.returnValue(of(mockHistoryQuery));
      tester = new BreadcrumbComponentTester();

      await tester.change();

      expect(tester.breadcrumbItems.length).toBe(3);
      expect(tester.breadcrumbItems[0]).toContainText('History');
      expect(tester.breadcrumbItems[1]).toContainText('test-history');
      expect(tester.breadcrumbItems[2]).toContainText('Cache');
    });

    it('should handle error when loading history query', async () => {
      currentUrl = '/history-queries/history-1';
      TestBed.overrideProvider(ActivatedRoute, { useValue: stubRoute({ params: { historyQueryId: 'history-1' } }) });
      historyQueryService.findById.and.returnValue(throwError(() => new Error('Not found')));
      tester = new BreadcrumbComponentTester();

      await tester.change();

      expect(tester.breadcrumbItems.length).toBe(2);
      expect(tester.breadcrumbItems[0]).toContainText('History');
      expect(tester.breadcrumbItems[1]).toContainText('history-1');
    });
  });

  describe('Engine routes', () => {
    it('should show breadcrumb for engine', async () => {
      currentUrl = '/engine';
      TestBed.overrideProvider(ActivatedRoute, { useValue: stubRoute() });
      tester = new BreadcrumbComponentTester();

      await tester.change();

      expect(tester.breadcrumbItems.length).toBe(1);
      expect(tester.breadcrumbItems[0]).toContainText('Engine');
    });

    it('should show breadcrumb for engine edit', async () => {
      currentUrl = '/engine/edit';
      TestBed.overrideProvider(ActivatedRoute, { useValue: stubRoute() });
      tester = new BreadcrumbComponentTester();

      await tester.change();

      expect(tester.breadcrumbItems.length).toBe(2);
      expect(tester.breadcrumbItems[0]).toContainText('Engine');
      expect(tester.breadcrumbItems[1]).toContainText('Edit engine settings');
    });

    it('should show breadcrumb for engine oianalytics', async () => {
      currentUrl = '/engine/oianalytics';
      TestBed.overrideProvider(ActivatedRoute, { useValue: stubRoute() });
      tester = new BreadcrumbComponentTester();

      await tester.change();

      expect(tester.breadcrumbItems.length).toBe(2);
      expect(tester.breadcrumbItems[0]).toContainText('Engine');
      expect(tester.breadcrumbItems[1]).toContainText('OIAnalytics registration');
    });
  });

  describe('Other routes', () => {
    it('should show breadcrumb for logs', async () => {
      currentUrl = '/logs';
      TestBed.overrideProvider(ActivatedRoute, { useValue: stubRoute() });
      tester = new BreadcrumbComponentTester();

      await tester.change();

      expect(tester.breadcrumbItems.length).toBe(1);
      expect(tester.breadcrumbItems[0]).toContainText('Logs');
    });

    it('should show breadcrumb for about', async () => {
      currentUrl = '/about';
      TestBed.overrideProvider(ActivatedRoute, { useValue: stubRoute() });
      tester = new BreadcrumbComponentTester();

      await tester.change();

      expect(tester.breadcrumbItems.length).toBe(1);
      expect(tester.breadcrumbItems[0]).toContainText('About');
    });

    it('should show breadcrumb for user settings', async () => {
      currentUrl = '/user-settings';
      TestBed.overrideProvider(ActivatedRoute, { useValue: stubRoute() });
      tester = new BreadcrumbComponentTester();

      await tester.change();

      expect(tester.breadcrumbItems.length).toBe(1);
      expect(tester.breadcrumbItems[0]).toContainText('Settings');
    });
  });

  describe('Navigation events', () => {
    it('should update breadcrumbs on navigation', async () => {
      // Test initial state
      currentUrl = '/north';
      TestBed.overrideProvider(ActivatedRoute, { useValue: stubRoute() });
      tester = new BreadcrumbComponentTester();

      await tester.change();
      expect(tester.breadcrumbItems.length).toBe(1);
      expect(tester.breadcrumbItems[0]).toContainText('North');

      // Reset TestBed to allow overriding providers again
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

      // Test navigation to a different route by creating a new component instance
      // This simulates what happens when the router actually navigates
      currentUrl = '/south';
      tester = new BreadcrumbComponentTester();

      await tester.change();
      expect(tester.breadcrumbItems.length).toBe(1);
      expect(tester.breadcrumbItems[0]).toContainText('South');
    });
  });

  describe('Breadcrumb links', () => {
    it('should make breadcrumb items clickable except the last one', async () => {
      currentUrl = '/north/north-1';
      TestBed.overrideProvider(ActivatedRoute, { useValue: stubRoute({ params: { northId: 'north-1' } }) });
      northConnectorService.findById.and.returnValue(of(mockNorthConnector));
      northConnectorService.getNorthManifest.and.returnValue(of(mockNorthManifest));
      tester = new BreadcrumbComponentTester();

      await tester.change();

      // Should have 2 breadcrumb items: "North" (link) and "console-test (console)" (not a link, it's last)
      expect(tester.breadcrumbItems.length).toBe(2);
      // Only the first item should be a link (not the last one)
      expect(tester.breadcrumbLinks.length).toBe(1);
      expect(tester.breadcrumbLinks[0]).toContainText('North');
      // Last item should not be a link
      const lastItem = tester.breadcrumbItems[1];
      expect(lastItem.elements('a').length).toBe(0);
      expect(lastItem).toContainText('console-test (console)');
    });

    it('should not make the last breadcrumb item a link', async () => {
      currentUrl = '/north/north-1/cache';
      TestBed.overrideProvider(ActivatedRoute, { useValue: stubRoute({ params: { northId: 'north-1' } }) });
      northConnectorService.findById.and.returnValue(of(mockNorthConnector));
      northConnectorService.getNorthManifest.and.returnValue(of(mockNorthManifest));
      tester = new BreadcrumbComponentTester();

      await tester.change();

      const lastItem = tester.breadcrumbItems[2];
      expect(lastItem.elements('a').length).toBe(0);
      expect(lastItem).toContainText('Cache');
    });
  });
});
