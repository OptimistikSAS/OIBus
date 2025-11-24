import { fakeAsync, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { ComponentTester } from 'ngx-speculoos';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NgbTypeaheadModule } from '@ng-bootstrap/ng-bootstrap';
import { OIBusTimezoneFormControlComponent } from './oibus-timezone-form-control.component';
import { OIBusTimezoneAttribute } from '../../../../../../backend/shared/model/form.model';
import { TestTypeahead } from '../typeahead.test-utils';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';

@Component({
  template: `
    <form [formGroup]="formGroup">
      <ng-container formGroupName="testGroup">
        <oib-oibus-timezone-form-control [timezoneAttribute]="timezoneAttribute" />
      </ng-container>
    </form>
  `,
  imports: [ReactiveFormsModule, OIBusTimezoneFormControlComponent, NgbTypeaheadModule]
})
class TestComponent {
  timezoneAttribute: OIBusTimezoneAttribute = {
    type: 'timezone',
    key: 'testKey',
    translationKey: 'configuration.oibus.manifest.south.items.mssql.date-time-fields.timezone'
  } as OIBusTimezoneAttribute;

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

  get timezoneTypeahead() {
    return this.custom('#testKey', TestTypeahead)!;
  }
}

describe('OIBusTimezoneFormControlComponent', () => {
  let tester: TestComponentTester;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideI18nTesting()]
    });

    tester = new TestComponentTester();
    await tester.change();
  });

  it('should create the component', () => {
    expect(tester.componentInstance).toBeDefined();
  });

  it('should display a label with the correct translation key', () => {
    expect(tester.label).toBeDefined();
    expect(tester.label).toContainText('Timezone');
  });

  it('should have typeahead functionality', fakeAsync(() => {
    expect(tester.timezoneTypeahead).toHaveValue('');

    tester.timezoneTypeahead.fillWith('Par');
    expect(tester.timezoneTypeahead.suggestionLabels).toEqual(['America/Paramaribo', 'Europe/Paris']);
    tester.timezoneTypeahead.selectLabel('Europe/Paris');
    expect(tester.timezoneTypeahead).toHaveValue('Europe/Paris');
  }));
});
