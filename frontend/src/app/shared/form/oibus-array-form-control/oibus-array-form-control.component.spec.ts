import { TestBed } from '@angular/core/testing';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { Component } from '@angular/core';
import { ComponentTester, createMock, TestButton } from 'ngx-speculoos';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { OIBusArrayFormControlComponent } from './oibus-array-form-control.component';
import testData from '../../../../../../backend/src/tests/utils/test-data';
import { OIBusArrayAttribute } from '../../../../../../backend/shared/model/form.model';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { MockModalService, provideModalTesting } from '../../mock-modal.service.spec';
import { OIBusEditArrayElementModalComponent } from './oibus-edit-array-element-modal/oibus-edit-array-element-modal.component';
import { NotificationService } from '../../notification.service';
import { SouthConnectorService } from '../../../services/south-connector.service';

@Component({
  selector: 'test-oibus-array-form-control-component',
  template: `<form [formGroup]="formGroup">
    <ng-container formGroupName="testGroup">
      <oib-oibus-array-form-control
        [control]="formControl"
        [arrayAttribute]="arrayAttribute"
        [parentGroup]="parentGroup"
        [scanModes]="scanModes"
        [certificates]="certificates"
      />
    </ng-container>
  </form>`,
  imports: [OIBusArrayFormControlComponent, ReactiveFormsModule]
})
class TestComponent {
  formControl: FormControl<Array<any>> = new FormControl<Array<any>>([{}, {}]) as FormControl<Array<any>>;
  formGroup = new FormGroup({
    testGroup: new FormGroup({
      testKey: this.formControl
    })
  });

  parentGroup = new FormGroup<any>({});
  scanModes = testData.scanMode.list;
  certificates = testData.certificates.list;
  arrayAttribute: OIBusArrayAttribute = {
    type: 'array',
    paginate: true,
    numberOfElementPerPage: 25,
    key: 'items',
    translationKey: 'configuration.oibus.manifest.south.items',
    validators: [],
    rootAttribute: {
      type: 'object',
      key: 'item',
      translationKey: 'configuration.oibus.manifest.south.items.item',
      validators: [],
      attributes: [],
      enablingConditions: [],
      displayProperties: {
        visible: true,
        wrapInBox: false
      }
    }
  };
}

class TestComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  get addElement() {
    return this.button('#oibus-array-add-element-button')!;
  }

  get editButtons() {
    return this.elements('.edit-button')! as Array<TestButton>;
  }

  get copyButtons() {
    return this.elements('.copy-button')! as Array<TestButton>;
  }

  get deleteButtons() {
    return this.elements('.delete-button')! as Array<TestButton>;
  }
}

describe('OIBusArrayFormControlComponent', () => {
  let tester: TestComponentTester;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClientTesting(),
        provideI18nTesting(),
        provideModalTesting(),
        { provide: SouthConnectorService, useValue: createMock(SouthConnectorService) },
        { provide: NotificationService, useValue: createMock(NotificationService) }
      ]
    });

    tester = new TestComponentTester();
    await tester.change();
  });

  it('should add an element', async () => {
    const mockModalService = TestBed.inject(MockModalService);
    const fakeModalComponent = createMock(OIBusEditArrayElementModalComponent);
    mockModalService.mockClosedModal(fakeModalComponent);

    await tester.addElement.click();

    expect(fakeModalComponent.prepareForCreation).toHaveBeenCalledWith(
      tester.componentInstance.scanModes,
      tester.componentInstance.certificates,
      tester.componentInstance.parentGroup,
      tester.componentInstance.arrayAttribute.rootAttribute
    );
  });

  it('should edit an element', async () => {
    const mockModalService = TestBed.inject(MockModalService);
    const fakeModalComponent = createMock(OIBusEditArrayElementModalComponent);
    mockModalService.mockClosedModal(fakeModalComponent);

    expect(tester.editButtons.length).toEqual(2);
    await tester.editButtons[0].click();

    expect(fakeModalComponent.prepareForEdition).toHaveBeenCalledWith(
      tester.componentInstance.scanModes,
      tester.componentInstance.certificates,
      tester.componentInstance.parentGroup,
      {},
      tester.componentInstance.arrayAttribute.rootAttribute
    );
  });

  it('should copy an element', async () => {
    const mockModalService = TestBed.inject(MockModalService);
    const fakeModalComponent = createMock(OIBusEditArrayElementModalComponent);
    mockModalService.mockClosedModal(fakeModalComponent);

    expect(tester.copyButtons.length).toEqual(2);
    await tester.copyButtons[0].click();

    expect(fakeModalComponent.prepareForCopy).toHaveBeenCalledWith(
      tester.componentInstance.scanModes,
      tester.componentInstance.certificates,
      tester.componentInstance.parentGroup,
      {},
      tester.componentInstance.arrayAttribute.rootAttribute
    );
  });

  it('should delete an element', async () => {
    const mockModalService = TestBed.inject(MockModalService);
    const fakeModalComponent = createMock(OIBusEditArrayElementModalComponent);
    mockModalService.mockClosedModal(fakeModalComponent);

    expect(tester.deleteButtons.length).toEqual(2);
    await tester.deleteButtons[0].click();

    expect(tester.componentInstance.formControl.value.length).toEqual(1);
  });
});
