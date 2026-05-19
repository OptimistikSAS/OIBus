import { TestBed } from '@angular/core/testing';

import { Component, inject as inject_1 } from '@angular/core';
import { ComponentTester } from 'ngx-speculoos';
import { debounceTime, distinctUntilChanged, Observable, of, switchMap } from 'rxjs';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { provideNgbConfigTesting } from './oi-ngb-testing';
import { OpenTypeaheadOnFocusDirective } from './open-typeahead-on-focus.directive';
import { NgbTypeahead } from '@ng-bootstrap/ng-bootstrap';
import { NGB_ARIA_LIVE_DELAY, TYPEAHEAD_DEBOUNCE_TIME } from './typeahead';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

class UserService {
  suggestByText(_name: string): Observable<Array<unknown>> {
    return of(['Cédric']);
  }
}

@Component({
  selector: 'oib-test-open-typeahead-on-focus-component',
  template: '<input [ngbTypeahead]="search" [formControl]="name"/>',
  imports: [ReactiveFormsModule, NgbTypeahead, OpenTypeaheadOnFocusDirective]
})
class TestComponent {
  private userService = inject_1(UserService);

  name = new FormControl('');

  search = (text$: Observable<string>) =>
    text$.pipe(
      debounceTime(TYPEAHEAD_DEBOUNCE_TIME),
      distinctUntilChanged(),
      switchMap(text => this.userService.suggestByText(text))
    );
}

class TestComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  get typeahead() {
    return this.testElement.input('input')!;
  }
}

describe('OpenTypeaheadOnFocusDirective', () => {
  let tester: TestComponentTester;
  let userService: UserService;

  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideNgbConfigTesting(), UserService]
    });
    userService = TestBed.inject(UserService);
    vi.spyOn(userService, 'suggestByText');
    tester = new TestComponentTester();
    await tester.change();
  });

  test('should call search on focus', async () => {
    vi.useFakeTimers();
    tester.typeahead.dispatchEventOfType('focus');
    vi.advanceTimersByTime(2 * TYPEAHEAD_DEBOUNCE_TIME);
    await tester.change();
    expect(userService.suggestByText).toHaveBeenCalledWith('');
    vi.advanceTimersByTime(NGB_ARIA_LIVE_DELAY);
  });

  test('should not call search on focus when there is a value', async () => {
    vi.useFakeTimers();
    tester.componentInstance.name.setValue('Cédric');
    tester.typeahead.dispatchEventOfType('focus');
    vi.advanceTimersByTime(2 * TYPEAHEAD_DEBOUNCE_TIME);
    await tester.change();
    expect(userService.suggestByText).not.toHaveBeenCalled();
  });

  test('should not call search on focus when there is a blur just after', async () => {
    vi.useFakeTimers();
    tester.typeahead.dispatchEventOfType('focus');
    tester.typeahead.dispatchEventOfType('blur');
    vi.advanceTimersByTime(2 * TYPEAHEAD_DEBOUNCE_TIME);
    await tester.change();
    expect(userService.suggestByText).not.toHaveBeenCalled();
  });

  test('should not call search on focus when the popup is already opened', async () => {
    vi.useFakeTimers();
    tester.typeahead.dispatchEventOfType('input');
    vi.advanceTimersByTime(TYPEAHEAD_DEBOUNCE_TIME);
    await tester.change();
    expect(userService.suggestByText).toHaveBeenCalledTimes(1);
    expect(tester.typeahead.elements('ngb-typeahead-window.dropdown-menu button.dropdown-item').length).toBe(1);
    vi.advanceTimersByTime(TYPEAHEAD_DEBOUNCE_TIME);

    tester.typeahead.dispatchEventOfType('focus');
    vi.advanceTimersByTime(2 * TYPEAHEAD_DEBOUNCE_TIME);
    await tester.change();
    expect(userService.suggestByText).toHaveBeenCalledTimes(1);
  });
});
