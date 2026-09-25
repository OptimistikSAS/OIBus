import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { auditEntityLink, AuditListComponent } from './audit-list.component';
import { provideI18nTesting } from '../../i18n/mock-i18n';
import { AuditService } from '../services/audit.service';
import { ModalService, Modal } from '../shared/modal.service';
import { PageLoader } from '../shared/page-loader.service';
import { AuditLogDTO } from '../../../../backend/shared/model/audit.model';
import { Page } from '../../../../backend/shared/model/types';
import { emptyPage, toPage } from '../shared/test-utils';
import { createMock, MockObject, stubRoute } from '../../test/vitest-create-mock';
import { provideNgbConfigTesting } from '../shared/form/oi-ngb-testing';
import { AuditHistoryModalComponent } from '../shared/audit-history-modal/audit-history-modal.component';

class AuditListComponentTester {
  readonly fixture = TestBed.createComponent(AuditListComponent);
  readonly component = this.fixture.componentInstance;
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly emptyContainer = this.root.getByCss('.empty');
  readonly rows = this.root.getByCss('tbody tr');
  readonly searchButton = this.root.getByCss('#search-button');
  readonly entityTypeSelect = this.root.getByCss('#entity-type');
  readonly viewDetailsButtons = this.root.getByCss('#view-details-button');

  cells(rowIndex: number) {
    return this.rows.nth(rowIndex).getByCss('td');
  }
}

