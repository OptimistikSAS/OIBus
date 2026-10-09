import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { AuditLogDTO } from '@oibus/shared/api/audit.model';
import { Page } from '@oibus/shared/common/types';

import { provideI18nTesting } from '../../i18n/mock-i18n';
import { createMock, MockObject } from '../../test/vitest-create-mock';
import { AuditService } from '../services/audit.service';
import { AuditHistoryModalComponent } from '../shared/audit-history-modal/audit-history-modal.component';
import { provideCurrentUser } from '../shared/current-user-testing';
import { provideNgbConfigTesting } from '../shared/form/oi-ngb-testing';
import { MockModalService, provideModalTesting } from '../shared/mock-modal.service.testing';
import { emptyPage, toPage } from '../shared/utils/page.utils';
import { auditEntityLink, AuditListComponent } from './audit-list.component';

class AuditListComponentTester {
  readonly root = page.elementLocator(document.body);
  readonly emptyContainer = this.root.getByText('No audit log found');
  readonly rows = this.root.getByCss('tbody tr');
  readonly entityTypeSelect = this.root.getByLabelText('Entity type');
  readonly actionSelect = this.root.getByLabelText('Action', { exact: true });
  readonly start = this.root.getByCss('oib-datetimepicker#start');
  readonly end = this.root.getByCss('oib-datetimepicker#end');
  readonly searchButton = this.root.getByRole('button', { name: 'Search' });
  readonly viewDetailsButtons = this.root.getByRole('button', { name: 'View audit log details' });
  readonly nextPage = this.root.getByRole('link', { name: '2', exact: true });

  constructor(readonly harness: RouterTestingHarness) {}

  cells(rowIndex: number) {
    return this.rows.nth(rowIndex).getByCss('td');
  }
}

