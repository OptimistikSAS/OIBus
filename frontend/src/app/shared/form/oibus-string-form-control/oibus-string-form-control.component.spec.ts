import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { ComponentTester } from 'ngx-speculoos';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { OIBusStringFormControlComponent } from './oibus-string-form-control.component';
import { OIBusStringAttribute } from '../../../../../../backend/shared/model/form.model';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { beforeEach, describe, expect, test } from 'vitest';

@Component({
  selector: 'oib-test-oibus-string-form-control-component',
  template: `
    <form [formGroup]="formGroup">
      <ng-container formGroupName="testGroup">
        <oib-oibus-string-form-control [stringAttribute]="stringAttribute" />
      </ng-container>
    </form>
  `,
  imports: [ReactiveFormsModule, OIBusStringFormControlComponent]
})
class TestComponent {
  stringAttribute: OIBusStringAttribute = {
    type: 'string',
    key: 'testKey',
    translationKey: 'configuration.oibus.manifest.south.items.mssql.date-time-fields.field-name'
  } as OIBusStringAttribute;

  formGroup = new FormGroup({
    testGroup: new FormGroup({
      testKey: new FormControl('')
    })
  });
}

class TestComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  get label() {
    return this.element('label')!;
  }

  get field() {
    return this.input('input')!;
  }
}

describe('OIBusStringFormControlComponent', () => {
  let tester: TestComponentTester;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideI18nTesting()]
    });

    tester = new TestComponentTester();
    await tester.change();
  });

  test('should create the component', () => {
    expect(tester.componentInstance).toBeDefined();
  });

  test('should display a label with the correct translation key', () => {
    expect(tester.label).toBeDefined();
    expect(tester.label.nativeElement.textContent).toContain('Field name');
  });

  test('should display an input with the correct form control name', () => {
    expect(tester.field).toBeDefined();
    tester.field.fillWith('test');
    expect(tester.field.nativeElement).toHaveValue('test');
  });
});
