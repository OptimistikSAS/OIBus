import { TestBed } from '@angular/core/testing';

import { OibTransformerComponent } from './oib-transformer.component';
import { Component } from '@angular/core';
import { ComponentTester } from 'ngx-speculoos';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { TransformerDTO } from '../../../../../../backend/shared/model/transformer.model';
import testData from '../../../../../../backend/src/tests/utils/test-data';

@Component({
  template: `<form [formGroup]="form">
    <div formGroupName="settings">
      <oib-transformer [transformers]="transformers" key="transformer" formControlName="transformer" />
    </div>
  </form>`,
  imports: [OibTransformerComponent, ReactiveFormsModule]
})
class TestComponent {
  transformers = [
    ...testData.transformers.list,
    {
      id: 'iso',
      type: 'standard',
      inputType: 'time-values',
      outputType: 'time-values',
      functionName: 'iso',
      manifest: {}
    }
  ] as Array<TransformerDTO>;
  form = new FormGroup({ settings: new FormGroup({ transformer: new FormControl('') }) });
}
class OibFormComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  get oibFormInput() {
    return this.select('#OibTransformer-transformer')!;
  }
}

describe('OibTransformerComponent', () => {
  let tester: OibFormComponentTester;

  beforeEach(() => {
    TestBed.configureTestingModule({});

    TestBed.configureTestingModule({
      providers: [provideI18nTesting()]
    });

    tester = new OibFormComponentTester();
    tester.detectChanges();
  });

  it('should have a select input', () => {
    expect(tester.oibFormInput).not.toBeNull();
  });

  it('should change value', () => {
    tester.oibFormInput.selectLabel('No transform');
    expect(tester.oibFormInput).toHaveSelectedLabel('No transform');
  });
});
