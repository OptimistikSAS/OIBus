import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { ComponentTester } from 'ngx-speculoos';
import { ValErrorDelayDirective } from './val-error-delay.directive';
import { beforeEach, describe, expect, test } from 'vitest';

@Component({
  selector: 'oib-test-val-error-delay-component',
  template: '<val-errors>@if (showError) {<div>test</div>}</val-errors>',
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

  beforeEach(async () => {
    TestBed.configureTestingModule({});

    tester = new TestComponentTester();
    await tester.change();
  });

  // The directive does everything out of the Angular zone so fakeAsync does not work.
  // Since the delay is short, we wait for it using a real timeout.
  test('should create an instance', async () => {
    expect(tester.error).toBeNull();

    tester.componentInstance.showError = true;
    tester.detectChanges();

    expect(tester.error).not.toBeNull();
    expect(tester.error!.nativeElement).not.toBeVisible();

    await new Promise<void>(resolve => setTimeout(resolve, 170));
    expect(tester.error!.nativeElement).toBeVisible();
  });
});
