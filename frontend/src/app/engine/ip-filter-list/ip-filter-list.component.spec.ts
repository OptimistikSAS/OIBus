import { TestBed } from '@angular/core/testing';

import { EMPTY, of } from 'rxjs';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { IPFilterDTO } from '@oibus/shared/api/ip-filter.model';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import testData from '../../../test/test-data';
import { createMock, MockObject } from '../../../test/vitest-create-mock';
import { EngineService } from '../../services/engine.service';
import { IpFilterService } from '../../services/ip-filter.service';
import { AuditHistoryModalComponent } from '../../shared/audit-history-modal/audit-history-modal.component';
import { ConfirmationService } from '../../shared/confirmation.service';
import { MockModalService, provideModalTesting } from '../../shared/mock-modal.service.testing';
import { NotificationService } from '../../shared/notification.service';
import { EditIpFilterModalComponent } from './edit-ip-filter-modal/edit-ip-filter-modal.component';
import { IpFilterListComponent } from './ip-filter-list.component';

class IpFilterListComponentTester {
  readonly fixture = TestBed.createComponent(IpFilterListComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly rows = this.root.getByCss('tbody tr');
  readonly addButton = this.root.getByRole('button', { name: 'Add a new IP filter' });
  readonly sortByAddress = this.root.getByRole('button', { name: 'Address' });
  readonly sortByUpdatedAt = this.root.getByRole('button', { name: 'Updated on' });
  readonly noIpFilter = this.root.getByCss('#no-ip-filter');
  readonly disabledMessage = this.root.getByRole('alert');
  readonly pagination = this.root.getByCss('oib-pagination');

  row(index: number) {
    return this.rows.nth(index);
  }

  rowButton(index: number, name: string) {
    return this.row(index).getByRole('button', { name });
  }
}

function buildIpFilter(index: number, address: string, updatedAt = ''): IPFilterDTO {
  return { ...testData.ipFilters.list[0], id: `ipFilter${index}`, address, description: `filter ${index}`, updatedAt };
}

describe('IpFilterListComponent', () => {
  let ipFilterService: MockObject<IpFilterService>;
  let engineService: MockObject<EngineService>;
  let confirmationService: MockObject<ConfirmationService>;
  let notificationService: MockObject<NotificationService>;
  let modalService: MockModalService<EditIpFilterModalComponent | AuditHistoryModalComponent>;

  beforeEach(() => {
    ipFilterService = createMock(IpFilterService);
    engineService = createMock(EngineService);
    confirmationService = createMock(ConfirmationService);
    notificationService = createMock(NotificationService);
    engineService.getInfo.mockReturnValue(of(testData.engine.oIBusInfo));
    ipFilterService.list.mockReturnValue(of(testData.ipFilters.list));

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideModalTesting(),
        { provide: IpFilterService, useValue: ipFilterService },
        { provide: EngineService, useValue: engineService },
        { provide: ConfirmationService, useValue: confirmationService },
        { provide: NotificationService, useValue: notificationService }
      ]
    });
    modalService = TestBed.inject(MockModalService);
  });

  describe('with ip filters', () => {
    let tester: IpFilterListComponentTester;

    beforeEach(async () => {
      tester = new IpFilterListComponentTester();
      await expect.element(tester.rows).toHaveLength(2);
    });

    test('should display a list of ip filters', async () => {
      await expect.element(tester.root).toMatchTextContent('IP filters(2)');
      await expect.element(tester.rows).toHaveLength(2);
      await expect.element(tester.row(0).getByCss('td')).toHaveLength(4);
      await expect.element(tester.row(0)).toMatchTextContent('192.168.1.1my first ip filter');
      await expect.element(tester.row(1)).toMatchTextContent('*All ips');
      await expect.element(tester.disabledMessage).not.toBeInTheDocument();
    });

    test('should delete an ip filter and refresh the list', async () => {
      confirmationService.confirm.mockReturnValue(of(undefined));
      ipFilterService.delete.mockReturnValue(of(undefined));
      ipFilterService.list.mockReturnValue(of([testData.ipFilters.list[1]]));

      await tester.rowButton(0, 'Delete IP filter').click();

      expect(confirmationService.confirm).toHaveBeenCalledWith({
        messageKey: 'engine.ip-filter.confirm-deletion',
        interpolateParams: { address: '192.168.1.1' }
      });
      expect(ipFilterService.delete).toHaveBeenCalledWith('ipFilterId1');
      expect(notificationService.success).toHaveBeenCalledWith('engine.ip-filter.deleted', { address: '192.168.1.1' });
      await expect.element(tester.rows).toHaveLength(1);
      expect(ipFilterService.list).toHaveBeenCalledTimes(2);
    });

    test('should not delete an ip filter if not confirmed', async () => {
      confirmationService.confirm.mockReturnValue(EMPTY);

      await tester.rowButton(0, 'Delete IP filter').click();

      expect(ipFilterService.delete).not.toHaveBeenCalled();
      expect(ipFilterService.list).toHaveBeenCalledTimes(1);
    });

    test('should edit an ip filter and refresh the list', async () => {
      const fakeEditComponent = createMock(EditIpFilterModalComponent);
      modalService.mockClosedModal(fakeEditComponent, { ...testData.ipFilters.list[0], address: 'new-address' });

      await tester.rowButton(0, 'Edit IP filter').click();

      expect(fakeEditComponent.prepareForEdition).toHaveBeenCalledWith(testData.ipFilters.list[0]);
      expect(notificationService.success).toHaveBeenCalledWith('engine.ip-filter.updated', { address: 'new-address' });
      expect(ipFilterService.list).toHaveBeenCalledTimes(2);
    });

    test('should create an ip filter and refresh the list', async () => {
      const fakeEditComponent = createMock(EditIpFilterModalComponent);
      modalService.mockClosedModal(fakeEditComponent, { ...testData.ipFilters.list[0], address: 'new-address' });

      await tester.addButton.click();

      expect(fakeEditComponent.prepareForCreation).toHaveBeenCalled();
      expect(notificationService.success).toHaveBeenCalledWith('engine.ip-filter.created', { address: 'new-address' });
      expect(ipFilterService.list).toHaveBeenCalledTimes(2);
    });

    test('should not refresh the list when the modal is dismissed', async () => {
      modalService.mockDismissedModal(createMock(EditIpFilterModalComponent));

      await tester.addButton.click();

      expect(notificationService.success).not.toHaveBeenCalled();
      expect(ipFilterService.list).toHaveBeenCalledTimes(1);
    });

    test('should open the audit history modal with the ip filter entity type and id', async () => {
      const fakeAuditComponent = createMock(AuditHistoryModalComponent);
      modalService.mockClosedModal(fakeAuditComponent);

      await tester.rowButton(0, 'View IP filter audit history').click();

      expect(fakeAuditComponent.prepare).toHaveBeenCalledWith('ip_filter', 'ipFilterId1');
    });
  });

  test('should sort the ip filters by address and by update date', async () => {
    ipFilterService.list.mockReturnValue(
      of([
        buildIpFilter(1, '10.0.0.2', '2024-01-01'),
        buildIpFilter(2, '10.0.0.3', '2024-01-03'),
        buildIpFilter(3, '10.0.0.1', '2024-01-02')
      ])
    );
    const tester = new IpFilterListComponentTester();
    await expect.element(tester.row(0)).toMatchTextContent('10.0.0.2');
    await expect.element(tester.sortByAddress.getByCss('.fa-sort')).toBeInTheDocument();

    await tester.sortByAddress.click();
    await expect.element(tester.row(0)).toMatchTextContent('10.0.0.1');
    await expect.element(tester.row(2)).toMatchTextContent('10.0.0.3');
    await expect.element(tester.sortByAddress.getByCss('.fa-sort-up')).toBeInTheDocument();

    await tester.sortByAddress.click();
    await expect.element(tester.row(0)).toMatchTextContent('10.0.0.3');
    await expect.element(tester.sortByAddress.getByCss('.fa-sort-down')).toBeInTheDocument();

    await tester.sortByUpdatedAt.click();
    await expect.element(tester.row(0)).toMatchTextContent('10.0.0.2');
    await expect.element(tester.row(2)).toMatchTextContent('10.0.0.3');
    await expect.element(tester.sortByAddress.getByCss('.fa-sort')).toBeInTheDocument();
    await expect.element(tester.sortByUpdatedAt.getByCss('.fa-sort-up')).toBeInTheDocument();
  });

  test('should paginate the ip filters', async () => {
    ipFilterService.list.mockReturnValue(of(Array.from({ length: 25 }, (_, index) => buildIpFilter(index + 1, `10.0.0.${index + 1}`))));
    const tester = new IpFilterListComponentTester();
    await expect.element(tester.rows).toHaveLength(20);

    await tester.pagination.getByRole('link', { name: '2' }).click();

    await expect.element(tester.rows).toHaveLength(5);
    await expect.element(tester.row(0)).toMatchTextContent('10.0.0.21');
  });

  test('should display an empty list', async () => {
    ipFilterService.list.mockReturnValue(of([]));
    const tester = new IpFilterListComponentTester();

    await expect.element(tester.noIpFilter).toBeInTheDocument();
    await expect.element(tester.addButton).toBeInTheDocument();
  });

  test('should display a disabled message and hide the list and add button when ip filters are ignored', async () => {
    engineService.getInfo.mockReturnValue(of({ ...testData.engine.oIBusInfo, ignoreIpFilters: true }));
    const tester = new IpFilterListComponentTester();

    await expect.element(tester.disabledMessage).toMatchTextContent('IP filtering is disabled on this OIBus');
    await expect.element(tester.rows).toHaveLength(0);
    await expect.element(tester.addButton).not.toBeInTheDocument();
  });
});
