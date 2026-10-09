import { TestBed } from '@angular/core/testing';

import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { ProgressbarComponent } from './progressbar.component';

class ProgressbarComponentTester {
  readonly fixture = TestBed.createComponent(ProgressbarComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly percent = this.root.getByCss('.oib-progressbar > span');
  readonly bar = this.root.getByRole('progressbar');
  readonly barFill = this.root.getByCss('.progress-bar');

  constructor(inputs: { value: number; max?: number; animated: boolean }) {
    this.fixture.componentRef.setInput('value', inputs.value);
    if (inputs.max !== undefined) {
      this.fixture.componentRef.setInput('max', inputs.max);
    }
    this.fixture.componentRef.setInput('animated', inputs.animated);
  }
}

describe('ProgressbarComponent', () => {
  test('should display the value as a percentage of 1 by default', async () => {
    const tester = new ProgressbarComponentTester({ value: 0.25, animated: false });

    await expect.element(tester.percent).toHaveTextContent('25%');
    await expect.element(tester.bar).toHaveAttribute('aria-valuenow', '0.25');
    await expect.element(tester.bar).toHaveAttribute('aria-valuemax', '1');
    await expect.element(tester.barFill).not.toHaveClass('progress-bar-animated');
  });

  test('should use the given max and animate the bar', async () => {
    const tester = new ProgressbarComponentTester({ value: 50, max: 100, animated: true });

    await expect.element(tester.bar).toHaveAttribute('aria-valuemax', '100');
    await expect.element(tester.barFill).toHaveClass('progress-bar-striped');
    await expect.element(tester.barFill).toHaveClass('progress-bar-animated');
  });
});
