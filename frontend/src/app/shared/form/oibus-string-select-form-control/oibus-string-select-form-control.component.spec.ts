import { TestBed } from '@angular/core/testing';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { OIBusStringSelectFormControlComponent } from './oibus-string-select-form-control.component';
import { OIBusStringSelectAttribute } from '../../../../../../backend/shared/model/form.model';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

@Component({
  selector: 'oib-test-oibus-string-select-form-control-component',
  template: `
    <form [formGroup]="formGroup">
      <ng-container formGroupName="testGroup">
        <oib-oibus-string-select-form-control [stringSelectAttribute]="stringSelectAttribute" />
      </ng-container>
    </form>
  `,
  imports: [ReactiveFormsModule, TranslateModule, OIBusStringSelectFormControlComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestComponent {
  stringSelectAttribute: OIBusStringSelectAttribute = {
    type: 'string-select',
    key: 'testKey',
    translationKey: 'configuration.oibus.manifest.south.items.mssql.date-time-fields.type',
    selectableValues: ['iso-string', 'unix-epoch']
  } as OIBusStringSelectAttribute;

  formGroup = new FormGroup({
    testGroup: new FormGroup({
      testKey: new FormControl('')
    })
  });
}

class TestComponentTester {
  readonly fixture = TestBed.createComponent(TestComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly label = this.root.getByText('Type');
  readonly field = this.root.getByCss('select');
  readonly options = this.root.getByCss('option');
}

describe('OIBusStringSelectFormControlComponent', () => {
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

  test('should display a select with the correct form control name', async () => {
    await tester.field.selectOptions('iso-string');
    await expect.element(tester.field).toHaveValue('iso-string');
    await expect.element(tester.options.nth(1)).toHaveTextContent('ISO String');
  });

  test('should display options for each selectable value', async () => {
    await expect.element(tester.options).toHaveLength(3); // One for the null option and one for each value
    await expect.element(tester.options.nth(1)).toHaveTextContent('ISO String');
    await expect.element(tester.options.nth(2)).toHaveTextContent('UNIX epoch (s)');
  });
});
