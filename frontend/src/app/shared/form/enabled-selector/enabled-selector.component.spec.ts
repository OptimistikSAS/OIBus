import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { EnabledSelectorComponent } from './enabled-selector.component';

@Component({
  template: `<div id="status">Status</div>
    <oib-enabled-selector [formControl]="control" inputId="test-enabled" labelledBy="status" />`,
  imports: [EnabledSelectorComponent, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestComponent {
  readonly control = new FormControl(true, { nonNullable: true });
}

class Tester {
  readonly fixture = TestBed.createComponent(TestComponent);
  readonly control = this.fixture.componentInstance.control;
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly group = this.root.getByRole('radiogroup', { name: 'Status' });
  readonly enabled = this.root.getByRole('radio', { name: 'Enabled' });
  readonly disabled = this.root.getByRole('radio', { name: 'Disabled' });
}

describe('EnabledSelectorComponent', () => {
  let tester: Tester;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideI18nTesting()] });
    tester = new Tester();
  });

  test('should show both choices, labelled, the value of the control being checked', async () => {
    await expect.element(tester.group).toBeInTheDocument();
    await expect.element(tester.enabled).toBeChecked();
    await expect.element(tester.disabled).not.toBeChecked();
    await expect.element(tester.enabled).toHaveAttribute('id', 'test-enabled');

    tester.control.setValue(false);

    await expect.element(tester.disabled).toBeChecked();
    await expect.element(tester.enabled).not.toBeChecked();
  });

  test('should set the control to the chosen value', async () => {
    await tester.root.getByText('Disabled').click();

    expect(tester.control.value).toBe(false);
    expect(tester.control.touched).toBe(true);
    await expect.element(tester.disabled).toBeChecked();

    await tester.root.getByText('Enabled').click();

    expect(tester.control.value).toBe(true);
  });

  test('should not be changed when the control is disabled', async () => {
    tester.control.disable();

    await expect.element(tester.enabled).toBeDisabled();
    await expect.element(tester.disabled).toBeDisabled();
  });
});
