import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { PillComponent } from './pill.component';

@Component({
  template: `<oib-pill [type]="type()" [removable]="removable()" (removed)="removedCount.set(removedCount() + 1)">Pill content</oib-pill>`,
  imports: [PillComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestPillWrapper {
  readonly type = signal<'primary' | 'secondary' | 'info'>('primary');
  readonly removable = signal(true);
  readonly removedCount = signal(0);
}

class PillComponentTester {
  readonly fixture = TestBed.createComponent(TestPillWrapper);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly pill = this.root.getByCss('.rounded-pill');
  readonly removeButton = this.root.getByRole('button', { name: 'Remove' });
}

describe('PillComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TestPillWrapper],
      providers: [provideI18nTesting()]
    });
  });

  test('should display a pill with button to remove it', async () => {
    const tester = new PillComponentTester();

    await expect.element(tester.pill).toHaveTextContent('Pill content');
    await expect.element(tester.pill).toHaveClass('badge-primary');
    await expect.element(tester.pill).toHaveAttribute('tabindex', '0');

    await tester.removeButton.click();
    expect(tester.fixture.componentInstance.removedCount()).toBe(1);
  });

  test('should be removed with backspace', async () => {
    const tester = new PillComponentTester();
    await expect.element(tester.pill).toBeVisible();

    tester.pill.element().dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
    expect(tester.fixture.componentInstance.removedCount()).toBe(1);
  });

  test('should not have a button if not removable', async () => {
    const tester = new PillComponentTester();
    tester.fixture.componentInstance.removable.set(false);
    tester.fixture.componentInstance.type.set('secondary');

    await expect.element(tester.pill).toHaveTextContent('Pill content');
    await expect.element(tester.pill).toHaveClass('badge-secondary');
    await expect.element(tester.removeButton).not.toBeInTheDocument();
    await expect.element(tester.pill).toHaveAttribute('tabindex', '-1');
  });
});
