import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { of } from 'rxjs';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { provideI18nTesting } from '../../i18n/mock-i18n';
import testData from '../../test/test-data';
import { createMock, MockObject } from '../../test/vitest-create-mock';
import { HistoryQueryService } from '../services/history-query.service';
import { AuditHistoryModalComponent } from '../shared/audit-history-modal/audit-history-modal.component';
import { ConfirmationService } from '../shared/confirmation.service';
import { provideModalTesting } from '../shared/mock-modal.service.testing';
import { Modal, ModalService } from '../shared/modal.service';
import { NotificationService } from '../shared/notification.service';
import { HistoryQueryListComponent } from './history-query-list.component';

describe('HistoryQueryListComponent', () => {
  let historyQueryService: MockObject<HistoryQueryService>;
  let modalService: MockObject<ModalService>;

  beforeEach(() => {
    historyQueryService = createMock(HistoryQueryService);
    modalService = createMock(ModalService);

    historyQueryService.list.mockReturnValue(of(testData.historyQueries.listLight));
    historyQueryService.start.mockReturnValue(of(undefined));
    historyQueryService.pause.mockReturnValue(of(undefined));

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideRouter([]),
        provideHttpClientTesting(),
        provideModalTesting(),
        { provide: HistoryQueryService, useValue: historyQueryService },
        { provide: NotificationService, useValue: createMock(NotificationService) },
        { provide: ConfirmationService, useValue: createMock(ConfirmationService) },
        { provide: ModalService, useValue: modalService }
      ]
    });
  });

  test('should display the history query list', async () => {
    const fixture = TestBed.createComponent(HistoryQueryListComponent);
    fixture.detectChanges();

    const root = page.elementLocator(fixture.nativeElement);
    const rows = root.getByCss('tbody tr');
    await expect.element(rows).toHaveLength(testData.historyQueries.listLight.length);

    const firstRowCells = rows.nth(0).getByCss('td');
    await expect.element(firstRowCells.nth(1)).toMatchTextContent(testData.historyQueries.listLight[0].name);
  });

  test('should create without error', () => {
    const fixture = TestBed.createComponent(HistoryQueryListComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  test('should sort by updated on by default', () => {
    const fixture = TestBed.createComponent(HistoryQueryListComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.sortField).toBe('updatedAt');
    expect(fixture.componentInstance.sortDirection).toBe('desc');
  });

  test('should display south type and north type columns', async () => {
    const fixture = TestBed.createComponent(HistoryQueryListComponent);
    fixture.detectChanges();

    const root = page.elementLocator(fixture.nativeElement);
    const firstRowCells = root.getByCss('tbody tr').nth(0).getByCss('td');
    await expect.element(firstRowCells.nth(3)).toMatchTextContent('Microsoft SQL Server');
    await expect.element(firstRowCells.nth(4)).toMatchTextContent('OIAnalytics');
  });

  test('should filter the list by toggling a status filter', async () => {
    const fixture = TestBed.createComponent(HistoryQueryListComponent);
    const root = page.elementLocator(fixture.nativeElement);
    const rows = root.getByCss('tbody tr');

    await root.getByRole('button', { name: 'Running' }).click();

    await expect.element(rows).toHaveLength(1);
    await expect.element(rows.nth(0)).toMatchTextContent('my first History Query');
  });

  test('should clear the status filter', async () => {
    const fixture = TestBed.createComponent(HistoryQueryListComponent);
    const root = page.elementLocator(fixture.nativeElement);
    const rows = root.getByCss('tbody tr');

    await root.getByRole('button', { name: 'Running' }).click();
    await expect.element(rows).toHaveLength(1);

    await root.getByRole('button', { name: 'Clear' }).click();

    await expect.element(rows).toHaveLength(testData.historyQueries.listLight.length);
    await expect.element(root.getByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
  });

  test('should filter the list by north type', async () => {
    const fixture = TestBed.createComponent(HistoryQueryListComponent);
    const root = page.elementLocator(fixture.nativeElement);
    const rows = root.getByCss('tbody tr');

    await root.getByRole('button', { name: 'File writer' }).click();

    await expect.element(rows).toHaveLength(1);
    await expect.element(rows.nth(0)).toMatchTextContent('My second History Query');
  });

  test('should filter the list by south type', async () => {
    const fixture = TestBed.createComponent(HistoryQueryListComponent);
    const root = page.elementLocator(fixture.nativeElement);
    const rows = root.getByCss('tbody tr');

    await root.getByRole('button', { name: 'Microsoft SQL Server™' }).click();
    await expect.element(rows).toHaveLength(testData.historyQueries.listLight.length);

    await root.getByRole('button', { name: 'Clear' }).click();
    await root.getByRole('button', { name: 'OIAnalytics®' }).click();

    await expect.element(rows).toHaveLength(1);
    await expect.element(rows.nth(0)).toMatchTextContent('my first History Query');
  });

  test('should display the item progress indicator when numberOfItems is set', async () => {
    const queriesWithProgress = testData.historyQueries.listLight.map((query, index) =>
      index === 0 ? { ...query, currentItemNumber: 3, numberOfItems: 10 } : query
    );
    historyQueryService.list.mockReturnValue(of(queriesWithProgress));

    const fixture = TestBed.createComponent(HistoryQueryListComponent);
    fixture.detectChanges();

    const root = page.elementLocator(fixture.nativeElement);
    const firstRowCells = root.getByCss('tbody tr').nth(0).getByCss('td');
    await expect.element(firstRowCells.nth(0)).toMatchTextContent('(3 / 10)');
  });

  test('should not display the item progress indicator when numberOfItems is not set', async () => {
    const fixture = TestBed.createComponent(HistoryQueryListComponent);
    fixture.detectChanges();

    const root = page.elementLocator(fixture.nativeElement);
    const firstRowCells = root.getByCss('tbody tr').nth(0).getByCss('td');
    await expect.element(firstRowCells.nth(0).getByCss('.text-muted')).not.toBeInTheDocument();
  });

  test('should sort by south type when clicking the column header', () => {
    const fixture = TestBed.createComponent(HistoryQueryListComponent);
    fixture.detectChanges();

    fixture.componentInstance.toggleSort('southType');
    expect(fixture.componentInstance.sortField).toBe('southType');
    expect(fixture.componentInstance.sortDirection).toBe('asc');

    fixture.componentInstance.toggleSort('southType');
    expect(fixture.componentInstance.sortDirection).toBe('desc');
  });

  test('should open the audit history modal with the history query entity type and id', async () => {
    const fixture = TestBed.createComponent(HistoryQueryListComponent);
    fixture.detectChanges();

    const fakeModalComponent = createMock(AuditHistoryModalComponent);
    const modalRef = { componentInstance: fakeModalComponent } as unknown as Modal<AuditHistoryModalComponent>;
    modalService.open.mockReturnValue(modalRef);

    const root = page.elementLocator(fixture.nativeElement);
    await root.getByCss('.show-audit-history-query').nth(0).click();

    const query = testData.historyQueries.listLight[0];
    expect(modalService.open).toHaveBeenCalledWith(AuditHistoryModalComponent, { size: 'xl' });
    expect(fakeModalComponent.prepare).toHaveBeenCalledWith('history_query', query.id);
  });
});
