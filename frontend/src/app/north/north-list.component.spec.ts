import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { of } from 'rxjs';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { NorthConnectorLightDTO } from '@oibus/shared/api/north-connector.model';

import { provideI18nTesting } from '../../i18n/mock-i18n';
import testData from '../../test/test-data';
import { createMock, MockObject } from '../../test/vitest-create-mock';
import { NorthConnectorService } from '../services/north-connector.service';
import { AuditHistoryModalComponent } from '../shared/audit-history-modal/audit-history-modal.component';
import { ConfirmationService } from '../shared/confirmation.service';
import { MockModalService, provideModalTesting } from '../shared/mock-modal.service.testing';
import { NotificationService } from '../shared/notification.service';
import { ChooseNorthConnectorTypeModalComponent } from './choose-north-connector-type-modal/choose-north-connector-type-modal.component';
import { NorthListComponent } from './north-list.component';

class NorthListComponentTester {
  readonly fixture = TestBed.createComponent(NorthListComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly rows = this.root.getByCss('tbody tr');
  readonly createButton = this.root.getByRole('button', { name: 'Create a new north connector' });
  readonly nameFilter = this.root.getByLabelText('Name');
  readonly empty = this.root.getByText('No north connector matches the search');
  readonly pagination = this.root.getByCss('oib-pagination');

  row(index: number) {
    return this.rows.nth(index);
  }

  cell(row: number, column: number) {
    return this.row(row).getByCss('td').nth(column);
  }

  sortButton(name: string) {
    return this.root.getByRole('button', { name, exact: true });
  }
}

function buildNorth(index: number): NorthConnectorLightDTO {
  return { ...testData.north.listLight[0], id: `north${index}`, name: `North ${String(index).padStart(2, '0')}` };
}

describe('NorthListComponent', () => {
  let northConnectorService: MockObject<NorthConnectorService>;
  let notificationService: MockObject<NotificationService>;
  let confirmationService: MockObject<ConfirmationService>;
  let modalService: MockModalService<AuditHistoryModalComponent | ChooseNorthConnectorTypeModalComponent>;

  beforeEach(() => {
    northConnectorService = createMock(NorthConnectorService);
    notificationService = createMock(NotificationService);
    confirmationService = createMock(ConfirmationService);

    northConnectorService.list.mockReturnValue(of(testData.north.listLight));
    northConnectorService.start.mockReturnValue(of(undefined));
    northConnectorService.stop.mockReturnValue(of(undefined));

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideRouter([]),
        provideModalTesting(),
        { provide: NorthConnectorService, useValue: northConnectorService },
        { provide: NotificationService, useValue: notificationService },
        { provide: ConfirmationService, useValue: confirmationService }
      ]
    });
    modalService = TestBed.inject(MockModalService);
  });

  test('should display the north list', async () => {
    const tester = new NorthListComponentTester();

    await expect.element(tester.rows).toHaveLength(testData.north.listLight.length);
    await expect.element(tester.cell(0, 1)).toHaveTextContent('North 1');
    await expect.element(tester.cell(0, 2)).toHaveTextContent('File writer');
    await expect.element(tester.cell(0, 3)).toHaveTextContent('my file writer');
    await expect.element(tester.cell(1, 1)).toHaveTextContent('North 2');
    await expect.element(tester.row(0).getByRole('link', { name: 'View north connector details' })).toHaveAttribute('href', '/northId1');
    await expect.element(tester.row(0).getByRole('link', { name: 'Edit north connector' })).toHaveAttribute('href', '/northId1/edit');
    await expect
      .element(tester.row(0).getByRole('link', { name: 'Duplicate north connector' }))
      .toHaveAttribute('href', '/create?duplicate=northId1');
    await expect.element(tester.pagination).not.toBeInTheDocument();
  });

  test('should display an empty list', async () => {
    northConnectorService.list.mockReturnValue(of([]));
    const tester = new NorthListComponentTester();

    await expect.element(tester.empty).toBeInTheDocument();
    await expect.element(tester.rows).toHaveLength(0);
  });

  test('should stop an enabled north connector', async () => {
    const tester = new NorthListComponentTester();

    await tester.row(0).getByRole('button', { name: 'Stop north connector' }).click();

    expect(northConnectorService.stop).toHaveBeenCalledWith('northId1');
    expect(northConnectorService.start).not.toHaveBeenCalled();
    expect(notificationService.success).toHaveBeenCalledWith('north.stopped', { name: 'North 1' });
    expect(northConnectorService.list).toHaveBeenCalledTimes(2);
  });

  test('should start a disabled north connector', async () => {
    const tester = new NorthListComponentTester();

    await tester.row(1).getByRole('button', { name: 'Start north connector' }).click();

    expect(northConnectorService.start).toHaveBeenCalledWith('northId2');
    expect(northConnectorService.stop).not.toHaveBeenCalled();
    expect(notificationService.success).toHaveBeenCalledWith('north.started', { name: 'North 2' });
  });

  test('should refresh the list after toggling a connector', async () => {
    const tester = new NorthListComponentTester();
    await expect.element(tester.rows).toHaveLength(2);
    northConnectorService.list.mockReturnValue(of([{ ...testData.north.listLight[0], enabled: false }, testData.north.listLight[1]]));

    await tester.row(0).getByRole('button', { name: 'Stop north connector' }).click();

    await expect.element(tester.row(0).getByRole('button', { name: 'Start north connector' })).toBeInTheDocument();
  });

  test('should delete a north connector after confirmation', async () => {
    confirmationService.confirm.mockReturnValue(of(undefined));
    northConnectorService.delete.mockReturnValue(of(undefined));
    const tester = new NorthListComponentTester();
    await expect.element(tester.rows).toHaveLength(2);
    northConnectorService.list.mockReturnValue(of([testData.north.listLight[1]]));

    await tester.row(0).getByRole('button', { name: 'Delete north connector' }).click();

    expect(confirmationService.confirm).toHaveBeenCalledWith({
      messageKey: 'north.confirm-deletion',
      interpolateParams: { name: 'North 1' }
    });
    expect(northConnectorService.delete).toHaveBeenCalledWith('northId1');
    expect(notificationService.success).toHaveBeenCalledWith('north.deleted', { name: 'North 1' });
    await expect.element(tester.rows).toHaveLength(1);
    await expect.element(tester.cell(0, 1)).toHaveTextContent('North 2');
  });

  test('should not delete a north connector without confirmation', async () => {
    confirmationService.confirm.mockReturnValue(of());
    const tester = new NorthListComponentTester();

    await tester.row(0).getByRole('button', { name: 'Delete north connector' }).click();

    expect(confirmationService.confirm).toHaveBeenCalled();
    expect(northConnectorService.delete).not.toHaveBeenCalled();
  });

  test('should open the creation modal', async () => {
    const fakeModalComponent = createMock(ChooseNorthConnectorTypeModalComponent);
    modalService.mockClosedModal(fakeModalComponent);
    const openSpy = vi.spyOn(modalService, 'open');
    const tester = new NorthListComponentTester();

    await tester.createButton.click();

    expect(openSpy).toHaveBeenCalledWith(ChooseNorthConnectorTypeModalComponent, { size: 'xl', backdrop: 'static' });
  });

  test('should open the audit history modal with the north connector entity type and id', async () => {
    const fakeModalComponent = createMock(AuditHistoryModalComponent);
    modalService.mockClosedModal(fakeModalComponent);
    const tester = new NorthListComponentTester();

    await tester.row(1).getByRole('button', { name: 'View north connector audit history' }).click();

    expect(fakeModalComponent.prepare).toHaveBeenCalledWith('north_connector', 'northId2');
  });

  test('should filter by name', async () => {
    const tester = new NorthListComponentTester();
    await expect.element(tester.rows).toHaveLength(2);

    await tester.nameFilter.fill('north 2');

    await expect.element(tester.rows).toHaveLength(1);
    await expect.element(tester.cell(0, 1)).toHaveTextContent('North 2');

    await tester.nameFilter.fill('unknown');
    await expect.element(tester.empty).toBeInTheDocument();
  });

  test('should filter by status and clear the filter', async () => {
    const tester = new NorthListComponentTester();
    const statusFilters = tester.root.getByCss('.filter-chip');
    await expect.element(tester.rows).toHaveLength(2);

    // first chip is "Disabled"
    await statusFilters.nth(0).click();
    await expect.element(tester.rows).toHaveLength(1);
    await expect.element(tester.cell(0, 1)).toHaveTextContent('North 2');
    await expect.element(statusFilters.nth(1)).toHaveClass('inactive');

    // both states selected
    await statusFilters.nth(1).click();
    await expect.element(tester.rows).toHaveLength(2);

    // unselect "Disabled"
    await statusFilters.nth(0).click();
    await expect.element(tester.rows).toHaveLength(1);
    await expect.element(tester.cell(0, 1)).toHaveTextContent('North 1');

    await tester.root.getByCss('#clear-enabled-states-button').click();
    await expect.element(tester.rows).toHaveLength(2);
    await expect.element(tester.root.getByCss('#clear-enabled-states-button')).not.toBeInTheDocument();
  });

  test('should filter by type and clear the filter', async () => {
    const tester = new NorthListComponentTester();
    await expect.element(tester.rows).toHaveLength(2);
    const typeFilter = tester.root.getByRole('button', { name: 'OIAnalytics®' });

    await typeFilter.click();
    await expect.element(tester.rows).toHaveLength(1);
    await expect.element(tester.cell(0, 1)).toHaveTextContent('North 2');

    await typeFilter.click();
    await expect.element(tester.rows).toHaveLength(2);

    await typeFilter.click();
    await tester.root.getByCss('#clear-types-button').click();
    await expect.element(tester.rows).toHaveLength(2);
  });

  test('should sort the list', async () => {
    const tester = new NorthListComponentTester();
    await expect.element(tester.cell(0, 1)).toHaveTextContent('North 1');
    const nameSort = tester.sortButton('Name');
    await expect.element(nameSort.getByCss('.fa-sort-up')).toBeInTheDocument();

    await nameSort.click();
    await expect.element(tester.cell(0, 1)).toHaveTextContent('North 2');
    await expect.element(nameSort.getByCss('.fa-sort-down')).toBeInTheDocument();

    const typeSort = tester.sortButton('Type');
    await typeSort.click();
    await expect.element(nameSort.getByCss('.fa-sort')).toBeInTheDocument();
    await expect.element(typeSort.getByCss('.fa-sort-up')).toBeInTheDocument();
    // file-writer < oianalytics
    await expect.element(tester.cell(0, 1)).toHaveTextContent('North 1');
  });

  test('should sort by update date', async () => {
    northConnectorService.list.mockReturnValue(
      of([
        { ...testData.north.listLight[0], updatedAt: '2024-01-02T00:00:00.000Z' },
        { ...testData.north.listLight[1], updatedAt: '2024-01-01T00:00:00.000Z' }
      ])
    );
    const tester = new NorthListComponentTester();

    await tester.sortButton('Updated on').click();

    await expect.element(tester.cell(0, 1)).toHaveTextContent('North 2');
  });

  test('should paginate the list', async () => {
    northConnectorService.list.mockReturnValue(of(Array.from({ length: 20 }, (_, index) => buildNorth(index + 1))));
    const tester = new NorthListComponentTester();

    await expect.element(tester.rows).toHaveLength(15);
    await expect.element(tester.cell(0, 1)).toHaveTextContent('North 01');

    await tester.pagination.getByRole('link', { name: '2' }).click();

    await expect.element(tester.rows).toHaveLength(5);
    await expect.element(tester.cell(0, 1)).toHaveTextContent('North 16');
  });
});
