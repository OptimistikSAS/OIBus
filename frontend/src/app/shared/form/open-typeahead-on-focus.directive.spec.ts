import { fakeAsync, TestBed, tick } from '@angular/core/testing';

import { Component, inject as inject_1 } from '@angular/core';
import { ComponentTester } from 'ngx-speculoos';
import { debounceTime, distinctUntilChanged, Observable, of, switchMap } from 'rxjs';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { provideNgbConfigTesting } from './oi-ngb-testing';
import { OpenTypeaheadOnFocusDirective } from './open-typeahead-on-focus.directive';
import { NgbTypeahead } from '@ng-bootstrap/ng-bootstrap';
import { NGB_ARIA_LIVE_DELAY, TYPEAHEAD_DEBOUNCE_TIME } from './typeahead';

class UserService {
  suggestByText(_name: string): Observable<Array<unknown>> {
    return of(['Cédric']);
  }
}

@Component({
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

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideNgbConfigTesting(), UserService]
    });
    userService = TestBed.inject(UserService);
    spyOn(userService, 'suggestByText').and.callThrough();
    tester = new TestComponentTester();
    await tester.change();
  });

  it('should call search on focus', fakeAsync(() => {
    tester.typeahead.dispatchEventOfType('focus');
    // we need two debounce because there is one from the focus directive and one in the search itself.
    tick(2 * TYPEAHEAD_DEBOUNCE_TIME);
    expect(userService.suggestByText).toHaveBeenCalledWith('');
    tick(NGB_ARIA_LIVE_DELAY);
  }));

  it('should not call search on focus when there is a value', fakeAsync(() => {
    tester.componentInstance.name.setValue('Cédric');
    tester.typeahead.dispatchEventOfType('focus');
    tick(2 * TYPEAHEAD_DEBOUNCE_TIME);
    expect(userService.suggestByText).not.toHaveBeenCalled();
  }));

  it('should not call search on focus when there is a blur just after', fakeAsync(() => {
    tester.typeahead.dispatchEventOfType('focus');
    tester.typeahead.dispatchEventOfType('blur');
    tick(2 * TYPEAHEAD_DEBOUNCE_TIME);
    expect(userService.suggestByText).not.toHaveBeenCalled();
  }));

  it('should not call search on focus when the popup is already opened', fakeAsync(() => {
    tester.typeahead.dispatchEventOfType('input');
    tick(TYPEAHEAD_DEBOUNCE_TIME);
    expect(userService.suggestByText).toHaveBeenCalledTimes(1);
    expect(tester.typeahead.elements('ngb-typeahead-window.dropdown-menu button.dropdown-item').length).toBe(1);
    tick(TYPEAHEAD_DEBOUNCE_TIME);

    tester.typeahead.dispatchEventOfType('focus');
    tick(2 * TYPEAHEAD_DEBOUNCE_TIME);
    expect(userService.suggestByText).toHaveBeenCalledTimes(1);
  }));
});
