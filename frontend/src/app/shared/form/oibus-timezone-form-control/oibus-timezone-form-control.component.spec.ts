import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { ComponentTester } from 'ngx-speculoos';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NgbTypeaheadModule } from '@ng-bootstrap/ng-bootstrap';
import { OIBusTimezoneFormControlComponent } from './oibus-timezone-form-control.component';
import { OIBusTimezoneAttribute } from '../../../../../../backend/shared/model/form.model';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { TYPEAHEAD_DEBOUNCE_TIME } from '../typeahead';

@Component({
  selector: 'oib-test-oibus-timezone-form-control-component',
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

  get suggestions() {
    return this.elements('ngb-typeahead-window.dropdown-menu button.dropdown-item');
  }

  get suggestionLabels() {
    return this.suggestions.map(s => s.textContent?.trim() ?? '');
  }
}

describe('OIBusTimezoneFormControlComponent', () => {
  let tester: TestComponentTester;

  afterEach(() => {
    vi.useRealTimers();
  });

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
    expect(tester.label.nativeElement.textContent).toContain('Timezone');
  });

  test('should have typeahead functionality', async () => {
    vi.useFakeTimers();
    expect(tester.field.nativeElement).toHaveValue('');

    tester.field.fillWith('Par');
    vi.advanceTimersByTime(TYPEAHEAD_DEBOUNCE_TIME);
    await tester.change();

    expect(tester.suggestionLabels).toEqual(['America/Paramaribo', 'Europe/Paris']);

    const europeParisBtn = tester.suggestions.find(s => s.textContent?.trim() === 'Europe/Paris');
    (europeParisBtn!.nativeElement as HTMLElement).click();
    vi.advanceTimersByTime(TYPEAHEAD_DEBOUNCE_TIME);
    await tester.change();

    expect(tester.field.nativeElement).toHaveValue('Europe/Paris');
  });
});
