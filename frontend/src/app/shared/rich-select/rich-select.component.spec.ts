import { TestBed } from '@angular/core/testing';

import { RichSelectComponent } from './rich-select.component';
import { Component } from '@angular/core';
import { ComponentTester } from 'ngx-speculoos';
import { RichSelectOptionComponent } from './rich-select-option.component';

const testUsers = [
  { id: 'id1', name: 'John Doe' },
  { id: 'id2', name: 'Jane Doe' }
];

@Component({
  template: `
    <oib-rich-select formControlName="users" placeholder="Choose a user">
      @for (user of users; track user.id) {
        <oib-rich-select-option [value]="user.id" [label]="user.name" />
      }
    </oib-rich-select>
  `,
  imports: [RichSelectComponent, RichSelectOptionComponent],
  standalone: true
})
class SimpleTestComponent {
  users = testUsers;
}

class SimpleRichSelectComponentTester extends ComponentTester<SimpleTestComponent> {
  constructor() {
    super(SimpleTestComponent);
  }
}

describe('RichSelectComponent simple', () => {
  let tester: SimpleRichSelectComponentTester;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [SimpleTestComponent]
    });

    tester = new SimpleRichSelectComponentTester();
    tester.detectChanges();
  });

  it('should create', () => {
    expect(tester.button('.form-select')?.nativeElement.innerText).toEqual('Choose a user');
  });

  it('should be able to select an option', () => {
    tester.button('.form-select')?.click();
    tester.element('.dropdown-menu.show')?.button('.dropdown-item:not(.selected)')?.click();
    expect(tester.component(RichSelectComponent).selectedLabel).toBe(testUsers[0].name);
  });

  it('should be able to select another option', () => {
    tester.button('.form-select')?.click();
    tester.element('.dropdown-menu.show')?.button('.dropdown-item:not(.selected)')?.click();
    tester.element('.dropdown-menu.show')?.button('.dropdown-item:not(.selected)')?.click();
    expect(tester.component(RichSelectComponent).selectedLabel).toBe(testUsers[1].name);
  });

  it('should create simple options', () => {
    tester.button('.form-select')?.click();

    const expectedOptions = testUsers.map(u => u.name);
    const actualOptions = tester
      .element('.dropdown-menu.show')
      ?.elements<HTMLButtonElement>('.dropdown-item')
      ?.map(btn => btn.nativeElement.innerText);

    expect(actualOptions).toEqual(expectedOptions);
  });
});

////////////////////////////////////////////////

@Component({
  template: `
    <oib-rich-select formControlName="users" placeholder="Choose a user">
      @for (user of users; track user.id) {
        <oib-rich-select-option [value]="user.id" [label]="user.name">
          <span>{{ user.id }} # {{ user.name }}</span>
        </oib-rich-select-option>
      }
    </oib-rich-select>
  `,
  imports: [RichSelectComponent, RichSelectOptionComponent],
  standalone: true
})
class CustomTestComponent {
  users = testUsers;
}

class CustomRichSelectComponentTester extends ComponentTester<CustomTestComponent> {
  constructor() {
    super(CustomTestComponent);
  }
}

describe('RichSelectComponent custom', () => {
  let tester: CustomRichSelectComponentTester;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [CustomTestComponent]
    });

    tester = new CustomRichSelectComponentTester();
    tester.detectChanges();
  });

  it('should create', () => {
    expect(tester.button('.form-select')?.nativeElement.innerText).toEqual('Choose a user');
  });

  it('should be able to select an option', () => {
    tester.button('.form-select')?.click();
    tester.element('.dropdown-menu.show')?.button('.dropdown-item:not(.selected)')?.click();
    expect(tester.component(RichSelectComponent).selectedLabel).toBe(testUsers[0].name);
  });

  it('should be able to select another option', () => {
    tester.button('.form-select')?.click();
    tester.element('.dropdown-menu.show')?.button('.dropdown-item:not(.selected)')?.click();
    tester.element('.dropdown-menu.show')?.button('.dropdown-item:not(.selected)')?.click();
    expect(tester.component(RichSelectComponent).selectedLabel).toBe(testUsers[1].name);
  });

  it('should create custom options', () => {
    tester.button('.form-select')?.click();

    const expectedOptions = testUsers.map(u => `${u.id} # ${u.name}`);
    const actualOptions = tester
      .element('.dropdown-menu.show')
      ?.elements<HTMLButtonElement>('.dropdown-item')
      ?.map(btn => btn.nativeElement.innerText);

    expect(actualOptions).toEqual(expectedOptions);
  });
});
