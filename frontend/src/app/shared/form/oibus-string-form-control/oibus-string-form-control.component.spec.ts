import { TestBed } from '@angular/core/testing';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { OIBusStringFormControlComponent } from './oibus-string-form-control.component';
import { OIBusStringAttribute } from '../../../../../../backend/shared/model/form.model';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

@Component({
  selector: 'oib-test-oibus-string-form-control-component',
  template: `
    <form [formGroup]="formGroup">
      <ng-container formGroupName="testGroup">
        <oib-oibus-string-form-control [stringAttribute]="stringAttribute" />
      </ng-container>
    </form>
  `,
  imports: [ReactiveFormsModule, OIBusStringFormControlComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
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

class TestComponentTester {
  readonly fixture = TestBed.createComponent(TestComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly label = this.root.getByText('Field name');
  readonly field = this.root.getByCss('input');
}

describe('OIBusStringFormControlComponent', () => {
  let tester: TestComponentTester;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideI18nTesting()]
    });

    tester = new TestComponentTester();
    tester.fixture.detectChanges();
  });

  test('should display a label with the correct translation key', async () => {
    await expect.element(tester.label).toBeInTheDocument();
  });

  test('should display an input with the correct form control name', async () => {
    await tester.field.fill('test');
    await expect.element(tester.field).toHaveValue('test');
  });
});
