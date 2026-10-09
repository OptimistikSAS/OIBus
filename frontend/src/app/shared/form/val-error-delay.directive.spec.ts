import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { ValErrorDelayDirective } from './val-error-delay.directive';

@Component({
  selector: 'oib-test-val-error-delay-component',
  template: '<val-errors>@if (showError()) {<div>test</div>}</val-errors>',
  imports: [ValErrorDelayDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestComponent {
  readonly showError = signal(false);
}

describe('ValErrorDelayDirective', () => {
  afterEach(() => vi.useRealTimers());

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  test('should display the errors after a delay', async () => {
    const fixture = TestBed.createComponent(TestComponent);
    const error = page.elementLocator(fixture.nativeElement).getByText('test');
    await fixture.whenStable();
    vi.useFakeTimers();

    fixture.componentInstance.showError.set(true);
    // renders the error, hidden at first
    await vi.advanceTimersByTimeAsync(100);
    expect(error.element()).not.toBeVisible();

    // then displayed after 150 ms
    await vi.advanceTimersByTimeAsync(100);
    expect(error.element()).toBeVisible();
  });
});
