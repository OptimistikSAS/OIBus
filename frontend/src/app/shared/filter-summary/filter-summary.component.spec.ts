import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { FilterSummaryComponent } from './filter-summary.component';

@Component({
  template: `<oib-filter-summary [shown]="2" [total]="5" [filtered]="filtered()" (resetFilters)="reset()" />`,
  imports: [FilterSummaryComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class HostComponent {
  readonly filtered = signal(true);
  readonly reset = vi.fn();
}

describe('FilterSummaryComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideI18nTesting()] }));

  test('should tell how many elements are shown, and reset the filters', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    const root = page.elementLocator(fixture.nativeElement);

    await expect.element(root.getByText('2 of 5')).toBeInTheDocument();
    await root.getByRole('button', { name: 'Reset filters' }).click();

    expect(fixture.componentInstance.reset).toHaveBeenCalledOnce();
  });

  test('should display nothing when no filter is active', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.filtered.set(false);
    const root = page.elementLocator(fixture.nativeElement);

    await expect.element(root.getByRole('button', { name: 'Reset filters' })).not.toBeInTheDocument();
    await expect.element(root.getByText('2 of 5')).not.toBeInTheDocument();
  });
});
