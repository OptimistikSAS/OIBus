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
import { MockModalService, provideModalTesting } from '../../shared/mock-modal.service.spec';
import testData from '../../../../../backend/src/tests/utils/test-data';
import { IPFilterDTO } from '../../../../../backend/shared/model/ip-filter.model';
import { createMock, MockObject } from '../../../test/vitest-create-mock';

class IpFilterListComponentTester {
  readonly fixture = TestBed.createComponent(IpFilterListComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly ipFilters = this.root.getByCss('tbody tr');
  readonly addButton = this.root.getByCss('#add-ip-filter');
  readonly deleteButtons = this.root.getByCss('.delete-ip-filter');
  readonly editButtons = this.root.getByCss('.edit-ip-filter');
  readonly noIpFilter = this.root.getByCss('#no-ip-filter');
}

describe('IpFilterListComponent', () => {
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
    let tester: IpFilterListComponentTester;

    beforeEach(() => {
      ipFilterService.list.mockReturnValue(of(testData.ipFilters.list as unknown as Array<IPFilterDTO>));
      tester = new IpFilterListComponentTester();
      tester.fixture.detectChanges();
    });

    test('should display a list of ip filters', async () => {
      await expect.element(tester.ipFilters).toHaveLength(2);
    });

    test('should delete an ip filter', async () => {
      ipFilterService.list.mockClear();
      confirmationService.confirm.mockReturnValue(of(undefined));
      ipFilterService.delete.mockReturnValue(of(undefined));

      await tester.deleteButtons.nth(0).click();

      expect(confirmationService.confirm).toHaveBeenCalled();
      expect(ipFilterService.delete).toHaveBeenCalledWith('ipFilterId1');
      expect(ipFilterService.list).toHaveBeenCalledTimes(1);
      expect(notificationService.success).toHaveBeenCalledWith('engine.ip-filter.deleted', { address: '192.168.1.1' });
    });

    test('should open edit modal', async () => {
      const fakeEditComponent = createMock(EditIpFilterModalComponent);
      modalService.mockClosedModal(fakeEditComponent, { address: 'new-address' } as IPFilterDTO);

      await tester.editButtons.nth(0).click();

      expect(fakeEditComponent.prepareForEdition).toHaveBeenCalled();
      expect(ipFilterService.list).toHaveBeenCalledTimes(2);
      expect(notificationService.success).toHaveBeenCalledWith('engine.ip-filter.updated', { address: 'new-address' });
    });

    test('should open add modal', async () => {
      const fakeEditComponent = createMock(EditIpFilterModalComponent);
      modalService.mockClosedModal(fakeEditComponent, { address: 'new-address' } as IPFilterDTO);

      await tester.addButton.click();

      expect(fakeEditComponent.prepareForCreation).toHaveBeenCalled();
      expect(ipFilterService.list).toHaveBeenCalledTimes(2);
      expect(notificationService.success).toHaveBeenCalledWith('engine.ip-filter.created', { address: 'new-address' });
    });
  });

  describe('with no ip filters', () => {
    test('should display empty state', async () => {
      ipFilterService.list.mockReturnValue(of([]));
      const tester = new IpFilterListComponentTester();
      tester.fixture.detectChanges();

      await expect.element(tester.noIpFilter).toBeInTheDocument();
    });
  });
});
