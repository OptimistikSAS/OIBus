import { TestBed } from '@angular/core/testing';

import { MultiSelectComponent } from './multi-select.component';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ComponentTester, TestButton } from 'ngx-speculoos';
import { MultiSelectOptionDirective } from './multi-select-option.directive';
import { byIdComparisonFn } from '../../test-utils';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

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
  imports: [MultiSelectComponent, MultiSelectOptionDirective, ReactiveFormsModule]
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

class TestComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  get multiSelect(): TestButton {
    return this.button('[ngbDropdownToggle]')!;
  }

  get usersCtrl() {
    return this.componentInstance.form.get('users')!;
  }

  toggle() {
    this.multiSelect.click();
  }

  option(index: number): TestButton {
    return this.elements<HTMLButtonElement>('[ngbDropdownItem]')[index];
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

    test('should display nothing if no placeholder and no selection', async () => {
      await tester.change();
      expect(tester.multiSelect.nativeElement.textContent?.trim()).toBe('');
    });

    test('should display placeholder if placeholder and no selection', async () => {
      tester.componentInstance.placeholder = 'Choose a user';
      await tester.change();
      expect(tester.multiSelect.nativeElement.textContent?.trim()).toBe('Choose a user');
    });

    test('should display the selection, ordered the same way as the options', async () => {
      tester.usersCtrl.setValue([tester.componentInstance.users[2].id, tester.componentInstance.users[0].id]);
      await tester.change();
      expect(tester.multiSelect.nativeElement.textContent?.trim()).toBe('Cedric, Marouane');
    });

    test('should be pristine and not touched initially', async () => {
      await tester.change();
      expect(tester.componentInstance.form.pristine).toBe(true);
      expect(tester.componentInstance.form.touched).toBe(false);
    });

    test('should be pristine and not touched initially, even if pre-populated', async () => {
      tester.usersCtrl.setValue([tester.componentInstance.users[2].id, tester.componentInstance.users[0].id]);
      await tester.change();

      expect(tester.usersCtrl.pristine).toBe(true);
      expect(tester.usersCtrl.touched).toBe(false);
      expect(tester.usersCtrl.value!.sort()).toEqual([1, 3]);
    });

    test('should be keep phantom selected values', async () => {
      tester.usersCtrl.setValue([tester.componentInstance.users[2].id, tester.componentInstance.users[0].id, 42]);
      await tester.change();

      expect(tester.usersCtrl.value!.sort()).toEqual([1, 3, 42]);
    });

    test('should become touched when losing focus', async () => {
      await tester.change();
      tester.multiSelect.nativeElement.focus();
      tester.multiSelect.dispatchEventOfType('blur');
      expect(tester.usersCtrl.touched).toBe(true);
    });

    test('should select and de-select values by clicking options', async () => {
      await tester.change();
      tester.toggle();
      expect(tester.option(0).nativeElement.textContent?.trim()).toContain('Cedric');
      expect(tester.option(0).nativeElement).not.toHaveClass('selected');
      expect(tester.option(0).element('.fa-check')).toBeNull();

      tester.option(0).click();
      tester.option(1).click();

      expect(tester.option(0).nativeElement).toHaveClass('selected');
      expect(tester.option(0).element('.fa-check')).not.toBeNull();
      expect(tester.option(1).nativeElement).toHaveClass('selected');
      expect(tester.usersCtrl.value!.sort()).toEqual([1, 2]);
      expect(tester.multiSelect.nativeElement.textContent?.trim()).toBe('Cedric, JB');

      tester.option(0).click();
      expect(tester.option(0).nativeElement).not.toHaveClass('selected');
      expect(tester.option(0).element('.fa-check')).toBeNull();
      expect(tester.usersCtrl.value!.sort()).toEqual([2]);
    });

    test('should have pre-selected options', async () => {
      tester.usersCtrl.setValue([tester.componentInstance.users[2].id, tester.componentInstance.users[0].id]);

      await tester.change();
      tester.toggle();
      expect(tester.option(0).nativeElement).toHaveClass('selected');
      expect(tester.option(1).nativeElement).not.toHaveClass('selected');
      expect(tester.option(2).nativeElement).toHaveClass('selected');
    });

    test('should focus the main button when closed', async () => {
      vi.useFakeTimers();
      await tester.change();
      tester.toggle();
      vi.advanceTimersByTime(0);

      tester.toggle();
      vi.advanceTimersByTime(0);
      expect(document.activeElement).toBe(tester.multiSelect.nativeElement);
    });

    test('should emit a change event when the user changes the selection', async () => {
      await tester.change();
      tester.toggle();

      tester.option(0).click();
      expect(tester.componentInstance.changeEvent).toEqual([1]);
      tester.option(1).click();
      expect(tester.componentInstance.changeEvent).toEqual([1, 2]);
      tester.option(0).click();
      expect(tester.componentInstance.changeEvent).toEqual([2]);
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

    test('should display nothing if no placeholder and no selection', async () => {
      await tester.change();
      expect(tester.multiSelect.nativeElement.textContent?.trim()).toBe('');
    });

    test('should display the selection, ordered the same way as the options', async () => {
      tester.usersCtrl.setValue([{ ...tester.componentInstance.users[2] }, { ...tester.componentInstance.users[0] }]);
      await tester.change();
      expect(tester.multiSelect.nativeElement.textContent?.trim()).toBe('Cedric, Marouane');
    });

    test('should select and de-select values by clicking options', async () => {
      await tester.change();
      tester.toggle();
      expect(tester.option(0).nativeElement.textContent?.trim()).toContain('Cedric');
      expect(tester.option(0).nativeElement).not.toHaveClass('selected');
      expect(tester.option(0).element('.fa-check')).toBeNull();

      tester.option(0).click();
      tester.option(1).click();

      expect(tester.option(0).nativeElement).toHaveClass('selected');
      expect(tester.option(0).element('.fa-check')).not.toBeNull();
      expect(tester.option(1).nativeElement).toHaveClass('selected');
      expect(tester.multiSelect.nativeElement.textContent?.trim()).toBe('Cedric, JB');

      tester.option(0).click();
      expect(tester.option(0).nativeElement).not.toHaveClass('selected');
      expect(tester.option(0).element('.fa-check')).toBeNull();
      expect(tester.usersCtrl.value).toEqual([{ id: 2, name: 'JB' }]);
    });

    test('should have pre-selected options', async () => {
      tester.usersCtrl.setValue([{ ...tester.componentInstance.users[2] }, { ...tester.componentInstance.users[0] }]);

      await tester.change();
      tester.toggle();
      expect(tester.option(0).nativeElement).toHaveClass('selected');
      expect(tester.option(1).nativeElement).not.toHaveClass('selected');
      expect(tester.option(2).nativeElement).toHaveClass('selected');
    });
  });
});
