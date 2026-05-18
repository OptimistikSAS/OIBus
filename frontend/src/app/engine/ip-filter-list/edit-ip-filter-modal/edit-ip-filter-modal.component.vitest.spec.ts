import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test } from 'vitest';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { EditIpFilterModalComponent } from './edit-ip-filter-modal.component';
import { DefaultValidationErrorsComponent } from '../../../shared/default-validation-errors/default-validation-errors.component';
import { IpFilterService } from '../../../services/ip-filter.service';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';
import { IPFilterDTO } from '../../../../../../backend/shared/model/ip-filter.model';

class EditIpFilterModalComponentTester {
  readonly fixture = TestBed.createComponent(EditIpFilterModalComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly address = this.root.getByCss('#address');
  readonly description = this.root.getByCss('#description');
  readonly cancelButton = page.getByCss('#cancel-button');
}

const ipFilter: IPFilterDTO = {
  id: 'ipFilterId1',
  address: '192.168.1.1',
  description: 'my ip filter'
} as IPFilterDTO;

describe('EditIpFilterModalComponent', () => {
  let ipFilterService: MockObject<IpFilterService>;
  let activeModal: MockObject<NgbActiveModal>;

  beforeEach(() => {
    ipFilterService = createMock(IpFilterService);
    activeModal = createMock(NgbActiveModal);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: IpFilterService, useValue: ipFilterService },
        { provide: NgbActiveModal, useValue: activeModal }
      ]
    });

    TestBed.createComponent(DefaultValidationErrorsComponent).detectChanges();
  });

  test('should create an ip filter', () => {
    const createdFilter = { ...ipFilter, id: 'new-id' } as IPFilterDTO;
    ipFilterService.create.mockReturnValue(of(createdFilter));

    const tester = new EditIpFilterModalComponentTester();
    tester.fixture.componentInstance.prepareForCreation();
    tester.fixture.detectChanges();

    tester.fixture.componentInstance.form.controls.address.setValue('10.0.0.1');
    tester.fixture.componentInstance.form.controls.description.setValue('test');
    tester.fixture.componentInstance.save();

    expect(ipFilterService.create).toHaveBeenCalledWith({ address: '10.0.0.1', description: 'test' });
    expect(activeModal.close).toHaveBeenCalledWith(createdFilter);
  });

  test('should populate form and update an ip filter', () => {
    const updatedFilter = { ...ipFilter, address: 'new-address' } as IPFilterDTO;
    ipFilterService.update.mockReturnValue(of(undefined));
    ipFilterService.findById.mockReturnValue(of(updatedFilter));

    const tester = new EditIpFilterModalComponentTester();
    tester.fixture.componentInstance.prepareForEdition(ipFilter);
    tester.fixture.detectChanges();

    expect(tester.fixture.componentInstance.form.controls.address.value).toBe('192.168.1.1');

    tester.fixture.componentInstance.form.controls.address.setValue('new-address');
    tester.fixture.componentInstance.save();

    expect(ipFilterService.update).toHaveBeenCalledWith('ipFilterId1', { address: 'new-address', description: 'my ip filter' });
    expect(activeModal.close).toHaveBeenCalledWith(updatedFilter);
  });

  test('should cancel', async () => {
    const tester = new EditIpFilterModalComponentTester();
    tester.fixture.componentInstance.prepareForCreation();
    tester.fixture.detectChanges();

    await tester.cancelButton.click();

    expect(activeModal.dismiss).toHaveBeenCalled();
  });
});
