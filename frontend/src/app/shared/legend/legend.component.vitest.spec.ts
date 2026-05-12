import { TestBed } from '@angular/core/testing';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test } from 'vitest';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { LegendComponent } from './legend.component';

class LegendComponentTester {
  readonly fixture = TestBed.createComponent(LegendComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly legendItems = this.root.getByCss('.legend-item');
}

describe('LegendComponent', () => {
  let tester: LegendComponentTester;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [LegendComponent],
      providers: [provideI18nTesting()]
    });
    tester = new LegendComponentTester();
    tester.fixture.componentRef.setInput('legendList', [
      { label: 'north.disabled', class: 'grey-dot' },
      { label: 'north.enabled', class: 'green-dot' }
    ]);
  });

  test('should display a legend list', async () => {
    await expect.element(tester.legendItems).toHaveLength(2);
    await expect.element(tester.legendItems.nth(0).getByCss('div')).toHaveClass('grey-dot');
    await expect.element(tester.legendItems.nth(1).getByCss('div')).toHaveClass('green-dot');
    await expect.element(tester.legendItems.nth(0).getByCss('span')).toHaveTextContent('Disabled');
    await expect.element(tester.legendItems.nth(1).getByCss('span')).toHaveTextContent('Enabled');
  });
});
