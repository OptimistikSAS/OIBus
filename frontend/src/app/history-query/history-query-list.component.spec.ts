import { TestBed } from '@angular/core/testing';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test } from 'vitest';
import { provideRouter } from '@angular/router';

import { HistoryQueryListComponent } from './history-query-list.component';
import { HistoryQueryService } from '../services/history-query.service';
import { NotificationService } from '../shared/notification.service';
import { ConfirmationService } from '../shared/confirmation.service';
import { Modal, ModalService } from '../shared/modal.service';
import { provideI18nTesting } from '../../i18n/mock-i18n';
import { createMock, MockObject } from '../../test/vitest-create-mock';
import { provideModalTesting } from '../shared/mock-modal.service.testing';
import testData from '../../../../backend/src/tests/utils/test-data';
import { HistoryQueryLightDTO } from '../../../../backend/shared/model/history-query.model';
import { AuditHistoryModalComponent } from '../shared/audit-history-modal/audit-history-modal.component';

describe('HistoryQueryListComponent', () => {
  let historyQueryService: MockObject<HistoryQueryService>;
  let modalService: MockObject<ModalService>;

  beforeEach(() => {
    historyQueryService = createMock(HistoryQueryService);
    modalService = createMock(ModalService);

    historyQueryService.list.mockReturnValue(of(testData.historyQueries.listLight as unknown as Array<HistoryQueryLightDTO>));
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
    await expect
      .element(firstRowCells.nth(1))
      .toHaveTextContent((testData.historyQueries.listLight[0] as unknown as HistoryQueryLightDTO).name);
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
    await expect.element(firstRowCells.nth(3)).toHaveTextContent('Microsoft SQL Server');
    await expect.element(firstRowCells.nth(4)).toHaveTextContent('OIAnalytics');
  });

  test('should filter the list by toggling a status filter', async () => {
    const fixture = TestBed.createComponent(HistoryQueryListComponent);
    fixture.detectChanges();

    fixture.componentInstance.toggleStatus(fixture.componentInstance.LEGEND[0].status);
    fixture.detectChanges();

    expect(fixture.componentInstance.activeStatuses.length).toBe(1);
    const root = page.elementLocator(fixture.nativeElement);
    const rows = root.getByCss('tbody tr');
    await expect.element(rows).toHaveLength(1);
  });

  test('should clear the status filter', () => {
    const fixture = TestBed.createComponent(HistoryQueryListComponent);
    fixture.detectChanges();

    fixture.componentInstance.toggleStatus('RUNNING');
    fixture.detectChanges();
    expect(fixture.componentInstance.filteredHistoryQueries.length).toBe(1);

    fixture.componentInstance.clearStatuses();
    fixture.detectChanges();
    expect(fixture.componentInstance.activeStatuses.length).toBe(0);
    expect(fixture.componentInstance.filteredHistoryQueries.length).toBe(testData.historyQueries.listLight.length);
  });

  test('should filter the list by north type', () => {
    const fixture = TestBed.createComponent(HistoryQueryListComponent);
    fixture.detectChanges();

    fixture.componentInstance.toggleNorthType('file-writer');
    fixture.detectChanges();

    expect(fixture.componentInstance.filteredHistoryQueries.length).toBe(1);
    expect(fixture.componentInstance.filteredHistoryQueries[0].northType).toBe('file-writer');
  });

  test('should filter the list by south type', () => {
    const fixture = TestBed.createComponent(HistoryQueryListComponent);
    fixture.detectChanges();

    fixture.componentInstance.toggleSouthType('mssql');
    fixture.detectChanges();

    expect(fixture.componentInstance.filteredHistoryQueries.length).toBe(testData.historyQueries.listLight.length);

    fixture.componentInstance.clearSouthTypes();
    fixture.componentInstance.toggleNorthType('oianalytics');
    fixture.detectChanges();
    expect(fixture.componentInstance.filteredHistoryQueries.length).toBe(1);
  });

  test('should display the item progress indicator when numberOfItems is set', async () => {
    const queriesWithProgress = (testData.historyQueries.listLight as unknown as Array<HistoryQueryLightDTO>).map((query, index) =>
      index === 0 ? { ...query, currentItemNumber: 3, numberOfItems: 10 } : query
    );
    historyQueryService.list.mockReturnValue(of(queriesWithProgress));

    const fixture = TestBed.createComponent(HistoryQueryListComponent);
    fixture.detectChanges();

    const root = page.elementLocator(fixture.nativeElement);
    const firstRowCells = root.getByCss('tbody tr').nth(0).getByCss('td');
    await expect.element(firstRowCells.nth(0)).toHaveTextContent('(3 / 10)');
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

    const query = testData.historyQueries.listLight[0] as unknown as HistoryQueryLightDTO;
    expect(modalService.open).toHaveBeenCalledWith(AuditHistoryModalComponent, { size: 'xl' });
    expect(fakeModalComponent.prepare).toHaveBeenCalledWith('history_query', query.id);
  });
});
