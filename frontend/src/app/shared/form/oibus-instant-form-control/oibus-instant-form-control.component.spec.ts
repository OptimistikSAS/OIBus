import { TestBed } from '@angular/core/testing';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { OIBusInstantAttribute } from '../../../../../../backend/shared/model/form.model';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { OIBusInstantFormControlComponent } from './oibus-instant-form-control.component';
import { provideCurrentUser } from '../../current-user-testing-vitest';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

@Component({
  selector: 'oib-test-oibus-instant-form-control-component',
  template: `
    <form [formGroup]="formGroup">
      <ng-container formGroupName="testGroup">
        <oib-oibus-instant-form-control [instantAttribute]="instantAttribute" />
      </ng-container>
    </form>
  `,
  imports: [ReactiveFormsModule, OIBusInstantFormControlComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestComponent {
  instantAttribute: OIBusInstantAttribute = {
    type: 'instant',
    key: 'testKey',
    translationKey: 'configuration.oibus.manifest.south.items.mssql.date-time-fields.field-name'
  } as OIBusInstantAttribute;

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
  readonly field = this.root.getByCss('input').nth(0);
}

describe('OIBusInstantFormControlComponent', () => {
  let tester: TestComponentTester;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), provideCurrentUser()]
    });

    tester = new TestComponentTester();
    tester.fixture.detectChanges();
  });

  test('should display a label with the correct translation key', async () => {
    await expect.element(tester.label).toBeInTheDocument();
  });

  test('should display an input with the correct form control name', async () => {
    await tester.field.fill('123');
    await expect.element(tester.field).toHaveValue('123');
  });
});
