import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { DayOfWeekSelectorComponent } from './day-of-week-selector.component';

@Component({
  template: `<oib-day-of-week-selector [formControl]="control" />`,
  imports: [DayOfWeekSelectorComponent, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestComponent {
  readonly control = new FormControl<Array<number>>([]);
}

class Tester {
  readonly fixture = TestBed.createComponent(TestComponent);
  readonly control = this.fixture.componentInstance.control;
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly days = this.root.getByRole('button');
  readonly pressedDays = this.root.getByRole('button', { pressed: true });

  day(label: string) {
    return this.root.getByRole('button', { name: label });
  }

  async expectPressed(labels: Array<string>) {
    await expect.element(this.pressedDays).toHaveLength(labels.length);
    expect(this.pressedDays.elements().map(element => element.textContent!.trim())).toEqual(labels);
  }
}

describe('DayOfWeekSelectorComponent', () => {
  let tester: Tester;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideI18nTesting()] });
    tester = new Tester();
  });

  test('should render the seven days Monday first', async () => {
    await expect.element(tester.days).toHaveLength(7);
    expect(tester.days.elements().map(element => element.textContent!.trim())).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    await tester.expectPressed([]);
  });

  test('should toggle days and emit a sorted array', async () => {
    // Saturday is 6, Sunday is 0: emitted ascending regardless of the click order
    await tester.day('Sat').click();
    await tester.day('Sun').click();

    expect(tester.control.value).toEqual([0, 6]);
    expect(tester.control.touched).toBe(true);
    await tester.expectPressed(['Sat', 'Sun']);
  });

  test('should deselect a selected day', async () => {
    tester.control.setValue([1]);
    await tester.expectPressed(['Mon']);

    await tester.day('Mon').click();

    expect(tester.control.value).toEqual([]);
    await tester.expectPressed([]);
  });

  test('should render the days written to it', async () => {
    tester.control.setValue([1, 0]);

    await tester.expectPressed(['Mon', 'Sun']);
  });

  test('should be disabled with its control', async () => {
    tester.control.disable();

    await expect.element(tester.day('Mon')).toBeDisabled();
    await tester.day('Mon').click({ force: true });
    expect(tester.control.value).toEqual([]);
  });

  test('should not mutate the array it was given, so form resets keep working', async () => {
    const initial: Array<number> = [1];
    tester.control.setValue(initial);
    await tester.expectPressed(['Mon']);

    await tester.day('Tue').click();

    expect(initial).toEqual([1]);
    expect(tester.control.value).toEqual([1, 2]);
  });
});
