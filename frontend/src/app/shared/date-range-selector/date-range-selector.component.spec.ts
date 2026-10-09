import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { DateTime } from 'luxon';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import testData from '../../../test/test-data';
import { provideCurrentUser } from '../current-user-testing';
import { provideNgbConfigTesting } from '../form/oi-ngb-testing';
import { DateRange, DateRangeSelectorComponent } from './date-range-selector.component';

@Component({
  selector: 'oib-test-date-range-selector-host-component',
  template: `
    <form [formGroup]="testForm">
      <oib-date-range-selector
        formControlName="dateRange"
        [startLabel]="startLabel()"
        [endLabel]="endLabel()"
        [defaultRange]="defaultRange()"
      />
    </form>
  `,
  imports: [ReactiveFormsModule, DateRangeSelectorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestHostComponent {
  readonly testForm = inject(NonNullableFormBuilder).group({
    dateRange: new FormControl<DateRange | null>(null, Validators.required)
  });
  readonly startLabel = signal('south.test-item.query-start');
  readonly endLabel = signal('south.test-item.query-end');
  readonly defaultRange = signal('last-hour');
  readonly selector = viewChild.required(DateRangeSelectorComponent);
}

class DateRangeSelectorComponentTester {
  readonly fixture = TestBed.createComponent(TestHostComponent);
  readonly host = this.fixture.componentInstance;
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly rangeType = this.root.getByLabelText('Date Range');
  readonly options = this.rangeType.getByRole('option');
  readonly summary = this.root.getByCss('.range-summary');
  readonly datetimepickers = this.root.getByCss('oib-datetimepicker');
  readonly start = this.datetimepickers.nth(0);
  readonly end = this.datetimepickers.nth(1);

  get value() {
    return this.host.testForm.controls.dateRange.value;
  }
}

const NOW = '2024-01-01T12:00:00.000Z';

function formatRange(startTime: string, endTime: string) {
  const format = (instant: string) => DateTime.fromISO(instant).toLocaleString(DateTime.DATETIME_SHORT);
  return `${format(startTime)} - ${format(endTime)}`;
}

describe('DateRangeSelectorComponent', () => {
  let tester: DateRangeSelectorComponentTester;

  beforeEach(() => {
    // only the clock is faked, so that the predefined ranges are predictable
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), provideNgbConfigTesting(), provideCurrentUser({ ...testData.users.list[0], timezone: 'UTC' })]
    });
  });

  afterEach(() => vi.useRealTimers());

  test('should select the default range and send it to the parent form without interaction', async () => {
    tester = new DateRangeSelectorComponentTester();

    await expect.element(tester.rangeType).toHaveValue('last-hour');
    await expect.element(tester.summary).toHaveTextContent(formatRange('2024-01-01T11:00:00.000Z', NOW));
    await expect.element(tester.datetimepickers).toHaveLength(0);
    expect(tester.value).toEqual({ startTime: '2024-01-01T11:00:00.000Z', endTime: NOW });
    expect(tester.host.testForm.valid).toBe(true);
  });

  test('should propose the predefined ranges and a custom one', async () => {
    tester = new DateRangeSelectorComponentTester();

    await expect.element(tester.options).toHaveLength(5);
    expect(tester.options.elements().map(option => option.textContent?.trim())).toEqual([
      'Last minute',
      'Last 10 minutes',
      'Last hour',
      'Last day',
      'Custom'
    ]);
  });

  test.each([
    { label: 'Last minute', startTime: '2024-01-01T11:59:00.000Z' },
    { label: 'Last 10 minutes', startTime: '2024-01-01T11:50:00.000Z' },
    { label: 'Last hour', startTime: '2024-01-01T11:00:00.000Z' },
    { label: 'Last day', startTime: '2023-12-31T12:00:00.000Z' }
  ])('should send the range "$label" to the parent form when selected', async ({ label, startTime }) => {
    tester = new DateRangeSelectorComponentTester();
    tester.host.defaultRange.set('last-day');
    await expect.element(tester.rangeType).toBeVisible();

    await tester.rangeType.selectOptions(label === 'Last day' ? 'Last minute' : 'Last day');
    await tester.rangeType.selectOptions(label);

    expect(tester.value).toEqual({ startTime, endTime: NOW });
    await expect.element(tester.summary).toHaveTextContent(formatRange(startTime, NOW));
  });

  test('should display the date time pickers for a custom range, and send the entered range', async () => {
    tester = new DateRangeSelectorComponentTester();
    await expect.element(tester.rangeType).toHaveValue('last-hour');

    await tester.rangeType.selectOptions('Custom');

    await expect.element(tester.datetimepickers).toHaveLength(2);
    await expect.element(tester.summary).not.toBeInTheDocument();
    await expect.element(tester.root.getByText('Query data from')).toBeVisible();
    await expect.element(tester.root.getByText('Query data until')).toBeVisible();
    // the custom range starts from the last selected range
    await expect.element(tester.start).toHaveDisplayedDate('01/01/2024 11:00');
    await expect.element(tester.end).toHaveDisplayedDate('01/01/2024 12:00');
    expect(tester.value).toEqual({ startTime: '2024-01-01T11:00:00.000Z', endTime: NOW });

    await tester.start.fillWithDate('25/12/2023', '08', '30');

    await vi.waitFor(() => expect(tester.value).toEqual({ startTime: '2023-12-25T08:30:00.000Z', endTime: NOW }));
  });

  test('should not send an invalid custom range', async () => {
    tester = new DateRangeSelectorComponentTester();
    await tester.rangeType.selectOptions('Custom');
    await expect.element(tester.datetimepickers).toHaveLength(2);

    await tester.start.fillWithDate('01/02/2024', '08', '30');

    expect(tester.value).toEqual({ startTime: '2024-01-01T11:00:00.000Z', endTime: NOW });
  });

  test('should use the default labels', async () => {
    tester = new DateRangeSelectorComponentTester();
    tester.host.startLabel.set('history-query.query-time-range.start');
    tester.host.endLabel.set('history-query.query-time-range.end');

    await tester.rangeType.selectOptions('Custom');

    await expect.element(tester.root.getByText('Start', { exact: true })).toBeVisible();
    await expect.element(tester.root.getByText('End', { exact: true })).toBeVisible();
  });

  test('should display a range written by the parent form as a custom range', async () => {
    tester = new DateRangeSelectorComponentTester();
    await expect.element(tester.rangeType).toHaveValue('last-hour');

    tester.host.testForm.setValue({ dateRange: { startTime: '2020-01-01T00:00:00.000Z', endTime: '2020-06-01T00:00:00.000Z' } });

    await expect.element(tester.rangeType).toHaveValue('custom');
    await expect.element(tester.start).toHaveDisplayedDate('01/01/2020 00:00');
    await expect.element(tester.end).toHaveDisplayedDate('01/06/2020 00:00');
  });

  test('should keep a range written by the parent form before the view is initialized', async () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.componentInstance.testForm.setValue({
      dateRange: { startTime: '2020-01-01T00:00:00.000Z', endTime: '2020-06-01T00:00:00.000Z' }
    });
    const root = page.elementLocator(fixture.nativeElement);

    await expect.element(root.getByLabelText('Date Range')).toHaveValue('custom');
    expect(fixture.componentInstance.testForm.controls.dateRange.value).toEqual({
      startTime: '2020-01-01T00:00:00.000Z',
      endTime: '2020-06-01T00:00:00.000Z'
    });
  });

  test('should send the predefined range when switching from a custom range with past dates', async () => {
    tester = new DateRangeSelectorComponentTester();
    tester.host.testForm.setValue({ dateRange: { startTime: '2020-01-01T00:00:00.000Z', endTime: '2020-06-01T00:00:00.000Z' } });
    await expect.element(tester.rangeType).toHaveValue('custom');

    await tester.rangeType.selectOptions('Last 10 minutes');

    expect(tester.value).toEqual({ startTime: '2024-01-01T11:50:00.000Z', endTime: NOW });
    await expect.element(tester.datetimepickers).toHaveLength(0);
  });

  test('should be disabled with the parent control', async () => {
    tester = new DateRangeSelectorComponentTester();
    await expect.element(tester.rangeType).toBeEnabled();

    tester.host.testForm.controls.dateRange.disable();
    await expect.element(tester.rangeType).toBeDisabled();

    tester.host.testForm.controls.dateRange.enable();
    await expect.element(tester.rangeType).toBeEnabled();
  });

  describe('API used by the parents', () => {
    test('should compute a predefined range when asked', async () => {
      tester = new DateRangeSelectorComponentTester();
      await expect.element(tester.rangeType).toHaveValue('last-hour');

      vi.setSystemTime('2024-01-01T13:00:00.000Z');

      expect(tester.host.selector().currentDateRange()).toEqual({
        startTime: '2024-01-01T12:00:00.000Z',
        endTime: '2024-01-01T13:00:00.000Z'
      });
      expect(tester.host.selector().getSummaryLabel()).toBe('Last hour');
      expect(tester.host.selector().getCurrentRangeDescription()).toBe(formatRange('2024-01-01T12:00:00.000Z', '2024-01-01T13:00:00.000Z'));
    });

    test('should return the custom range when asked', async () => {
      tester = new DateRangeSelectorComponentTester();
      tester.host.testForm.setValue({ dateRange: { startTime: '2020-01-01T00:00:00.000Z', endTime: '2020-06-01T00:00:00.000Z' } });
      await expect.element(tester.rangeType).toHaveValue('custom');

      expect(tester.host.selector().currentDateRange()).toEqual({
        startTime: '2020-01-01T00:00:00.000Z',
        endTime: '2020-06-01T00:00:00.000Z'
      });
      expect(tester.host.selector().getSummaryLabel()).toBe(formatRange('2020-01-01T00:00:00.000Z', '2020-06-01T00:00:00.000Z'));
    });

    test('should return no custom range when a date is missing', async () => {
      tester = new DateRangeSelectorComponentTester();
      await tester.rangeType.selectOptions('Custom');
      await expect.element(tester.datetimepickers).toHaveLength(2);

      await tester.start.getByCss('input').nth(0).fill('');

      await vi.waitFor(() => expect(tester.host.selector().currentDateRange()).toBeNull());
      expect(tester.host.selector().getSummaryLabel()).toBe('');
    });
  });
});
