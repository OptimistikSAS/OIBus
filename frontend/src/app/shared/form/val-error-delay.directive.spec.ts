import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { ValErrorDelayDirective } from './val-error-delay.directive';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

@Component({
  selector: 'oib-test-val-error-delay-component',
  template: '<val-errors>@if (showError) {<div>test</div>}</val-errors>',
  imports: [ValErrorDelayDirective]
})
class TestComponent {
  showError = false;
}

class TestComponentTester {
  readonly fixture = TestBed.createComponent(TestComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly error = this.root.getByCss('div');
}

describe('ValErrorAnimationDirective', () => {
  let tester: TestComponentTester;

  beforeEach(() => {
    TestBed.configureTestingModule({});

    tester = new TestComponentTester();
    tester.fixture.detectChanges();
  });

  // The directive does everything out of the Angular zone so fakeAsync does not work.
  // Since the delay is short, we wait for it using a real timeout.
  test('should create an instance', async () => {
    await expect.element(tester.error).not.toBeInTheDocument();

    tester.fixture.componentInstance.showError = true;
    tester.fixture.detectChanges();

    await expect.element(tester.error).toBeInTheDocument();
    await expect.element(tester.error).not.toBeVisible();

    await new Promise<void>(resolve => setTimeout(resolve, 170));
    await expect.element(tester.error).toBeVisible();
  });
});
