import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';

import { beforeEach, describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { byIdComparisonFn } from '../../test-utils';
import { MultiSelectComponent } from './multi-select.component';
import { MultiSelectOptionDirective } from './multi-select-option.directive';

interface User {
  id: number;
  name: string;
}

const users: Array<User> = [
  { id: 1, name: 'Cedric' },
  { id: 2, name: 'JB' },
  { id: 3, name: 'Marouane' }
];

@Component({
  selector: 'oib-test-multi-select-component',
  template: `
    <form [formGroup]="form">
      <oib-multi-select
        [placeholder]="placeholder()"
        [isSmall]="isSmall()"
        formControlName="users"
        (selectionChange)="changeEvents.push($event)"
      >
        @for (user of users; track user.id) {
          <oib-multi-select-option [value]="user.id" [label]="user.name" />
        }
      </oib-multi-select>
    </form>
  `,
  imports: [MultiSelectComponent, MultiSelectOptionDirective, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestComponent {
  readonly users = users;
  readonly form = new FormGroup({ users: new FormControl<Array<number>>([], { nonNullable: true }) });
  readonly placeholder = signal('');
  readonly isSmall = signal(false);
  readonly changeEvents: Array<Array<number>> = [];
}

@Component({
  selector: 'oib-test-multi-select-compare-with-component',
  template: `
    <oib-multi-select [formControl]="control" [compareWith]="byId">
      @for (user of users; track user.id) {
        <oib-multi-select-option [value]="user" [label]="user.name" />
      }
    </oib-multi-select>
  `,
  imports: [MultiSelectComponent, MultiSelectOptionDirective, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class CompareWithTestComponent {
  readonly users = users;
  readonly control = new FormControl<Array<User>>([], { nonNullable: true });
  readonly byId = byIdComparisonFn;
}

/** The options are displayed in a dropdown attached to the body */
const options = page.getByCss('body > .dropdown [ngbDropdownItem]');
const option = (index: number) => options.nth(index);

describe('MultiSelectComponent', () => {
  describe('without compareWith', () => {
    let host: TestComponent;
    let toggle: ReturnType<typeof page.elementLocator>;

    beforeEach(() => {
      TestBed.configureTestingModule({});
      const testFixture = TestBed.createComponent(TestComponent);
      host = testFixture.componentInstance;
      toggle = page.elementLocator(testFixture.nativeElement).getByRole('button');
    });

    test('should display nothing without placeholder nor selection', async () => {
      await expect.element(toggle).toHaveTextContent('');
      await expect.element(toggle).toHaveClass('form-select');
      await expect.element(toggle).not.toHaveClass('form-select-sm');
    });

    test('should display the placeholder without selection', async () => {
      host.placeholder.set('Choose a user');

      await expect.element(toggle).toHaveTextContent('Choose a user');
    });

    test('should be small', async () => {
      host.isSmall.set(true);

      await expect.element(toggle).toHaveClass('form-select-sm');
    });

    test('should display the selection, ordered as the options, and keep the unknown values', async () => {
      host.form.controls.users.setValue([3, 1, 42]);

      await expect.element(toggle).toHaveTextContent('Cedric, Marouane');
      expect(host.form.controls.users.value).toEqual([3, 1, 42]);
      expect(host.form.pristine).toBe(true);
      expect(host.form.touched).toBe(false);
    });

    test('should become touched when losing focus', async () => {
      // opening and closing the dropdown gives the focus back to the toggle
      await toggle.click();
      await toggle.click();
      await expect.element(toggle).toHaveFocus();
      expect(host.form.touched).toBe(false);

      await userEvent.tab();

      expect(host.form.touched).toBe(true);
    });

    test('should select and deselect values by clicking options', async () => {
      await toggle.click();
      await expect.element(option(0)).toHaveTextContent('Cedric');
      await expect.element(option(0)).not.toHaveClass('selected');

      await option(0).click();
      await option(1).click();

      await expect.element(option(0)).toHaveClass('selected');
      await expect.element(option(0).getByCss('.fa-check')).toBeInTheDocument();
      await expect.element(option(1)).toHaveClass('selected');
      await expect.element(toggle).toHaveTextContent('Cedric, JB');
      expect(host.form.controls.users.value).toEqual([1, 2]);

      await option(0).click();

      await expect.element(option(0)).not.toHaveClass('selected');
      await expect.element(option(0).getByCss('.fa-check')).not.toBeInTheDocument();
      expect(host.form.controls.users.value).toEqual([2]);
      expect(host.changeEvents).toEqual([[1], [1, 2], [2]]);
      expect(host.form.dirty).toBe(true);
    });

    test('should display the selected options', async () => {
      host.form.controls.users.setValue([3, 1]);

      await toggle.click();

      await expect.element(option(0)).toHaveClass('selected');
      await expect.element(option(1)).not.toHaveClass('selected');
      await expect.element(option(2)).toHaveClass('selected');
    });

    test('should focus the toggle when closed', async () => {
      await toggle.click();
      await expect.element(option(0)).toBeVisible();

      await toggle.click();

      await expect.element(option(0)).not.toBeInTheDocument();
      await expect.element(toggle).toHaveFocus();
    });

    test('should be disabled with its control', async () => {
      host.form.controls.users.disable();

      await expect.element(toggle).toBeDisabled();
    });
  });

  describe('with compareWith', () => {
    let control: FormControl<Array<User>>;
    let toggle: ReturnType<typeof page.elementLocator>;

    beforeEach(() => {
      TestBed.configureTestingModule({});
      const fixture = TestBed.createComponent(CompareWithTestComponent);
      control = fixture.componentInstance.control;
      toggle = page.elementLocator(fixture.nativeElement).getByRole('button');
    });

    test('should display the selection and the selected options', async () => {
      control.setValue([{ ...users[2] }, { ...users[0] }]);

      await expect.element(toggle).toHaveTextContent('Cedric, Marouane');
      await toggle.click();
      await expect.element(option(0)).toHaveClass('selected');
      await expect.element(option(1)).not.toHaveClass('selected');
      await expect.element(option(2)).toHaveClass('selected');
    });

    test('should select and deselect values by clicking options', async () => {
      control.setValue([{ ...users[0] }]);
      await toggle.click();

      await option(1).click();
      await option(0).click();

      await expect.element(toggle).toHaveTextContent('JB');
      expect(control.value).toEqual([users[1]]);
    });
  });
});
