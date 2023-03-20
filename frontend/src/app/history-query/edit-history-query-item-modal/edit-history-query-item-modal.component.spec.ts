import { EditHistoryQueryItemModalComponent } from './edit-history-query-item-modal.component';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { fakeAsync, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { MockI18nModule } from '../../../i18n/mock-i18n.spec';
import { DefaultValidationErrorsComponent } from '../../shared/default-validation-errors/default-validation-errors.component';
import { OibusItemCommandDTO, OibusItemDTO, OibusItemManifest } from '../../../../../shared/model/south-connector.model';
import { HistoryQueryDTO } from '../../../../../shared/model/history-query.model';
import { HistoryQueryService } from '../../services/history-query.service';

class EditHistoryQueryItemModalComponentTester extends ComponentTester<EditHistoryQueryItemModalComponent> {
  constructor() {
    super(EditHistoryQueryItemModalComponent);
  }

  get name() {
    return this.input('#name')!;
  }

  get validationErrors() {
    return this.elements('val-errors div');
  }

  get save() {
    return this.button('#save-button')!;
  }

  get cancel() {
    return this.button('#cancel-button')!;
  }
}

describe('EditHistoryQueryItemModalComponent', () => {
  let tester: EditHistoryQueryItemModalComponentTester;
  let fakeActiveModal: NgbActiveModal;
  let historyQueryService: jasmine.SpyObj<HistoryQueryService>;

  const southItemSchema: OibusItemManifest = {
    scanMode: { subscriptionOnly: false, acceptSubscription: true },
    settings: [],
    schema: {} as unknown
  } as OibusItemManifest;

  const historyQuery: HistoryQueryDTO = {
    id: 'historyId',
    name: 'Test',
    description: 'My History query description',
    enabled: true,
    startTime: '2023-01-01T00:00:00.000Z',
    endTime: '2023-02-01T00:00:00.000Z',
    northType: 'Console',
    southType: 'SQL',
    northSettings: {},
    southSettings: {},
    caching: {
      scanModeId: 'scanModeId1',
      retryInterval: 1000,
      retryCount: 3,
      groupCount: 1000,
      maxSendCount: 10000,
      timeout: 30
    },
    archive: {
      enabled: false,
      retentionDuration: 0
    }
  };

  beforeEach(() => {
    fakeActiveModal = createMock(NgbActiveModal);
    historyQueryService = createMock(HistoryQueryService);

    TestBed.configureTestingModule({
      imports: [
        MockI18nModule,
        ReactiveFormsModule,
        HttpClientTestingModule,
        EditHistoryQueryItemModalComponent,
        DefaultValidationErrorsComponent
      ],
      providers: [
        { provide: NgbActiveModal, useValue: fakeActiveModal },
        { provide: HistoryQueryService, useValue: historyQueryService }
      ]
    });

    TestBed.createComponent(DefaultValidationErrorsComponent).detectChanges();

    tester = new EditHistoryQueryItemModalComponentTester();
  });

  describe('create mode', () => {
    beforeEach(() => {
      tester.componentInstance.prepareForCreation(historyQuery, southItemSchema);
      tester.detectChanges();
    });

    it('should have an empty form', () => {
      expect(tester.name).toHaveValue('');
    });

    it('should not save if invalid', () => {
      tester.save.click();

      // name
      expect(tester.validationErrors.length).toBe(1);
      expect(fakeActiveModal.close).not.toHaveBeenCalled();
    });

    it('should save if valid', fakeAsync(() => {
      tester.name.fillWith('MyName');

      tester.detectChanges();

      const createdSouthItem = {
        id: 'id1',
        connectorId: 'southId1'
      } as OibusItemDTO;
      historyQueryService.createSouthItem.and.returnValue(of(createdSouthItem));

      tester.save.click();

      const expectedCommand: OibusItemCommandDTO = {
        name: 'MyName',
        scanModeId: null,
        settings: {}
      };

      expect(historyQueryService.createSouthItem).toHaveBeenCalledWith('historyId', expectedCommand);
      expect(fakeActiveModal.close).toHaveBeenCalledWith(createdSouthItem);
    }));

    it('should cancel', () => {
      tester.cancel.click();
      expect(fakeActiveModal.dismiss).toHaveBeenCalled();
    });
  });

  describe('edit mode', () => {
    const southItem: OibusItemDTO = {
      id: 'id1',
      name: 'myName',
      connectorId: 'southId1',
      settings: {}
    };

    beforeEach(() => {
      historyQueryService.getSouthConnectorItem.and.returnValue(of(southItem));
      historyQueryService.updateSouthItem.and.returnValue(of(undefined));

      tester.componentInstance.prepareForEdition(historyQuery, southItemSchema, southItem);
      tester.detectChanges();
    });

    it('should have a populated form', () => {
      expect(tester.name).toHaveValue(southItem.name);
    });

    it('should not save if invalid', () => {
      tester.name.fillWith('');
      tester.save.click();

      // name
      expect(tester.validationErrors.length).toBe(1);
      expect(fakeActiveModal.close).not.toHaveBeenCalled();
    });

    it('should save if valid', fakeAsync(() => {
      tester.name.fillWith('South Item 1 (updated)');
      tester.save.click();

      const expectedCommand: OibusItemCommandDTO = {
        name: 'South Item 1 (updated)',
        scanModeId: null,
        settings: {}
      };

      expect(historyQueryService.updateSouthItem).toHaveBeenCalledWith('historyId', 'id1', expectedCommand);
      expect(historyQueryService.getSouthConnectorItem).toHaveBeenCalledWith('historyId', 'id1');
      expect(fakeActiveModal.close).toHaveBeenCalledWith(southItem);
    }));

    it('should cancel', () => {
      tester.cancel.click();
      expect(fakeActiveModal.dismiss).toHaveBeenCalled();
    });
  });
});
