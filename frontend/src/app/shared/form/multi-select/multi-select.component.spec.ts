import { TestBed } from '@angular/core/testing';

import { MultiSelectComponent } from './multi-select.component';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MultiSelectOptionDirective } from './multi-select-option.directive';
import { byIdComparisonFn } from '../../test-utils';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

interface User {
  id: number;
  name: string;
}

@Component({
  selector: 'oib-test-multi-select-component',
  template: `
    <form [formGroup]="form">
      <oib-multi-select [placeholder]="placeholder" formControlName="users" (selectionChange)="changeEvent = $event">
        @for (user of users; track user) {
          <oib-multi-select-option [value]="user.id" [label]="user.name" />
        }
      </oib-multi-select>
    </form>
  `,
  imports: [MultiSelectComponent, MultiSelectOptionDirective, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestComponent {
  private fb = inject(FormBuilder);

  users: Array<User> = [
    {
      id: 1,
      name: 'Cedric'
    },
    {
      id: 2,
      name: 'JB'
    },
    {
      id: 3,
      name: 'Marouane'
    }
  ];

  form = this.fb.group({
    users: [[] as Array<number | User>]
  });
  placeholder = '';

  changeEvent: Array<number> = [];

  byId = byIdComparisonFn;
}

class TestComponentTester {
  readonly fixture = TestBed.createComponent(TestComponent);
  readonly component = this.fixture.componentInstance;
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly multiSelect = this.root.getByCss('[ngbDropdownToggle]');
  readonly options = page.getByCss('body > .dropdown [ngbDropdownItem]');

  get usersCtrl() {
    return this.component.form.get('users')!;
  }

  async toggle() {
    await this.multiSelect.click();
  }

  option(index: number) {
    return this.options.nth(index);
  }

  clickOption(index: number) {
    (this.option(index).element() as HTMLElement).click();
    this.fixture.detectChanges();
  }
}

describe('MultiSelectComponent', () => {
  let tester: TestComponentTester;

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('without compareWith', () => {
    beforeEach(() => {
      TestBed.configureTestingModule({});

      tester = new TestComponentTester();
    });

    test('should display nothing if no placeholder and no selection', () => {
      tester.fixture.detectChanges();
      expect(tester.multiSelect.element().textContent?.trim()).toBe('');
    });

    test('should display placeholder if placeholder and no selection', async () => {
      tester.component.placeholder = 'Choose a user';
      tester.fixture.detectChanges();
      await expect.element(tester.multiSelect).toHaveTextContent('Choose a user');
    });

    test('should display the selection, ordered the same way as the options', async () => {
      tester.usersCtrl.setValue([tester.component.users[2].id, tester.component.users[0].id]);
      tester.fixture.detectChanges();
      await expect.element(tester.multiSelect).toHaveTextContent('Cedric, Marouane');
    });

    test('should be pristine and not touched initially', () => {
      tester.fixture.detectChanges();
      expect(tester.component.form.pristine).toBe(true);
      expect(tester.component.form.touched).toBe(false);
    });

    test('should be pristine and not touched initially, even if pre-populated', () => {
      tester.usersCtrl.setValue([tester.component.users[2].id, tester.component.users[0].id]);
      tester.fixture.detectChanges();

      expect(tester.usersCtrl.pristine).toBe(true);
      expect(tester.usersCtrl.touched).toBe(false);
      expect(tester.usersCtrl.value!.sort()).toEqual([1, 3]);
    });

    test('should be keep phantom selected values', () => {
      tester.usersCtrl.setValue([tester.component.users[2].id, tester.component.users[0].id, 42]);
      tester.fixture.detectChanges();

      expect(tester.usersCtrl.value!.sort()).toEqual([1, 3, 42]);
    });

    test('should become touched when losing focus', () => {
      tester.fixture.detectChanges();
      tester.multiSelect.element().focus();
      tester.multiSelect.element().dispatchEvent(new Event('blur'));
      expect(tester.usersCtrl.touched).toBe(true);
    });

    test('should select and de-select values by clicking options', async () => {
      tester.fixture.detectChanges();
      await tester.toggle();
      await expect.element(tester.option(0)).toHaveTextContent('Cedric');
      await expect.element(tester.option(0)).not.toHaveClass('selected');
      await expect.element(tester.option(0).getByCss('.fa-check')).not.toBeInTheDocument();

      tester.clickOption(0);
      tester.clickOption(1);

      await expect.element(tester.option(0)).toHaveClass('selected');
      await expect.element(tester.option(0).getByCss('.fa-check')).toBeInTheDocument();
      await expect.element(tester.option(1)).toHaveClass('selected');
      expect(tester.usersCtrl.value!.sort()).toEqual([1, 2]);
      await expect.element(tester.multiSelect).toHaveTextContent('Cedric, JB');

      tester.clickOption(0);
      await expect.element(tester.option(0)).not.toHaveClass('selected');
      await expect.element(tester.option(0).getByCss('.fa-check')).not.toBeInTheDocument();
      expect(tester.usersCtrl.value!.sort()).toEqual([2]);
    });

    test('should have pre-selected options', async () => {
      tester.usersCtrl.setValue([tester.component.users[2].id, tester.component.users[0].id]);

      tester.fixture.detectChanges();
      await tester.toggle();
      await expect.element(tester.option(0)).toHaveClass('selected');
      await expect.element(tester.option(1)).not.toHaveClass('selected');
      await expect.element(tester.option(2)).toHaveClass('selected');
    });

    test('should focus the main button when closed', async () => {
      vi.useFakeTimers();
      tester.fixture.detectChanges();
      await tester.toggle();
      await vi.advanceTimersByTimeAsync(0);

      await tester.toggle();
      await vi.advanceTimersByTimeAsync(0);
      expect(document.activeElement).toBe(tester.multiSelect.element());
    });

    test('should emit a change event when the user changes the selection', async () => {
      tester.fixture.detectChanges();
      await tester.toggle();

      tester.clickOption(0);
      expect(tester.component.changeEvent).toEqual([1]);
      tester.clickOption(1);
      expect(tester.component.changeEvent).toEqual([1, 2]);
      tester.clickOption(0);
      expect(tester.component.changeEvent).toEqual([2]);
    });
  });

  describe('with compareWith', () => {
    beforeEach(() => {
      TestBed.overrideTemplate(
        TestComponent,
        `
        <form [formGroup]="form">
          <oib-multi-select [placeholder]="placeholder" formControlName="users" (selectionChange)="changeEvent = $event" [compareWith]="byId">
            @for (user of users; track user) {
              <oib-multi-select-option [value]="user" [label]="user.name"></oib-multi-select-option>
            }
          </oib-multi-select>
        </form>
      `
      );

      TestBed.configureTestingModule({});

      tester = new TestComponentTester();
    });

    test('should display nothing if no placeholder and no selection', () => {
      tester.fixture.detectChanges();
      expect(tester.multiSelect.element().textContent?.trim()).toBe('');
    });

    test('should display the selection, ordered the same way as the options', async () => {
      tester.usersCtrl.setValue([{ ...tester.component.users[2] }, { ...tester.component.users[0] }]);
      tester.fixture.detectChanges();
      await expect.element(tester.multiSelect).toHaveTextContent('Cedric, Marouane');
    });

    test('should select and de-select values by clicking options', async () => {
      tester.fixture.detectChanges();
      await tester.toggle();
      await expect.element(tester.option(0)).toHaveTextContent('Cedric');
      await expect.element(tester.option(0)).not.toHaveClass('selected');
      await expect.element(tester.option(0).getByCss('.fa-check')).not.toBeInTheDocument();

      tester.clickOption(0);
      tester.clickOption(1);

      await expect.element(tester.option(0)).toHaveClass('selected');
      await expect.element(tester.option(0).getByCss('.fa-check')).toBeInTheDocument();
      await expect.element(tester.option(1)).toHaveClass('selected');
      await expect.element(tester.multiSelect).toHaveTextContent('Cedric, JB');

      tester.clickOption(0);
      await expect.element(tester.option(0)).not.toHaveClass('selected');
      await expect.element(tester.option(0).getByCss('.fa-check')).not.toBeInTheDocument();
      expect(tester.usersCtrl.value).toEqual([{ id: 2, name: 'JB' }]);
    });

    test('should have pre-selected options', async () => {
      tester.usersCtrl.setValue([{ ...tester.component.users[2] }, { ...tester.component.users[0] }]);

      tester.fixture.detectChanges();
      await tester.toggle();
      await expect.element(tester.option(0)).toHaveClass('selected');
      await expect.element(tester.option(1)).not.toHaveClass('selected');
      await expect.element(tester.option(2)).toHaveClass('selected');
    });
  });
});
