import { TestBed } from '@angular/core/testing';

import { ChangeDetectionStrategy, Component, inject as inject_1 } from '@angular/core';
import { debounceTime, distinctUntilChanged, Observable, of, switchMap } from 'rxjs';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { provideNgbConfigTesting } from './oi-ngb-testing';
import { OpenTypeaheadOnFocusDirective } from './open-typeahead-on-focus.directive';
import { NgbTypeahead } from '@ng-bootstrap/ng-bootstrap';
import { NGB_ARIA_LIVE_DELAY, TYPEAHEAD_DEBOUNCE_TIME } from './typeahead';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

class UserService {
  suggestByText(_name: string): Observable<Array<unknown>> {
    return of(['Cédric']);
  }
}

@Component({
  selector: 'oib-test-open-typeahead-on-focus-component',
  template: '<input [ngbTypeahead]="search" [formControl]="name"/>',
  imports: [ReactiveFormsModule, NgbTypeahead, OpenTypeaheadOnFocusDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
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

class TestComponentTester {
  readonly fixture = TestBed.createComponent(TestComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly typeahead = this.root.getByCss('input');
  readonly suggestions = page.getByCss('ngb-typeahead-window.dropdown-menu button.dropdown-item');
}

describe('OpenTypeaheadOnFocusDirective', () => {
  let tester: TestComponentTester;
  let userService: UserService;

  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideNgbConfigTesting(), UserService]
    });
    userService = TestBed.inject(UserService);
    vi.spyOn(userService, 'suggestByText');
    tester = new TestComponentTester();
    tester.fixture.detectChanges();
  });

  test('should call search on focus', async () => {
    vi.useFakeTimers();
    tester.typeahead.element().dispatchEvent(new Event('focus'));
    await vi.advanceTimersByTimeAsync(2 * TYPEAHEAD_DEBOUNCE_TIME);
    tester.fixture.detectChanges();
    expect(userService.suggestByText).toHaveBeenCalledWith('');
    await vi.advanceTimersByTimeAsync(NGB_ARIA_LIVE_DELAY);
  });

  test('should not call search on focus when there is a value', async () => {
    vi.useFakeTimers();
    tester.fixture.componentInstance.name.setValue('Cédric');
    tester.typeahead.element().dispatchEvent(new Event('focus'));
    await vi.advanceTimersByTimeAsync(2 * TYPEAHEAD_DEBOUNCE_TIME);
    tester.fixture.detectChanges();
    expect(userService.suggestByText).not.toHaveBeenCalled();
  });

  test('should not call search on focus when there is a blur just after', async () => {
    vi.useFakeTimers();
    tester.typeahead.element().dispatchEvent(new Event('focus'));
    tester.typeahead.element().dispatchEvent(new Event('blur'));
    await vi.advanceTimersByTimeAsync(2 * TYPEAHEAD_DEBOUNCE_TIME);
    tester.fixture.detectChanges();
    expect(userService.suggestByText).not.toHaveBeenCalled();
  });

  test('should not call search on focus when the popup is already opened', async () => {
    vi.useFakeTimers();
    tester.typeahead.element().dispatchEvent(new Event('input', { bubbles: true }));
    await vi.advanceTimersByTimeAsync(TYPEAHEAD_DEBOUNCE_TIME);
    tester.fixture.detectChanges();
    expect(userService.suggestByText).toHaveBeenCalledTimes(1);
    await expect.element(tester.suggestions).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(TYPEAHEAD_DEBOUNCE_TIME);

    tester.typeahead.element().dispatchEvent(new Event('focus'));
    await vi.advanceTimersByTimeAsync(2 * TYPEAHEAD_DEBOUNCE_TIME);
    tester.fixture.detectChanges();
    expect(userService.suggestByText).toHaveBeenCalledTimes(1);
  });
});
