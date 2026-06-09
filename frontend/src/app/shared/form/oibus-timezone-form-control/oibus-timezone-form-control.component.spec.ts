import { TestBed } from '@angular/core/testing';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NgbTypeaheadModule } from '@ng-bootstrap/ng-bootstrap';
import { OIBusTimezoneFormControlComponent } from './oibus-timezone-form-control.component';
import { OIBusTimezoneAttribute } from '../../../../../../backend/shared/model/form.model';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
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
  imports: [ReactiveFormsModule, OIBusTimezoneFormControlComponent, NgbTypeaheadModule],
  changeDetection: ChangeDetectionStrategy.OnPush
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

class TestComponentTester {
  readonly fixture = TestBed.createComponent(TestComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly label = this.root.getByText('Timezone');
  readonly field = this.root.getByCss('input');
  readonly suggestions = page.getByCss('ngb-typeahead-window.dropdown-menu button.dropdown-item');

  get suggestionLabels() {
    return this.suggestions.elements().map(s => s.textContent?.trim() ?? '');
  }

  async fillWith(text: string) {
    const input = this.field.element() as HTMLInputElement;
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await vi.advanceTimersByTimeAsync(2 * TYPEAHEAD_DEBOUNCE_TIME);
  }
}

describe('OIBusTimezoneFormControlComponent', () => {
  let tester: TestComponentTester;

  afterEach(() => {
    vi.useRealTimers();
  });

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

  test('should have typeahead functionality', async () => {
    vi.useFakeTimers();
    await expect.element(tester.field).toHaveValue('');

    await tester.fillWith('Par');
    tester.fixture.detectChanges();

    expect(tester.suggestionLabels).toEqual(['America/Paramaribo', 'Europe/Paris']);

    await tester.suggestions.nth(1).click();
    await vi.advanceTimersByTimeAsync(TYPEAHEAD_DEBOUNCE_TIME);

    await expect.element(tester.field).toHaveValue('Europe/Paris');
  });
});
