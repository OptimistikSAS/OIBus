import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';

import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { FieldOperation } from '@oibus/shared/connector/field-process.model';
import { OIBusFieldProcessAttribute } from '@oibus/shared/connector/form.model';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { createMock } from '../../../../test/vitest-create-mock';
import { FieldProcessModalComponent } from '../../field-process-modal/field-process-modal.component';
import { FieldProcessSamplesService } from '../../field-process-modal/field-process-samples.service';
import { MockModalService, provideModalTesting } from '../../mock-modal.service.testing';
import { OIBusFieldProcessFormControlComponent } from './oibus-field-process-form-control.component';

class OIBusFieldProcessFormControlComponentTester {
  readonly fixture = TestBed.createComponent(OIBusFieldProcessFormControlComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly label = this.root.getByText('Value processing');
  readonly operations = this.root.getByCss('.field-operation-badge');
  readonly none = this.root.getByCss('.field-process-none');
  readonly setUpButton = this.root.getByRole('button', { name: 'Set up…' });

  constructor(group: FormGroup) {
    this.fixture.componentRef.setInput('fieldProcessAttribute', attribute);
    this.fixture.componentRef.setInput('group', group);
  }
}

const attribute: OIBusFieldProcessAttribute = {
  type: 'field-process',
  key: 'valueProcess',
  translationKey: 'configuration.oibus.manifest.transformers.record-list-to-oianalytics.value.value-process',
  fieldKey: 'valueField',
  validators: [],
  displayProperties: { row: 0, columns: 8, displayInViewMode: false }
};

describe('OIBusFieldProcessFormControlComponent', () => {
  let modalService: MockModalService<FieldProcessModalComponent>;
  let samples: FieldProcessSamplesService;
  let group: FormGroup<{ valueField: FormControl<string>; valueProcess: FormControl<Array<FieldOperation>> }>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideI18nTesting(), provideModalTesting()] });
    modalService = TestBed.inject(MockModalService);
    samples = TestBed.inject(FieldProcessSamplesService);
    group = new FormGroup({
      valueField: new FormControl('value', { nonNullable: true }),
      valueProcess: new FormControl<Array<FieldOperation>>([{ type: 'trim' }, { type: 'round', decimals: 2 }], { nonNullable: true })
    });
  });

  test('should show the operations in order, and none when there is no operation', async () => {
    const tester = new OIBusFieldProcessFormControlComponentTester(group);

    await expect.element(tester.label).toBeInTheDocument();
    await expect.element(tester.operations).toHaveLength(2);
    await expect.element(tester.operations.nth(1)).toHaveTextContent('Round');

    // patched by a parent, e.g. when an array element is edited
    group.controls.valueProcess.setValue([]);
    await expect.element(tester.none).toHaveTextContent('No processing');
  });

  test('should set up the operations on the values of the field from the last transformer test', async () => {
    samples.setContent({
      type: 'record-list',
      content: [
        { pointId: 'a', value: 1.234 },
        { pointId: 'b', value: null },
        { pointId: 'c', value: 5.678 }
      ]
    });
    const fieldProcessModal = createMock(FieldProcessModalComponent);
    modalService.mockClosedModal(fieldProcessModal, [{ type: 'uppercase' }]);
    const tester = new OIBusFieldProcessFormControlComponentTester(group);

    await tester.setUpButton.click();

    expect(fieldProcessModal.initialize).toHaveBeenCalledWith('value', [{ type: 'trim' }, { type: 'round', decimals: 2 }], [1.234, 5.678]);
    expect(group.controls.valueProcess.value).toEqual([{ type: 'uppercase' }]);
    expect(group.controls.valueProcess.dirty).toBe(true);
    await expect.element(tester.operations).toHaveLength(1);
  });

  test('should name the processing by its label when the field is not set yet', async () => {
    group.controls.valueField.setValue('');
    const fieldProcessModal = createMock(FieldProcessModalComponent);
    modalService.mockDismissedModal(fieldProcessModal);
    const tester = new OIBusFieldProcessFormControlComponentTester(group);

    await tester.setUpButton.click();

    expect(fieldProcessModal.initialize).toHaveBeenCalledWith('Value processing', [{ type: 'trim' }, { type: 'round', decimals: 2 }], []);
    expect(group.controls.valueProcess.value).toHaveLength(2);
  });
});
