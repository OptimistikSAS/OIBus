import { TestBed } from '@angular/core/testing';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { OIBusArrayFormControlComponent } from './oibus-array-form-control.component';
import testData from '../../../../../../backend/src/tests/utils/test-data';
import { OIBusArrayAttribute } from '../../../../../../backend/shared/model/form.model';
import { ScanModeDTO } from '../../../../../../backend/shared/model/scan-mode.model';
import { CertificateDTO } from '../../../../../../backend/shared/model/certificate.model';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { MockModalService, provideModalTesting } from '../../mock-modal.service.testing';
import { OIBusEditArrayElementModalComponent } from './oibus-edit-array-element-modal/oibus-edit-array-element-modal.component';
import { SouthConnectorService } from '../../../services/south-connector.service';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { createMock } from '../../../../test/vitest-create-mock';

@Component({
  selector: 'oib-test-oibus-array-form-control-component',
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
  imports: [OIBusArrayFormControlComponent, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestComponent {
  formControl: FormControl<Array<any>> = new FormControl<Array<any>>([{}, {}]) as FormControl<Array<any>>;
  formGroup = new FormGroup({
    testGroup: new FormGroup({
      testKey: this.formControl
    })
  });

  parentGroup = new FormGroup<any>({});
  scanModes = testData.scanMode.list as unknown as Array<ScanModeDTO>;
  certificates = testData.certificates.list as unknown as Array<CertificateDTO>;
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

class TestComponentTester {
  readonly fixture = TestBed.createComponent(TestComponent);
  readonly component = this.fixture.componentInstance;
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly addElement = this.root.getByCss('#oibus-array-add-element-button');
  readonly editButtons = this.root.getByCss('.edit-button');
  readonly copyButtons = this.root.getByCss('.copy-button');
  readonly deleteButtons = this.root.getByCss('.delete-button');
}

describe('OIBusArrayFormControlComponent', () => {
  let tester: TestComponentTester;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClientTesting(),
        provideI18nTesting(),
        provideModalTesting(),
        { provide: SouthConnectorService, useValue: createMock(SouthConnectorService) }
      ]
    });

    tester = new TestComponentTester();
    tester.fixture.detectChanges();
  });

  test('should add an element', async () => {
    const mockModalService = TestBed.inject(MockModalService);
    const fakeModalComponent = createMock(OIBusEditArrayElementModalComponent);
    mockModalService.mockClosedModal(fakeModalComponent);

    await tester.addElement.click();

    expect(fakeModalComponent.prepareForCreation).toHaveBeenCalledWith(
      tester.component.scanModes,
      tester.component.certificates,
      tester.component.parentGroup,
      tester.component.arrayAttribute.rootAttribute
    );
  });

  test('should edit an element', async () => {
    const mockModalService = TestBed.inject(MockModalService);
    const fakeModalComponent = createMock(OIBusEditArrayElementModalComponent);
    mockModalService.mockClosedModal(fakeModalComponent);

    await expect.element(tester.editButtons).toHaveLength(2);
    await tester.editButtons.nth(0).click();

    expect(fakeModalComponent.prepareForEdition).toHaveBeenCalledWith(
      tester.component.scanModes,
      tester.component.certificates,
      tester.component.parentGroup,
      {},
      tester.component.arrayAttribute.rootAttribute
    );
  });

  test('should copy an element', async () => {
    const mockModalService = TestBed.inject(MockModalService);
    const fakeModalComponent = createMock(OIBusEditArrayElementModalComponent);
    mockModalService.mockClosedModal(fakeModalComponent);

    await expect.element(tester.copyButtons).toHaveLength(2);
    await tester.copyButtons.nth(0).click();

    expect(fakeModalComponent.prepareForCopy).toHaveBeenCalledWith(
      tester.component.scanModes,
      tester.component.certificates,
      tester.component.parentGroup,
      {},
      tester.component.arrayAttribute.rootAttribute
    );
  });

  test('should delete an element', async () => {
    const mockModalService = TestBed.inject(MockModalService);
    const fakeModalComponent = createMock(OIBusEditArrayElementModalComponent);
    mockModalService.mockClosedModal(fakeModalComponent);

    await expect.element(tester.deleteButtons).toHaveLength(2);
    await tester.deleteButtons.nth(0).click();
    tester.fixture.detectChanges();

    expect(tester.component.formControl.value.length).toEqual(1);
  });
});
