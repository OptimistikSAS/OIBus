import { EditNorthTransformerModalComponent } from './edit-north-transformer-modal.component';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { DefaultValidationErrorsComponent } from '../../../shared/default-validation-errors/default-validation-errors.component';
import { TransformerService } from '../../../services/transformer.service';
import { of } from 'rxjs';
import { TransformerDTO } from '../../../../../../backend/shared/model/transformer.model';
import { OibTransformerComponent } from '../../../shared/form/oib-transformer/oib-transformer.component';
import { By } from '@angular/platform-browser';
import { FormComponent } from '../../../shared/form/form.component';

class EditNorthTransformerModalComponentTester extends ComponentTester<EditNorthTransformerModalComponent> {
  constructor() {
    super(EditNorthTransformerModalComponent);
  }

  get title() {
    return this.element('h4');
  }

  get transformerSelect() {
    return this.debugElement.query(By.directive(OibTransformerComponent))!;
  }

  get options() {
    return this.debugElement.query(By.directive(FormComponent))!;
  }

  get save() {
    return this.button('#save-button')!;
  }

  get cancel() {
    return this.button('#cancel-button')!;
  }
}

describe('EditNorthTransformerModalComponent', () => {
  let tester: EditNorthTransformerModalComponentTester;
  let fakeActiveModal: NgbActiveModal;
  let transformerService: jasmine.SpyObj<TransformerService>;

  beforeEach(() => {
    fakeActiveModal = createMock(NgbActiveModal);
    transformerService = createMock(TransformerService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideHttpClient(),
        { provide: NgbActiveModal, useValue: fakeActiveModal },
        { provide: TransformerService, useValue: transformerService }
      ]
    });

    TestBed.createComponent(DefaultValidationErrorsComponent).detectChanges();

    tester = new EditNorthTransformerModalComponentTester();
  });

  it('should cancel', () => {
    tester.cancel.click();
    expect(fakeActiveModal.dismiss).toHaveBeenCalled();
  });

  it('should display title and form, and validate without transformers', () => {
    expect(tester.title).toBeNull();
    tester.componentInstance.prepare('time-values', [], [], null, {});
    tester.detectChanges();
    expect(tester.title).toContainText('Choose how to handle OIBus time values payloads');
    expect(tester.options).toBeNull();
    tester.save.click();
    expect(fakeActiveModal.close).toHaveBeenCalledWith({ transformer: null, options: {} });
  });

  it('should validate with transformers', () => {
    const transformer: TransformerDTO = {
      id: 'time-values-to-mqtt',
      type: 'standard',
      name: 'my transformer 1',
      description: 'description',
      inputType: 'time-values',
      outputType: 'mqtt',
      manifest: [
        {
          key: 'mapping',
          type: 'OibArray',
          translationKey: 'transformers.mapping.title',
          content: [
            {
              key: 'pointId',
              translationKey: 'transformers.mapping.point-id',
              type: 'OibText',
              defaultValue: '',
              validators: [{ key: 'required' }],
              displayInViewMode: true
            },
            {
              key: 'topic',
              translationKey: 'transformers.mapping.mqtt.topic',
              type: 'OibText',
              defaultValue: '',
              validators: [{ key: 'required' }],
              displayInViewMode: true
            }
          ],
          class: 'col',
          newRow: true,
          displayInViewMode: false
        }
      ]
    };
    transformerService.get.and.returnValue(of(transformer));
    tester.componentInstance.prepare('time-values', [transformer], ['mqtt'], transformer, {
      mapping: [
        { pointId: 'pointId1', nodeId: 'nodeId1', dataType: 'Int32' },
        { pointId: 'pointId2', nodeId: 'nodeId2', dataType: 'Int32' }
      ]
    });
    tester.detectChanges();
    expect(tester.transformerSelect).toBeDefined();
    expect(tester.options).toBeDefined();
    expect(tester.title).toContainText('Choose how to handle OIBus time values payloads');
    tester.save.click();
    expect(fakeActiveModal.close).toHaveBeenCalledWith({
      transformer: transformer,
      options: {
        mapping: [
          { pointId: 'pointId1', nodeId: 'nodeId1', dataType: 'Int32' },
          { pointId: 'pointId2', nodeId: 'nodeId2', dataType: 'Int32' }
        ]
      }
    });
  });
});
