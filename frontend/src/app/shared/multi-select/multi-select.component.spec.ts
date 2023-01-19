import { fakeAsync, TestBed, tick } from '@angular/core/testing';

import { MultiSelectComponent } from './multi-select.component';
import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ComponentTester, TestButton } from 'ngx-speculoos';
import { MultiSelectOptionDirective } from './multi-select-option.directive';
import { noAnimation } from '../test-utils';
import { formDirectives } from '../form-directives';
import { NgForOf } from '@angular/common';
import { byIdComparisonFn } from '../utils';

interface User {
  id: number;
  name: string;
}

@Component({
  selector: 'oib-test',
  template: `
    <form [formGroup]="form">
      <oib-multi-select [placeholder]="placeholder" formControlName="users" (selectionChange)="changeEvent = $event">
        <oib-multi-select-option *ngFor="let user of users" [value]="user.id" [label]="user.name"></oib-multi-select-option>
      </oib-multi-select>
    </form>
  `,
  standalone: true,
  imports: [...formDirectives, NgForOf, MultiSelectComponent, MultiSelectOptionDirective]
})
class TestComponent {
  users: Array<User> = [
    {
      id: 1,
      name: 'John'
    },
    {
      id: 2,
      name: 'Jane'
    },
    {
      id: 3,
      name: 'Alice'
    }
  ];

  form = this.fb.group({
    users: [[] as Array<number | User>]
  });
  placeholder = '';

  changeEvent: Array<number> = [];

  byId = byIdComparisonFn;

  constructor(private fb: FormBuilder) {}
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
    return this.elements<HTMLButtonElement>('[ngbDropdownItem]')[index]!;
  }
}

describe('MultiSelectComponent', () => {
  let tester: TestComponentTester;

  describe('without compareWith', () => {
    beforeEach(() => {
      TestBed.configureTestingModule({
        imports: [ReactiveFormsModule, MultiSelectComponent, MultiSelectOptionDirective],
        providers: [noAnimation]
      });

      tester = new TestComponentTester();
    });

    it('should display nothing if no placeholder and no selection', () => {
      tester.detectChanges();
      expect(tester.multiSelect).toHaveText('');
    });

    it('should display placeholder if placeholder and no selection', () => {
      tester.componentInstance.placeholder = 'Choose a user';
      tester.detectChanges();
      expect(tester.multiSelect).toHaveText('Choose a user');
    });

    it('should display the selection, ordered the same way as the options', () => {
      tester.usersCtrl.setValue([tester.componentInstance.users[2].id, tester.componentInstance.users[0].id]);
      tester.detectChanges();
      expect(tester.multiSelect).toHaveText('John, Alice');
    });

    it('should be pristine and not touched initially', () => {
      tester.detectChanges();
      expect(tester.componentInstance.form.pristine).toBe(true);
      expect(tester.componentInstance.form.touched).toBe(false);
    });

    it('should be pristine and not touched initially, even if pre-populated', () => {
      tester.usersCtrl.setValue([tester.componentInstance.users[2].id, tester.componentInstance.users[0].id]);
      tester.detectChanges();

      expect(tester.usersCtrl.pristine).toBe(true);
      expect(tester.usersCtrl.touched).toBe(false);
      expect(tester.usersCtrl.value!.sort()).toEqual([1, 3]);
    });

    it('should be keep phantom selected values', () => {
      tester.usersCtrl.setValue([tester.componentInstance.users[2].id, tester.componentInstance.users[0].id, 42]);
      tester.detectChanges();

      expect(tester.usersCtrl.value!.sort()).toEqual([1, 3, 42]);
    });

    it('should become touched when losing focus', () => {
      tester.detectChanges();
      tester.multiSelect.nativeElement.focus();
      tester.multiSelect.dispatchEventOfType('blur');
      expect(tester.usersCtrl.touched).toBe(true);
    });

    it('should select and de-select values by clicking options', () => {
      tester.detectChanges();
      tester.toggle();
      expect(tester.option(0)).toHaveText('John');
      expect(tester.option(0)).not.toHaveClass('selected');
      expect(tester.option(0).element('.fa-check')).toBeNull();

      tester.option(0).click();
      tester.option(1).click();

      expect(tester.option(0)).toHaveClass('selected');
      expect(tester.option(0).element('.fa-check')).not.toBeNull();
      expect(tester.option(1)).toHaveClass('selected');
      expect(tester.usersCtrl.value!.sort()).toEqual([1, 2]);
      expect(tester.multiSelect).toHaveText('John, Jane');

      tester.option(0).click();
      expect(tester.option(0)).not.toHaveClass('selected');
      expect(tester.option(0).element('.fa-check')).toBeNull();
      expect(tester.usersCtrl.value!.sort()).toEqual([2]);
    });

    it('should have pre-selected options', () => {
      tester.usersCtrl.setValue([tester.componentInstance.users[2].id, tester.componentInstance.users[0].id]);

      tester.detectChanges();
      tester.toggle();
      expect(tester.option(0)).toHaveClass('selected');
      expect(tester.option(1)).not.toHaveClass('selected');
      expect(tester.option(2)).toHaveClass('selected');
    });

    it('should focus the main button when closed', fakeAsync(() => {
      tester.detectChanges();
      tester.toggle();
      tick();

      tester.toggle();
      tick();
      expect(document.activeElement).toBe(tester.multiSelect.nativeElement);
    }));

    it('should emit a change event when the user changes the selection', () => {
      tester.detectChanges();
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
            <oib-multi-select-option *ngFor="let user of users" [value]="user" [label]="user.name"></oib-multi-select-option>
          </oib-multi-select>
        </form>
      `
      );

      TestBed.configureTestingModule({
        imports: [ReactiveFormsModule, MultiSelectComponent, MultiSelectOptionDirective],
        providers: [noAnimation]
      });

      tester = new TestComponentTester();
    });

    it('should display nothing if no placeholder and no selection', () => {
      tester.detectChanges();
      expect(tester.multiSelect).toHaveText('');
    });

    it('should display the selection, ordered the same way as the options', () => {
      tester.usersCtrl.setValue([{ ...tester.componentInstance.users[2] }, { ...tester.componentInstance.users[0] }]);
      tester.detectChanges();
      expect(tester.multiSelect).toHaveText('John, Alice');
    });

    it('should select and de-select values by clicking options', () => {
      tester.detectChanges();
      tester.toggle();
      expect(tester.option(0)).toHaveText('John');
      expect(tester.option(0)).not.toHaveClass('selected');
      expect(tester.option(0).element('.fa-check')).toBeNull();

      tester.option(0).click();
      tester.option(1).click();

      expect(tester.option(0)).toHaveClass('selected');
      expect(tester.option(0).element('.fa-check')).not.toBeNull();
      expect(tester.option(1)).toHaveClass('selected');
      expect(tester.multiSelect).toHaveText('John, Jane');

      tester.option(0).click();
      expect(tester.option(0)).not.toHaveClass('selected');
      expect(tester.option(0).element('.fa-check')).toBeNull();
      expect(tester.usersCtrl.value).toEqual([{ id: 2, name: 'Jane' }]);
    });

    it('should have pre-selected options', () => {
      tester.usersCtrl.setValue([{ ...tester.componentInstance.users[2] }, { ...tester.componentInstance.users[0] }]);

      tester.detectChanges();
      tester.toggle();
      expect(tester.option(0)).toHaveClass('selected');
      expect(tester.option(1)).not.toHaveClass('selected');
      expect(tester.option(2)).toHaveClass('selected');
    });
  });
});
