import { TestBed } from '@angular/core/testing';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { OIBusSecretAttribute } from '../../../../../../backend/shared/model/form.model';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { OIBusSecretFormControlComponent } from './oibus-secret-form-control.component';
import { OIBUS_FORM_MODE } from '../oibus-form-mode.token';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

@Component({
  selector: 'oib-test-oibus-secret-form-control-component',
  template: `
    <form [formGroup]="formGroup">
      <ng-container formGroupName="testGroup">
        <oib-oibus-secret-form-control [secretAttribute]="secretAttribute" />
      </ng-container>
    </form>
  `,
  imports: [ReactiveFormsModule, OIBusSecretFormControlComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestComponent {
  secretAttribute: OIBusSecretAttribute = {
    type: 'secret',
    key: 'testKey',
    translationKey: 'configuration.oibus.manifest.south.items.mssql.date-time-fields.field-name'
  } as OIBusSecretAttribute;

  formGroup = new FormGroup({
    testGroup: new FormGroup({
      testKey: new FormControl('')
    })
  });
}

class TestComponentTester {
  readonly fixture = TestBed.createComponent(TestComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly field = this.root.getByCss('input');
}

describe('OIBusSecretFormControlComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideI18nTesting()]
    });
  });

  test('should render without placeholder when mode is create', async () => {
    const tester = new TestComponentTester();
    tester.fixture.detectChanges();

    await expect.element(tester.field).not.toHaveAttribute('placeholder');
  });

  test('should display placeholder when mode is edit', async () => {
    TestBed.overrideProvider(OIBUS_FORM_MODE, { useValue: () => 'edit' });
    const tester = new TestComponentTester();
    tester.fixture.detectChanges();

    await expect.element(tester.field).toHaveAttribute('placeholder', 'Leave empty to keep the existing secret');
  });
});
