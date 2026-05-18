import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test } from 'vitest';

import { TransformerListComponent } from './transformer-list.component';
import { EditTransformerModalComponent } from './edit-transformer-modal/edit-transformer-modal.component';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { TransformerService } from '../../services/transformer.service';
import { ConfirmationService } from '../../shared/confirmation.service';
import { NotificationService } from '../../shared/notification.service';
import { MockModalService, provideModalTesting } from '../../shared/mock-modal.service.spec';
import testData from '../../../../../backend/src/tests/utils/test-data';
import { createMock, MockObject } from '../../../test/vitest-create-mock';
import { CustomTransformerDTO, TransformerDTO } from '../../../../../backend/shared/model/transformer.model';

class TransformerListComponentTester {
  readonly fixture = TestBed.createComponent(TransformerListComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly transformers = this.root.getByCss('tbody tr');
  readonly deleteButtons = this.root.getByCss('.delete-transformer');
  readonly addTransformer = this.root.getByCss('#add-transformer');
  readonly noTransformer = this.root.getByCss('#no-transformer');
}

describe('TransformerListComponent', () => {
  let tester: TransformerListComponentTester;
  let transformerService: MockObject<TransformerService>;
  let confirmationService: MockObject<ConfirmationService>;
  let notificationService: MockObject<NotificationService>;
  let modalService: MockModalService<EditTransformerModalComponent>;

  beforeEach(() => {
    transformerService = createMock(TransformerService);
    confirmationService = createMock(ConfirmationService);
    notificationService = createMock(NotificationService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideModalTesting(),
        { provide: TransformerService, useValue: transformerService },
        { provide: ConfirmationService, useValue: confirmationService },
        { provide: NotificationService, useValue: notificationService }
      ]
    });
    modalService = TestBed.inject(MockModalService);
  });

  describe('with transformers', () => {
    beforeEach(() => {
      transformerService.list.mockReturnValue(of(testData.transformers.customList as unknown as Array<TransformerDTO>));
      tester = new TransformerListComponentTester();
    });

    test('should display a list of custom transformers', async () => {
      await expect.element(tester.transformers).toHaveLength(testData.transformers.customList.length);
    });

    test('should delete a transformer', async () => {
      const transformer = testData.transformers.customList[0] as unknown as CustomTransformerDTO;
      transformerService.list.mockClear();
      confirmationService.confirm.mockReturnValue(of(undefined));
      transformerService.delete.mockReturnValue(of(undefined));
      transformerService.list.mockReturnValue(of(testData.transformers.customList as unknown as Array<TransformerDTO>));

      await tester.deleteButtons.nth(0).click();

      expect(confirmationService.confirm).toHaveBeenCalled();
      expect(transformerService.delete).toHaveBeenCalledWith(transformer.id);
      expect(notificationService.success).toHaveBeenCalledWith('configuration.oibus.manifest.transformers.deleted', {
        name: transformer.name
      });
    });

    test('should open add modal', async () => {
      const fakeEditComponent = createMock(EditTransformerModalComponent);
      const newTransformer = testData.transformers.customList[0] as unknown as CustomTransformerDTO;
      modalService.mockClosedModal(fakeEditComponent, newTransformer);
      transformerService.list.mockReturnValue(of(testData.transformers.customList as unknown as Array<TransformerDTO>));

      await tester.addTransformer.click();

      expect(fakeEditComponent.prepareForCreation).toHaveBeenCalled();
      expect(notificationService.success).toHaveBeenCalledWith('configuration.oibus.manifest.transformers.created', {
        name: newTransformer.name
      });
    });
  });

  describe('with no transformers', () => {
    test('should display an empty list', async () => {
      transformerService.list.mockReturnValue(of([]));
      tester = new TransformerListComponentTester();

      await expect.element(tester.noTransformer).toBeInTheDocument();
    });
  });
});
