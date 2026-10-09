import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { of } from 'rxjs';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { HistoryQueryLightDTO } from '@oibus/shared/api/history-query.model';

import { provideI18nTesting } from '../../i18n/mock-i18n';
import { EmptyRouteComponent } from '../../test/empty-route.component';
import testData from '../../test/test-data';
import { createMock, MockObject } from '../../test/vitest-create-mock';
import { HistoryQueryService } from '../services/history-query.service';
import { AuditHistoryModalComponent } from '../shared/audit-history-modal/audit-history-modal.component';
import { ConfirmationService } from '../shared/confirmation.service';
import { provideCurrentUser } from '../shared/current-user-testing';
import { MockModalService, provideModalTesting } from '../shared/mock-modal.service.testing';
import { NotificationService } from '../shared/notification.service';
import { CreateHistoryQueryModalComponent } from './create-history-query-modal/create-history-query-modal.component';
import { HistoryQueryListComponent } from './history-query-list.component';

class HistoryQueryListComponentTester {
  readonly fixture = TestBed.createComponent(HistoryQueryListComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly rows = this.root.getByCss('tbody tr');
  readonly createButton = this.root.getByRole('button', { name: 'Create a new history query' });
  readonly nameFilter = this.root.getByLabelText('Name');
  readonly clearButton = this.root.getByRole('button', { name: 'Clear' });
  readonly none = this.root.getByText('No History query');
  readonly pagination = this.root.getByCss('oib-pagination');

  cell(row: number, column: number) {
    return this.rows.nth(row).getByRole('cell').nth(column);
  }

  /** The names of the displayed history queries, in order */
  async expectNames(...names: Array<string>) {
    await expect.element(this.rows).toHaveLength(names.length);
    for (const [index, name] of names.entries()) {
      await expect.element(this.cell(index, 1)).toHaveTextContent(name);
    }
  }
}

const [running, pending] = testData.historyQueries.listLight;
const queries: Array<HistoryQueryLightDTO> = [
  { ...running, updatedAt: '2020-03-02T00:00:00.000Z' },
  { ...pending, updatedAt: '2020-03-03T00:00:00.000Z' },
  {
    ...pending,
    id: 'historyId3',
    name: 'Another query',
    status: 'FINISHED',
    southType: 'opcua',
    northType: 'console',
    updatedAt: '2020-03-01T00:00:00.000Z'
  }
];

describe('HistoryQueryListComponent', () => {
  let historyQueryService: MockObject<HistoryQueryService>;
  let confirmationService: MockObject<ConfirmationService>;
  let notificationService: MockObject<NotificationService>;

  beforeEach(() => {
    historyQueryService = createMock(HistoryQueryService);
    confirmationService = createMock(ConfirmationService);
    notificationService = createMock(NotificationService);

    historyQueryService.list.mockReturnValue(of(queries));
    historyQueryService.start.mockReturnValue(of(undefined));
    historyQueryService.pause.mockReturnValue(of(undefined));
    historyQueryService.delete.mockReturnValue(of(undefined));
    confirmationService.confirm.mockReturnValue(of(undefined));

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideCurrentUser(),
        provideRouter([{ path: 'history-queries/create', component: EmptyRouteComponent }]),
        provideModalTesting(),
        { provide: HistoryQueryService, useValue: historyQueryService },
        { provide: NotificationService, useValue: notificationService },
        { provide: ConfirmationService, useValue: confirmationService }
      ]
    });
  });

  test('should display the history queries, most recently updated first', async () => {
    const tester = new HistoryQueryListComponentTester();

    await tester.expectNames('My second History Query', 'my first History Query', 'Another query');
    await expect.element(tester.cell(1, 0).getByRole('img')).toHaveAccessibleName('Running');
    await expect.element(tester.cell(1, 3)).toHaveTextContent('Microsoft SQL Server™');
    await expect.element(tester.cell(1, 4)).toHaveTextContent('OIAnalytics®');
    await expect.element(tester.pagination).not.toBeInTheDocument();
  });

  test('should display a message when there is no history query', async () => {
    historyQueryService.list.mockReturnValue(of([]));
    const tester = new HistoryQueryListComponentTester();

    await expect.element(tester.none).toBeInTheDocument();
    await expect.element(tester.rows).not.toBeInTheDocument();
  });

  test('should paginate the history queries', async () => {
    const manyQueries = Array.from({ length: 20 }, (_, index) => ({ ...running, id: `id${index}`, name: `query ${index}` }));
    historyQueryService.list.mockReturnValue(of(manyQueries));
    const tester = new HistoryQueryListComponentTester();

    await expect.element(tester.rows).toHaveLength(15);
    await tester.pagination.getByRole('link', { name: '2' }).click();

    await expect.element(tester.rows).toHaveLength(5);
  });

  test('should sort by a column, then reverse the sort', async () => {
    const tester = new HistoryQueryListComponentTester();
    const southTypeHeader = tester.root.getByRole('button', { name: 'South type' });

    await southTypeHeader.click();
    await tester.expectNames('my first History Query', 'My second History Query', 'Another query');

    await southTypeHeader.click();
    await tester.expectNames('Another query', 'my first History Query', 'My second History Query');

    await tester.root.getByRole('button', { name: 'Name', exact: true }).click();
    await tester.expectNames('Another query', 'my first History Query', 'My second History Query');
  });

  test('should filter the list by name', async () => {
    const tester = new HistoryQueryListComponentTester();

    await tester.nameFilter.fill('FIRST');

    await tester.expectNames('my first History Query');
  });

  test('should filter the list by toggling a status filter, and clear it', async () => {
    const tester = new HistoryQueryListComponentTester();
    const runningChip = tester.root.getByRole('button', { name: 'Running' });

    await runningChip.click();
    await tester.expectNames('my first History Query');
    await expect.element(runningChip).toHaveClass('active');

    await tester.root.getByRole('button', { name: 'Finished' }).click();
    await tester.expectNames('my first History Query', 'Another query');

    await tester.clearButton.click();
    await expect.element(tester.rows).toHaveLength(3);
    await expect.element(tester.clearButton).not.toBeInTheDocument();
  });

  test('should filter the list by south type', async () => {
    const tester = new HistoryQueryListComponentTester();

    await tester.root.getByRole('button', { name: 'OPC UA™' }).click();
    await tester.expectNames('Another query');

    await tester.clearButton.click();
    await tester.root.getByRole('button', { name: 'Microsoft SQL Server™' }).click();
    await expect.element(tester.rows).toHaveLength(2);
  });

  test('should filter the list by north type', async () => {
    const tester = new HistoryQueryListComponentTester();

    await tester.root.getByRole('button', { name: 'File writer' }).click();

    await tester.expectNames('My second History Query');
  });

  test('should display the item progress indicator when numberOfItems is set', async () => {
    historyQueryService.list.mockReturnValue(of([{ ...running, currentItemNumber: 3, numberOfItems: 10 }, pending]));
    const tester = new HistoryQueryListComponentTester();

    await expect.element(tester.cell(0, 0)).toHaveTextContent('(3 / 10)');
    await expect.element(tester.cell(1, 0)).toHaveTextContent('');
  });

  test('should start a pending history query', async () => {
    const tester = new HistoryQueryListComponentTester();

    await tester.rows.nth(0).getByRole('button', { name: 'Start history query' }).click();

    expect(historyQueryService.start).toHaveBeenCalledWith(pending.id);
    expect(historyQueryService.list).toHaveBeenCalledTimes(2);
    expect(notificationService.success).toHaveBeenCalledWith('history-query.started', { name: pending.name });
  });

  test('should pause a running history query and restart a finished one', async () => {
    const tester = new HistoryQueryListComponentTester();

    await tester.rows.nth(1).getByRole('button', { name: 'Pause history query' }).click();
    expect(historyQueryService.pause).toHaveBeenCalledWith(running.id);
    expect(notificationService.success).toHaveBeenCalledWith('history-query.paused', { name: running.name });

    await tester.rows.nth(2).getByRole('button', { name: 'Restart history query' }).click();
    expect(historyQueryService.start).toHaveBeenCalledWith('historyId3');
  });

  test('should delete a history query after confirmation', async () => {
    const tester = new HistoryQueryListComponentTester();
    await expect.element(tester.rows).toHaveLength(3);
    historyQueryService.list.mockReturnValue(of(queries.slice(1)));

    await tester.rows.nth(1).getByRole('button', { name: 'Delete history query' }).click();

    expect(confirmationService.confirm).toHaveBeenCalledWith({
      messageKey: 'history-query.confirm-deletion',
      interpolateParams: { name: running.name }
    });
    expect(historyQueryService.delete).toHaveBeenCalledWith(running.id);
    expect(notificationService.success).toHaveBeenCalledWith('history-query.deleted', { name: running.name });
    await tester.expectNames('My second History Query', 'Another query');
  });

  test('should open the creation modal and navigate to the creation page', async () => {
    const createModal = createMock(CreateHistoryQueryModalComponent);
    TestBed.inject<MockModalService<CreateHistoryQueryModalComponent>>(MockModalService).mockClosedModal(createModal, {
      southType: 'mssql',
      northType: 'console'
    });
    const tester = new HistoryQueryListComponentTester();

    await tester.createButton.click();

    await vi.waitFor(() => expect(TestBed.inject(Router).url).toBe('/history-queries/create?southType=mssql&northType=console'));
  });

  test('should open the audit history modal with the history query entity type and id', async () => {
    const auditModal = createMock(AuditHistoryModalComponent);
    TestBed.inject<MockModalService<AuditHistoryModalComponent>>(MockModalService).mockClosedModal(auditModal);
    const tester = new HistoryQueryListComponentTester();

    await tester.rows.nth(1).getByRole('button', { name: 'View history query audit history' }).click();

    expect(auditModal.prepare).toHaveBeenCalledWith('history_query', running.id);
  });
});
