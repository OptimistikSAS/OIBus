import { TestBed } from '@angular/core/testing';

import { OibTransformerComponent } from './oib-transformer.component';
import { Component } from '@angular/core';
import { OibTransformerFormControl } from '../../../../../../backend/shared/model/form.model';
import { formDirectives } from '../../form-directives';
import { ComponentTester } from 'ngx-speculoos';
import { FormControl, FormGroup } from '@angular/forms';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { TransformerDTO } from '../../../../../../backend/shared/model/transformer.model';

@Component({
  template: `<form [formGroup]="form">
    <div formGroupName="settings">
      <oib-transformer [transformers]="transformers" [key]="settings.key" [formControlName]="settings.key" />
    </div>
  </form>`,
  imports: [OibTransformerComponent, ...formDirectives]
})
class TestComponent {
  settings: OibTransformerFormControl = {
    key: 'myOibTransformer',
    type: 'OibTransformer',
    translationKey: 'transformer field'
  } as OibTransformerFormControl;
  transformers: Array<TransformerDTO> = [
    {
      id: 'transformerId',
      name: 'transformer1',
      description: '',
      type: 'custom',
      inputType: 'any',
      outputType: 'any',
      customCode: '',
      manifest: []
    },
    {
      id: 'iso',
      type: 'standard',
      inputType: 'time-values',
      outputType: 'time-values',
      functionName: 'iso',
      manifest: []
    }
  ];
  form = new FormGroup({ settings: new FormGroup({ myOibTransformer: new FormControl('') }) });
}
class OibFormComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  get oibFormInput() {
    return this.select('#OibTransformer-myOibTransformer')!;
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
