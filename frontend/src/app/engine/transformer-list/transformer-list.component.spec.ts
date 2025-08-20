import { TestBed } from '@angular/core/testing';

import { TransformerListComponent } from './transformer-list.component';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { ComponentTester, createMock, TestButton } from 'ngx-speculoos';
import { of } from 'rxjs';
import { TransformerService } from '../../services/transformer.service';
import { ConfirmationService } from '../../shared/confirmation.service';
import { NotificationService } from '../../shared/notification.service';
import { provideModalTesting } from '../../shared/mock-modal.service.spec';
import testData from '../../../../../backend/src/tests/utils/test-data';
import { ModalService } from '../../shared/modal.service';

class TransformerListComponentTester extends ComponentTester<TransformerListComponent> {
  constructor() {
    super(TransformerListComponent);
  }

  get title() {
    return this.element('#title')!;
  }

  get addTransformer() {
    return this.button('#add-transformer')!;
  }

  get deleteButtons() {
    return this.elements('.delete-transformer') as Array<TestButton>;
  }

  get editButtons() {
    return this.elements('.edit-transformer') as Array<TestButton>;
  }

  get noTransformer() {
    return this.element('#no-transformer');
  }

  get transformers() {
    return this.elements('tbody tr');
  }
}

describe('TransformerListComponent', () => {
  let tester: TransformerListComponentTester;
  let transformerService: jasmine.SpyObj<TransformerService>;
  let confirmationService: jasmine.SpyObj<ConfirmationService>;
  let notificationService: jasmine.SpyObj<NotificationService>;
  let modalService: jasmine.SpyObj<ModalService>;

  const transformers = testData.transformers.customList;

  beforeEach(() => {
    transformerService = createMock(TransformerService);
    confirmationService = createMock(ConfirmationService);
    notificationService = createMock(NotificationService);
    modalService = createMock(ModalService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideModalTesting(),
        { provide: TransformerService, useValue: transformerService },
        { provide: ConfirmationService, useValue: confirmationService },
        { provide: NotificationService, useValue: notificationService },
        { provide: ModalService, useValue: modalService }
      ]
    });

    tester = new TransformerListComponentTester();

    modalService.open.and.returnValue({
      componentInstance: {
        prepareForCreation: jasmine.createSpy(),
        prepareForEdition: jasmine.createSpy(),
        canDismiss: jasmine.createSpy().and.returnValue(true)
      },
      result: of({ name: 'new-name' })
    } as any);
  });

  describe('with transformer', () => {
    beforeEach(() => {
      transformerService.list.and.returnValue(of(transformers));
      tester.detectChanges();
    });

    it('should display a list of transformers', () => {
      expect(tester.title).toContainText('Custom Transformers');
      expect(tester.transformers.length).toEqual(2);
      expect(tester.transformers[0].elements('td').length).toEqual(5);
      expect(tester.transformers[1].elements('td')[0]).toContainText('my transformer 2');
      expect(tester.transformers[1].elements('td')[1]).toContainText('description');
      expect(tester.transformers[1].elements('td')[2]).toContainText('any');
      expect(tester.transformers[1].elements('td')[3]).toContainText('any');
    });

    it('should delete a transformer', () => {
      transformerService.list.calls.reset();

      confirmationService.confirm.and.returnValue(of(undefined));
      transformerService.delete.and.returnValue(of(undefined));
      tester.deleteButtons[0].click();

      // confirm, delete, notify and refresh
      expect(confirmationService.confirm).toHaveBeenCalled();
      expect(transformerService.delete).toHaveBeenCalledWith('transformerId1');
      expect(transformerService.list).toHaveBeenCalledTimes(1);
      expect(notificationService.success).toHaveBeenCalledWith('configuration.oibus.manifest.transformers.deleted', {
        name: 'my transformer 1'
      });
    });

    it('should open edit modal with beforeDismiss configuration', () => {
      tester.editButtons[0].click();

      expect(modalService.open).toHaveBeenCalledWith(
        jasmine.any(Function),
        jasmine.objectContaining({
          beforeDismiss: jasmine.any(Function)
        })
      );
      expect(transformerService.list).toHaveBeenCalledTimes(2);
      expect(notificationService.success).toHaveBeenCalledWith('configuration.oibus.manifest.transformers.updated', { name: 'new-name' });
    });

    it('should open add modal with beforeDismiss configuration', () => {
      tester.addTransformer.click();
      expect(modalService.open).toHaveBeenCalledWith(
        jasmine.any(Function),
        jasmine.objectContaining({
          beforeDismiss: jasmine.any(Function)
        })
      );
      expect(transformerService.list).toHaveBeenCalledTimes(2);
      expect(notificationService.success).toHaveBeenCalledWith('configuration.oibus.manifest.transformers.created', { name: 'new-name' });
    });
  });

  describe('with no transformer', () => {
    it('should display an empty list', () => {
      transformerService.list.and.returnValue(of([]));
      tester.detectChanges();
      expect(tester.noTransformer).toContainText('No Custom Transformer');
    });
  });
});
