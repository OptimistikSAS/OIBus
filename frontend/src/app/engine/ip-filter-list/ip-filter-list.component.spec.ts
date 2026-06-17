import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test } from 'vitest';

import { IpFilterListComponent } from './ip-filter-list.component';
import { EditIpFilterModalComponent } from './edit-ip-filter-modal/edit-ip-filter-modal.component';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { IpFilterService } from '../../services/ip-filter.service';
import { ConfirmationService } from '../../shared/confirmation.service';
import { NotificationService } from '../../shared/notification.service';
import { MockModalService, provideModalTesting } from '../../shared/mock-modal.service.testing';
import testData from '../../../../../backend/src/tests/utils/test-data';
import { IPFilterDTO } from '../../../../../backend/shared/model/ip-filter.model';
import { createMock, MockObject } from '../../../test/vitest-create-mock';

class IpFilterListComponentTester {
  readonly fixture = TestBed.createComponent(IpFilterListComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly ipFilters = this.root.getByCss('tbody tr');
  readonly deleteButtons = this.root.getByCss('.delete-ip-filter');
  readonly editButtons = this.root.getByCss('.edit-ip-filter');
  readonly addIpFilter = this.root.getByCss('#add-ip-filter');
  readonly noIpFilter = this.root.getByCss('#no-ip-filter');

  constructor() {
    this.fixture.detectChanges();
  }
}

describe('IpFilterListComponent', () => {
  let tester: IpFilterListComponentTester;
  let ipFilterService: MockObject<IpFilterService>;
  let confirmationService: MockObject<ConfirmationService>;
  let notificationService: MockObject<NotificationService>;
  let modalService: MockModalService<EditIpFilterModalComponent>;

  beforeEach(() => {
    ipFilterService = createMock(IpFilterService);
    confirmationService = createMock(ConfirmationService);
    notificationService = createMock(NotificationService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideModalTesting(),
        { provide: IpFilterService, useValue: ipFilterService },
        { provide: ConfirmationService, useValue: confirmationService },
        { provide: NotificationService, useValue: notificationService }
      ]
    });
    modalService = TestBed.inject(MockModalService);
  });

  describe('with ip filters', () => {
    beforeEach(() => {
      ipFilterService.list.mockReturnValue(of(testData.ipFilters.list as unknown as Array<IPFilterDTO>));
      tester = new IpFilterListComponentTester();
    });

    test('should display a list of ip filters', async () => {
      await expect.element(tester.ipFilters).toHaveLength(2);
      await expect.element(tester.ipFilters.nth(0).getByCss('td')).toHaveLength(4);
    });

    test('should delete an ip filter', async () => {
      ipFilterService.list.mockClear();
      confirmationService.confirm.mockReturnValue(of(undefined));
      ipFilterService.delete.mockReturnValue(of(undefined));

      await tester.deleteButtons.nth(0).click();

      expect(confirmationService.confirm).toHaveBeenCalled();
      expect(ipFilterService.delete).toHaveBeenCalledWith(testData.ipFilters.list[0].id);
      expect(ipFilterService.list).toHaveBeenCalledTimes(1);
      expect(notificationService.success).toHaveBeenCalledWith('engine.ip-filter.deleted', {
        address: testData.ipFilters.list[0].address
      });
    });

    test('should open edit modal', async () => {
      const fakeEditComponent = createMock(EditIpFilterModalComponent);
      modalService.mockClosedModal(fakeEditComponent, { address: 'new-address' });
      ipFilterService.list.mockClear();

      await tester.editButtons.nth(0).click();

      expect(fakeEditComponent.prepareForEdition).toHaveBeenCalled();
      expect(ipFilterService.list).toHaveBeenCalledTimes(1);
      expect(notificationService.success).toHaveBeenCalledWith('engine.ip-filter.updated', { address: 'new-address' });
    });

    test('should open add modal', async () => {
      const fakeEditComponent = createMock(EditIpFilterModalComponent);
      modalService.mockClosedModal(fakeEditComponent, { address: 'new-address' });
      ipFilterService.list.mockClear();

      await tester.addIpFilter.click();

      expect(fakeEditComponent.prepareForCreation).toHaveBeenCalled();
      expect(ipFilterService.list).toHaveBeenCalledTimes(1);
      expect(notificationService.success).toHaveBeenCalledWith('engine.ip-filter.created', { address: 'new-address' });
    });
  });

  describe('with no ip filters', () => {
    test('should display an empty list', async () => {
      ipFilterService.list.mockReturnValue(of([]));
      tester = new IpFilterListComponentTester();

      await expect.element(tester.noIpFilter).toBeInTheDocument();
    });
  });
});
