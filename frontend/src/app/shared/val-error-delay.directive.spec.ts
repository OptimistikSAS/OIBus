import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { ComponentTester } from 'ngx-speculoos';
import { ValErrorDelayDirective } from './val-error-delay.directive';

@Component({
  template: '<val-errors>@if (showError) {<div>test</div>}</val-errors>',
  standalone: true,
  imports: [ValErrorDelayDirective]
})
class TestComponent {
  showError = false;
}

class TestComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  get error() {
    return this.element('div');
  }
}

describe('ValErrorAnimationDirective', () => {
  let tester: TestComponentTester;

  beforeEach(() => {
    TestBed.configureTestingModule({});

    tester = new TestComponentTester();
    tester.detectChanges();
  });

  // Using fakeAsync does not work here, probably because the directive does everything out of the Angular zone.
  // Since the delay is short, waiting for the delay is OK.
  it('should create an instance', (done: DoneFn) => {
    expect(tester.error).toBeNull();

    tester.componentInstance.showError = true;
    tester.detectChanges();

    expect(tester.error).not.toBeNull();
    expect(tester.error).not.toBeVisible();

    setTimeout(() => {
      expect(tester.error).toBeVisible();
      done();
    }, 170);
  });
});
