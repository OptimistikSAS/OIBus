import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { ModalStepsComponent } from './modal-steps.component';

type ItemModalStep = 'general' | 'settings' | 'review';

@Component({
  template: `<oib-modal-steps
    [steps]="steps"
    [(current)]="current"
    [invalidSteps]="invalidSteps()"
    labelPrefix="south.edit-item-modal.step."
    ariaLabel="south.edit-item-modal.steps"
  />`,
  imports: [ModalStepsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestModalStepsWrapper {
  readonly steps: Array<ItemModalStep> = ['general', 'settings', 'review'];
  readonly current = signal<ItemModalStep>('general');
  readonly invalidSteps = signal<Array<ItemModalStep>>([]);
}

class ModalStepsComponentTester {
  readonly fixture = TestBed.createComponent(TestModalStepsWrapper);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly nav = this.root.getByRole('navigation', { name: 'Item steps' });
  readonly general = this.root.getByRole('button', { name: '1 Name & schedule' });
  readonly settings = this.root.getByRole('button', { name: '2 Settings' });
  readonly invalidSettings = this.root.getByRole('button', { name: 'Settings (has errors)' });
}

describe('ModalStepsComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TestModalStepsWrapper],
      providers: [provideI18nTesting()]
    });
  });

  test('should show the steps, the current one standing out', async () => {
    const tester = new ModalStepsComponentTester();

    await expect.element(tester.nav.getByRole('button')).toHaveLength(3);
    await expect.element(tester.general).toHaveAttribute('aria-current', 'step');
    await expect.element(tester.general).toHaveAttribute('id', 'modal-step-general');
    await expect.element(tester.settings).not.toHaveAttribute('aria-current');
  });

  test('should open the clicked step', async () => {
    const tester = new ModalStepsComponentTester();

    await tester.settings.click();

    expect(tester.fixture.componentInstance.current()).toBe('settings');
    await expect.element(tester.settings).toHaveAttribute('aria-current', 'step');
  });

  test('should flag the invalid steps', async () => {
    const tester = new ModalStepsComponentTester();

    tester.fixture.componentInstance.invalidSteps.set(['settings']);

    await expect.element(tester.invalidSettings).toHaveClass('modal-step-invalid');
    await expect.element(tester.general).not.toHaveClass('modal-step-invalid');
  });
});
