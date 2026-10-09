import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { NgbTypeahead } from '@ng-bootstrap/ng-bootstrap';
import { Observable, of, switchMap } from 'rxjs';
import { beforeEach, describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { NonEditableTypeaheadDirective } from './non-editable-typeahead.directive';
import { provideNgbConfigTesting } from './oi-ngb-testing';

@Component({
  selector: 'oib-test-non-editable-typeahead-component',
  template: `
    <input aria-label="Non editable" [ngbTypeahead]="search" [formControl]="nonEditable" [editable]="false" />
    <input aria-label="Editable" [ngbTypeahead]="search" [formControl]="editable" />
  `,
  imports: [ReactiveFormsModule, NgbTypeahead, NonEditableTypeaheadDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestComponent {
  readonly nonEditable = new FormControl<string | null>(null);
  readonly editable = new FormControl<string | null>(null);

  readonly search = (text$: Observable<string>) => text$.pipe(switchMap(() => of<Array<string>>([])));
}

describe('NonEditableTypeaheadDirective', () => {
  let component: TestComponent;
  const nonEditable = page.getByLabelText('Non editable');
  const editable = page.getByLabelText('Editable');

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideNgbConfigTesting()] });
    component = TestBed.createComponent(TestComponent).componentInstance;
  });

  test('should clear a non-editable input without valid value on blur', async () => {
    await nonEditable.fill('unknown');
    expect(component.nonEditable.value).toBeNull();

    await userEvent.tab();

    await expect.element(nonEditable).toHaveValue('');
  });

  test('should keep a non-editable input with a valid value on blur', async () => {
    component.nonEditable.setValue('known');
    await expect.element(nonEditable).toHaveValue('known');
    await nonEditable.click();

    await userEvent.tab();

    await expect.element(nonEditable).toHaveValue('known');
  });

  test('should keep the text of an editable input on blur', async () => {
    await editable.fill('free text');

    await userEvent.tab();

    await expect.element(editable).toHaveValue('free text');
    expect(component.editable.value).toBe('free text');
  });
});