describe('AuditListComponent', () => {
  let tester: AuditListComponentTester;
  let auditService: MockObject<AuditService>;
  let modalService: MockObject<ModalService>;
  let pageLoader: MockObject<PageLoader>;
  let pageLoads$: BehaviorSubject<number>;

  const emptyAuditPage: Page<AuditLogDTO> = emptyPage();
  const auditPage: Page<AuditLogDTO> = toPage([
    {
      id: '1',
      entityType: 'south_connector',
      entityId: 'south1',
      action: 'CREATE',
      previousState: null,
      newState: { name: 'My South' },
      entity: { exists: true, name: 'My South', parentId: null },
      user: { id: 'user1', friendlyName: 'John Doe (john)' },
      createdAt: '2023-01-01T00:00:00.000Z'
    },
    {
      id: '2',
      entityType: 'north_connector',
      entityId: 'north1',
      action: 'UPDATE',
      previousState: { name: 'Old' },
      newState: { name: 'New' },
      entity: { exists: false, name: 'New', parentId: null },
      user: { id: 'oianalytics', friendlyName: 'OIAnalytics' },
      createdAt: '2023-01-02T00:00:00.000Z'
    },
    {
      id: '3',
      entityType: 'north_transformer',
      entityId: 'northTransformer1',
      action: 'CREATE',
      previousState: null,
      newState: { options: {} },
      entity: { exists: true, name: 'My transformer', parentId: 'north2' },
      user: { id: 'system', friendlyName: 'System' },
      createdAt: '2023-01-03T00:00:00.000Z'
    }
  ]);

  const route = stubRoute({
    queryParams: {
      start: '2023-01-01T00:00:00.000Z',
      page: '0'
    }
  });

  beforeEach(() => {
    auditService = createMock(AuditService);
    modalService = createMock(ModalService);
    pageLoader = createMock(PageLoader);
    pageLoads$ = new BehaviorSubject<number>(0);
    pageLoader.pageLoads$ = pageLoads$.asObservable();

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideRouter([]),
        provideHttpClientTesting(),
        provideNgbConfigTesting(),
        { provide: AuditService, useValue: auditService },
        { provide: ModalService, useValue: modalService },
        { provide: PageLoader, useValue: pageLoader },
        { provide: ActivatedRoute, useValue: route }
      ]
    });

    tester = new AuditListComponentTester();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('should have empty page', async () => {
    auditService.search.mockReturnValue(of(emptyAuditPage));
    tester.fixture.detectChanges();

    await expect.element(tester.emptyContainer).toMatchTextContent('No audit log found');
  });

  test('should load the default search on init and render results', async () => {
    auditService.search.mockReturnValue(of(auditPage));
    tester.fixture.detectChanges();

    await vi.waitFor(() => {
      expect(auditService.search).toHaveBeenCalledWith({
        entityType: undefined,
        action: undefined,
        start: '2023-01-01T00:00:00.000Z',
        end: undefined,
        page: 0
      });
    });
    tester.fixture.detectChanges();

    await expect.element(tester.rows).toHaveLength(3);
    // action and date in the same column
    await expect.element(tester.cells(0).nth(0).getByCss('.badge')).toHaveTextContent('Create');
    await expect.element(tester.cells(0).nth(0)).toMatchTextContent(/Create.*2023/);
    await expect.element(tester.cells(0).nth(1)).toMatchTextContent('John Doe (john)');
    // entity type and entity name in the same column
    await expect.element(tester.cells(0).nth(2)).toMatchTextContent('South connector: My South');
    await expect.element(tester.cells(0).nth(2).getByCss('a')).toHaveAttribute('href', '/south/south1');

    // deleted entity: last known name, no link
    await expect.element(tester.cells(1).nth(1)).toMatchTextContent('OIAnalytics');
    await expect.element(tester.cells(1).nth(2)).toMatchTextContent('North connector: New');
    await expect.element(tester.cells(1).nth(2).getByCss('a')).not.toBeInTheDocument();
    await expect.element(tester.cells(1).nth(2).getByCss('.text-muted')).toBeInTheDocument();

    // child entity linked to its owning connector
    await expect.element(tester.cells(2).nth(1)).toMatchTextContent('System');
    await expect.element(tester.cells(2).nth(2).getByCss('a')).toHaveAttribute('href', '/north/north2');
  });

  test('should search the last week by default', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2023-01-10T12:00:30.000Z'));
    const params = tester.component.toSearchParams(stubRoute({ queryParams: {} }) as unknown as ActivatedRoute);
    expect(new Date(params.start!).toISOString()).toBe('2023-01-03T12:00:59.999Z');
  });

  test('should trigger a new search with the selected entity type filter', () => {
    auditService.search.mockReturnValue(of(auditPage));
    tester.fixture.detectChanges();

    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockImplementation(() => Promise.resolve(true));

    tester.component.searchForm.controls.entityType.setValue('north_connector');
    tester.component.triggerSearch();

    expect(navigateSpy).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ queryParams: expect.objectContaining({ entityType: 'north_connector', page: 0 }) })
    );
  });

  test('should open the history modal with the entry entity type and id when viewing details', async () => {
    auditService.search.mockReturnValue(of(auditPage));

    const modalInstance = { prepare: vi.fn() };
    const modalRef = { componentInstance: modalInstance } as unknown as Modal<AuditHistoryModalComponent>;
    modalService.open.mockReturnValue(modalRef);

    tester.fixture.detectChanges();
    await vi.waitFor(() => {
      expect(auditService.search).toHaveBeenCalled();
    });
    tester.fixture.detectChanges();

    await tester.viewDetailsButtons.first().click();

    expect(modalService.open).toHaveBeenCalledWith(AuditHistoryModalComponent, { size: 'xl' });
    expect(modalInstance.prepare).toHaveBeenCalledWith('south_connector', 'south1');
  });

  describe('auditEntityLink()', () => {
    const entry = (entityType: AuditLogDTO['entityType'], exists = true, parentId: string | null = 'parent1'): AuditLogDTO => ({
      id: '1',
      entityType,
      entityId: 'entity1',
      action: 'UPDATE',
      previousState: null,
      newState: null,
      entity: { exists, name: 'name', parentId },
      user: { id: 'user1', friendlyName: 'user' },
      createdAt: '2023-01-01T00:00:00.000Z'
    });

    test('should link connectors and history queries to their page', () => {
      expect(auditEntityLink(entry('south_connector', true, null))).toEqual(['/south', 'entity1']);
      expect(auditEntityLink(entry('north_connector', true, null))).toEqual(['/north', 'entity1']);
      expect(auditEntityLink(entry('history_query', true, null))).toEqual(['/history-queries', 'entity1']);
    });

    test('should link child entities to their owning entity page', () => {
      expect(auditEntityLink(entry('south_item'))).toEqual(['/south', 'parent1']);
      expect(auditEntityLink(entry('south_item_group'))).toEqual(['/south', 'parent1']);
      expect(auditEntityLink(entry('configuration_workflow'))).toEqual(['/south', 'parent1']);
      expect(auditEntityLink(entry('north_transformer'))).toEqual(['/north', 'parent1']);
      expect(auditEntityLink(entry('history_query_item'))).toEqual(['/history-queries', 'parent1']);
      expect(auditEntityLink(entry('history_query_transformer'))).toEqual(['/history-queries', 'parent1']);
      expect(auditEntityLink(entry('south_item', true, null))).toBeNull();
    });

    test('should link engine-level entities to the engine page', () => {
      for (const entityType of ['scan_mode', 'ip_filter', 'certificate', 'transformer', 'engine'] as const) {
        expect(auditEntityLink(entry(entityType, true, null))).toEqual(['/engine']);
      }
      expect(auditEntityLink(entry('oianalytics_registration', true, null))).toEqual(['/engine', 'oianalytics']);
    });

    test('should not link users nor deleted entities', () => {
      expect(auditEntityLink(entry('user', true, null))).toBeNull();
      expect(auditEntityLink(entry('south_connector', false, null))).toBeNull();
    });
  });

  test('ngOnDestroy should unsubscribe the subscription', () => {
    const sub = tester.component.subscription;
    expect(sub.closed).toBe(false);
    tester.component.ngOnDestroy();
    expect(sub.closed).toBe(true);
  });
});
