import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test } from 'vitest';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { PillComponent } from './pill.component';

@Component({
  template: `<oib-pill [type]="type" [removable]="removable" (removed)="removed = true">Pill content</oib-pill>`,
  imports: [PillComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestPillWrapper {
  type: 'primary' | 'secondary' | 'info' = 'primary';
  removable = true;
  removed = false;
}

class PillComponentTester {
  readonly fixture = TestBed.createComponent(TestPillWrapper);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly pill = this.root.getByCss('.rounded-pill');
  readonly removeButton = this.root.getByCss('button');
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
    tester.fixture.detectChanges();

    await expect.element(tester.pill).toHaveTextContent('Pill content');
    await expect.element(tester.pill).toHaveClass('badge-primary');
    await expect.element(tester.pill).toHaveAttribute('tabindex', '0');

    await tester.removeButton.click();
    expect(tester.fixture.componentInstance.removed).toBe(true);
  });

  test('should not have a button if not removable', async () => {
    const tester = new PillComponentTester();
    tester.fixture.componentInstance.removable = false;
    tester.fixture.detectChanges();

    await expect.element(tester.pill).toHaveTextContent('Pill content');
    await expect.element(tester.removeButton).not.toBeInTheDocument();
    await expect.element(tester.pill).toHaveAttribute('tabindex', '-1');
  });
});
