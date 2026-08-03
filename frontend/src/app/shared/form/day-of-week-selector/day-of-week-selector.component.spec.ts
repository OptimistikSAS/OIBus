import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test } from 'vitest';

import { DayOfWeekSelectorComponent } from './day-of-week-selector.component';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';

@Component({
  template: `<oib-day-of-week-selector [formControl]="control" />`,
  imports: [DayOfWeekSelectorComponent, ReactiveFormsModule]
})
class TestComponent {
  control = new FormControl<Array<number>>([]);
}

class Tester {
  readonly fixture = TestBed.createComponent(TestComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);

  day(value: number) {
    return this.root.getByCss(`[data-day="${value}"]`);
  }

  get pressed(): Array<string> {
    return Array.from(this.fixture.nativeElement.querySelectorAll('[aria-pressed="true"]')).map(element =>
      (element as HTMLElement).textContent!.trim()
    );
  }
}

describe('DayOfWeekSelectorComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideI18nTesting()] });
  });

  test('should render the seven days Monday first', () => {
    const tester = new Tester();
    tester.fixture.detectChanges();

    const labels = Array.from(tester.fixture.nativeElement.querySelectorAll('[data-day]')).map(element =>
      (element as HTMLElement).textContent!.trim()
    );
    expect(labels).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  });

  test('should toggle a day and emit a sorted array', async () => {
    const tester = new Tester();
    tester.fixture.detectChanges();

    // Saturday is 6, Sunday is 0 — emitted ascending regardless of click order.
    await tester.day(6).click();
    await tester.day(0).click();
    tester.fixture.detectChanges();

    expect(tester.fixture.componentInstance.control.value).toEqual([0, 6]);
    expect(tester.pressed).toEqual(['Sat', 'Sun']);
  });

  test('should deselect a selected day', async () => {
    const tester = new Tester();
    tester.fixture.componentInstance.control.setValue([1]);
    tester.fixture.detectChanges();

    await tester.day(1).click();

    expect(tester.fixture.componentInstance.control.value).toEqual([]);
  });

  test('should render the days written to it', () => {
    const tester = new Tester();
    tester.fixture.componentInstance.control.setValue([0, 1]);
    tester.fixture.detectChanges();

    expect(tester.pressed).toEqual(['Mon', 'Sun']);
  });

  test('should ignore clicks when disabled', async () => {
    const tester = new Tester();
    tester.fixture.componentInstance.control.disable();
    tester.fixture.detectChanges();

    await tester
      .day(1)
      .click({ force: true })
      .catch(() => undefined);

    expect(tester.fixture.componentInstance.control.value).toEqual([]);
  });

  test('should not mutate the array it was given, so form resets keep working', async () => {
    const tester = new Tester();
    const initial: Array<number> = [1];
    tester.fixture.componentInstance.control.setValue(initial);
    tester.fixture.detectChanges();

    await tester.day(2).click();

    expect(initial).toEqual([1]);
  });
});