describe('AuditListComponent', () => {
  let tester: AuditListComponentTester;
  let auditService: MockObject<AuditService>;

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

  async function navigate(url: string) {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, AuditListComponent);
    return new AuditListComponentTester(harness);
  }

  beforeEach(() => {
    auditService = createMock(AuditService);
    auditService.search.mockReturnValue(of(emptyPage<AuditLogDTO>()));

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideRouter([{ path: 'audit', component: AuditListComponent }]),
        provideNgbConfigTesting(),
        provideModalTesting(),
        provideCurrentUser(),
        { provide: AuditService, useValue: auditService }
      ]
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('should display a message when there is no audit log', async () => {
    tester = await navigate('/audit?start=2023-01-01T00:00:00.000Z');

    await expect.element(tester.emptyContainer).toBeVisible();
    await expect.element(tester.rows).not.toBeInTheDocument();
  });

  test('should load the search from the query params and render the results', async () => {
    auditService.search.mockReturnValue(of(auditPage));
    tester = await navigate('/audit?start=2023-01-01T00:00:00.000Z&page=0');

    expect(auditService.search).toHaveBeenCalledWith({
      entityType: undefined,
      action: undefined,
      start: '2023-01-01T00:00:00.000Z',
      end: undefined,
      page: 0
    });
    await expect.element(tester.rows).toHaveLength(3);
    // action and date in the same column
    await expect.element(tester.cells(0).nth(0).getByCss('.badge')).toHaveTextContent('Create');
    await expect.element(tester.cells(0).nth(0)).toMatchTextContent(/Create.*2023/);
    await expect.element(tester.cells(0).nth(1)).toHaveTextContent('John Doe (john)');
    // entity type and entity name in the same column
    await expect.element(tester.cells(0).nth(2)).toHaveTextContent('South connector: My South');
    await expect.element(tester.cells(0).nth(2).getByRole('link')).toHaveAttribute('href', '/south/south1');

    // deleted entity: last known name, no link
    await expect.element(tester.cells(1).nth(1)).toHaveTextContent('OIAnalytics');
    await expect.element(tester.cells(1).nth(2)).toHaveTextContent('North connector: New');
    await expect.element(tester.cells(1).nth(2).getByRole('link')).not.toBeInTheDocument();
    await expect.element(tester.cells(1).nth(2).getByText('New')).toHaveClass('text-muted');

    // child entity linked to its owning connector
    await expect.element(tester.cells(2).nth(1)).toHaveTextContent('System');
    await expect.element(tester.cells(2).nth(2).getByRole('link')).toHaveAttribute('href', '/north/north2');
  });

  test('should search the last week by default', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2023-01-10T12:00:30.000Z'));

    tester = await navigate('/audit');

    expect(auditService.search).toHaveBeenCalledWith(expect.objectContaining({ page: 0 }));
    expect(new Date(auditService.search.mock.lastCall![0].start!).toISOString()).toBe('2023-01-03T12:00:59.999Z');
  });

  test('should fill the search form from the query params', async () => {
    tester = await navigate('/audit?entityType=north_connector&action=DELETE&start=2023-01-01T00:00:00.000Z&end=2023-01-05T09:00:00.000Z');

    await expect.element(tester.entityTypeSelect).toHaveDisplayValue('North connector');
    await expect.element(tester.actionSelect).toHaveDisplayValue('Delete');
    await expect.element(tester.start).toHaveDisplayedDate('01/01/2023 01:00');
    await expect.element(tester.end).toHaveDisplayedDate('05/01/2023 10:00');
    expect(auditService.search).toHaveBeenCalledWith({
      entityType: 'north_connector',
      action: 'DELETE',
      start: '2023-01-01T00:00:00.000Z',
      end: '2023-01-05T09:00:00.000Z',
      page: 0
    });
  });

  test.each([
    {
      filter: 'entity type',
      fill: (t: AuditListComponentTester) => t.entityTypeSelect.selectOptions('North connector'),
      expected: { entityType: 'north_connector' }
    },
    {
      filter: 'action',
      fill: (t: AuditListComponentTester) => t.actionSelect.selectOptions('Update'),
      expected: { action: 'UPDATE' }
    },
    {
      filter: 'end date',
      fill: (t: AuditListComponentTester) => t.end.fillWithDate('05/01/2023', '10', '00'),
      expected: { end: '2023-01-05T09:00:00.000Z' }
    }
  ])('should navigate and search with the $filter filter', async ({ fill, expected }) => {
    tester = await navigate('/audit?start=2023-01-01T00:00:00.000Z&page=2');
    auditService.search.mockClear();

    await fill(tester);
    await tester.searchButton.click();

    await vi.waitFor(() =>
      expect(auditService.search).toHaveBeenCalledWith({
        entityType: undefined,
        action: undefined,
        start: '2023-01-01T00:00:00.000Z',
        end: undefined,
        ...expected,
        page: 0
      })
    );
    const queryParams = TestBed.inject(Router).routerState.snapshot.root.queryParams;
    expect(queryParams).toEqual({ start: '2023-01-01T00:00:00.000Z', page: '0', ...expected });
  });

  test('should not search when the end date is before the start date', async () => {
    tester = await navigate('/audit?start=2023-01-10T00:00:00.000Z');
    auditService.search.mockClear();

    await tester.end.fillWithDate('05/01/2023', '10', '00');
    await tester.searchButton.click();

    await tester.harness.fixture.whenStable();
    expect(auditService.search).not.toHaveBeenCalled();
    expect(TestBed.inject(Router).url).toBe('/audit?start=2023-01-10T00:00:00.000Z');
  });

  test('should load another page through the pagination', async () => {
    auditService.search.mockReturnValue(of(toPage(auditPage.content, 60, 0, 20)));
    tester = await navigate('/audit?start=2023-01-01T00:00:00.000Z');

    await tester.nextPage.click();

    await vi.waitFor(() => expect(auditService.search).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 })));
    expect(TestBed.inject(Router).url).toBe('/audit?start=2023-01-01T00:00:00.000Z&page=1');
  });

  test('should stop loading when the search fails', async () => {
    auditService.search.mockReturnValue(throwError(() => new Error('search failed')));
    tester = await navigate('/audit?start=2023-01-01T00:00:00.000Z');

    await expect.element(tester.searchButton).toBeEnabled();
    await expect.element(tester.emptyContainer).toBeVisible();
  });

  test('should open the history modal with the entry entity type and id when viewing details', async () => {
    auditService.search.mockReturnValue(of(auditPage));
    const modalService = TestBed.inject(MockModalService<AuditHistoryModalComponent>);
    const fakeModal = createMock(AuditHistoryModalComponent);
    modalService.mockClosedModal(fakeModal);
    const open = vi.spyOn(modalService, 'open');
    tester = await navigate('/audit?start=2023-01-01T00:00:00.000Z');

    await tester.viewDetailsButtons.first().click();

    expect(open).toHaveBeenCalledWith(AuditHistoryModalComponent, { size: 'xl' });
    expect(fakeModal.prepare).toHaveBeenCalledWith('south_connector', 'south1');
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

    test.each<{ entry: AuditLogDTO; link: Array<string> | null }>([
      // connectors and history queries: their own page
      { entry: entry('south_connector', true, null), link: ['/south', 'entity1'] },
      { entry: entry('north_connector', true, null), link: ['/north', 'entity1'] },
      { entry: entry('history_query', true, null), link: ['/history-queries', 'entity1'] },
      // child entities: the page of their owning entity
      { entry: entry('south_item'), link: ['/south', 'parent1'] },
      { entry: entry('south_item_group'), link: ['/south', 'parent1'] },
      { entry: entry('configuration_workflow'), link: ['/south', 'parent1'] },
      { entry: entry('north_transformer'), link: ['/north', 'parent1'] },
      { entry: entry('history_query_item'), link: ['/history-queries', 'parent1'] },
      { entry: entry('history_query_transformer'), link: ['/history-queries', 'parent1'] },
      { entry: entry('south_item', true, null), link: null },
      { entry: entry('north_transformer', true, null), link: null },
      { entry: entry('history_query_item', true, null), link: null },
      // engine-level entities: the engine page
      { entry: entry('scan_mode', true, null), link: ['/engine'] },
      { entry: entry('ip_filter', true, null), link: ['/engine'] },
      { entry: entry('certificate', true, null), link: ['/engine'] },
      { entry: entry('transformer', true, null), link: ['/engine'] },
      { entry: entry('engine_general', true, null), link: ['/engine'] },
      { entry: entry('engine_web_server', true, null), link: ['/engine'] },
      { entry: entry('engine_proxy_server', true, null), link: ['/engine'] },
      { entry: entry('engine_logging', true, null), link: ['/engine'] },
      { entry: entry('oianalytics_registration', true, null), link: ['/engine', 'oianalytics'] },
      // users and deleted entities: no link
      { entry: entry('user', true, null), link: null },
      { entry: entry('south_connector', false, null), link: null }
    ])('should link $entry.entityType (exists: $entry.entity.exists, parent: $entry.entity.parentId) to $link', ({ entry, link }) => {
      expect(auditEntityLink(entry)).toEqual(link);
    });
  });
});
