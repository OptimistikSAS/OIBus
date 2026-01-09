import { EditNorthTransformerModalComponent } from './edit-north-transformer-modal.component';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TestBed } from '@angular/core/testing';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { DefaultValidationErrorsComponent } from '../../../shared/default-validation-errors/default-validation-errors.component';
import { By } from '@angular/platform-browser';
import { OIBusObjectFormControlComponent } from '../../../shared/form/oibus-object-form-control/oibus-object-form-control.component';
import { TransformerDTO } from '../../../../../../backend/shared/model/transformer.model';

class EditNorthTransformerModalComponentTester extends ComponentTester<EditNorthTransformerModalComponent> {
  constructor() {
    super(EditNorthTransformerModalComponent);
  }

  get title() {
    return this.element('h4');
  }

  get transformerSelect() {
    return this.select('#output')!;
  }

  get options() {
    return this.debugElement.query(By.directive(OIBusObjectFormControlComponent))!;
  }

  get save() {
    return this.button('#save-button')!;
  }

  get cancel() {
    return this.button('#cancel-button')!;
  }
}

const transformer: TransformerDTO = {
  id: 'time-values-to-mqtt',
  type: 'standard',
  functionName: 'time-values-to-mqtt',
  inputType: 'time-values',
  outputType: 'mqtt',
  manifest: {
    type: 'object',
    key: 'configuration.oibus.manifest.transformers.options',
    translationKey: '',
    attributes: [
      {
        type: 'array',
        key: 'mapping',
        translationKey: 'configuration.oibus.manifest.transformers.time-values-to-modbus.mapping.title',
        paginate: true,
        numberOfElementPerPage: 20,
        validators: [],
        rootAttribute: {
          type: 'object',
          key: 'item',
          translationKey: '',
          displayProperties: {
            visible: true,
            wrapInBox: false
          },
          enablingConditions: [],
          validators: [],
          attributes: [
            {
              type: 'string',
              key: 'pointId',
              translationKey: 'configuration.oibus.manifest.transformers.time-values-to-modbus.mapping.point-id',
              defaultValue: null,
              validators: [
                {
                  type: 'REQUIRED',
                  arguments: []
                }
              ],
              displayProperties: {
                row: 0,
                columns: 4,
                displayInViewMode: true
              }
            },
            {
              type: 'string',
              key: 'address',
              translationKey: 'configuration.oibus.manifest.transformers.time-values-to-modbus.mapping.address',
              defaultValue: null,
              validators: [
                {
                  type: 'REQUIRED',
                  arguments: []
                }
              ],
              displayProperties: {
                row: 0,
                columns: 4,
                displayInViewMode: true
              }
            },
            {
              type: 'string-select',
              key: 'modbusType',
              translationKey: 'configuration.oibus.manifest.transformers.time-values-to-modbus.mapping.modbus-type',
              defaultValue: 'register',
              selectableValues: ['coil', 'register'],
              validators: [
                {
                  type: 'REQUIRED',
                  arguments: []
                }
              ],
              displayProperties: {
                row: 0,
                columns: 4,
                displayInViewMode: true
              }
            }
          ]
        }
      }
    ],
    enablingConditions: [],
    validators: [],
    displayProperties: {
      visible: true,
      wrapInBox: false
    }
  }
};

describe('EditNorthTransformerModalComponent', () => {
  let tester: EditNorthTransformerModalComponentTester;
  let fakeActiveModal: NgbActiveModal;

  beforeEach(() => {
    fakeActiveModal = createMock(NgbActiveModal);

    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), { provide: NgbActiveModal, useValue: fakeActiveModal }]
    });

    TestBed.createComponent(DefaultValidationErrorsComponent).detectChanges();

    tester = new EditNorthTransformerModalComponentTester();
  });

  it('should cancel', () => {
    tester.cancel.click();
    expect(fakeActiveModal.dismiss).toHaveBeenCalled();
  });

  it('should display title and form, and validate without transformers', async () => {
    tester.componentInstance.prepareForCreation([], [], [], [], [transformer], []);
    await tester.change();
    expect(tester.title).toContainText('Choose how to handle payloads');
    expect(tester.options).toBeNull();
    tester.save.click();
    expect(fakeActiveModal.close).not.toHaveBeenCalled();
  });

  it('should validate with transformers', async () => {
    tester.componentInstance.prepareForEdition(
      [],
      [],
      [],
      {
        id: 'northTransformerId1',
        transformer,
        options: {
          mapping: [
            { pointId: 'pointId1', nodeId: 'nodeId1', dataType: 'Int32' },
            { pointId: 'pointId2', nodeId: 'nodeId2', dataType: 'Int32' }
          ]
        },
        inputType: transformer.inputType,
        south: undefined,
        items: []
      },
      [transformer],
      ['mqtt']
    );
    await tester.change();
    expect(tester.options).toBeDefined();
    expect(tester.title).toContainText('Choose how to handle payloads');
    await tester.save.click();
    expect(fakeActiveModal.close).toHaveBeenCalledWith({
      id: 'northTransformerId1',
      transformer: transformer,
      options: {
        mapping: [
          { pointId: 'pointId1', nodeId: 'nodeId1', dataType: 'Int32' },
          { pointId: 'pointId2', nodeId: 'nodeId2', dataType: 'Int32' }
        ]
      },
      south: undefined,
      inputType: transformer.inputType,
      items: []
    });
  });
});
