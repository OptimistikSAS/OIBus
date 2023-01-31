import { ComponentTester, TestHtmlElement } from 'ngx-speculoos';
import { DebugElement } from '@angular/core';
import { LocalDate } from '../../../../../shared/model/types';

export class TestDatetimepicker extends TestHtmlElement<HTMLElement> {
  constructor(tester: ComponentTester<unknown>, debugElement: DebugElement) {
    super(tester, debugElement);
  }

  get date() {
    return this.elements<HTMLInputElement>('input')[0] ?? null;
  }

  get hour() {
    return this.elements<HTMLInputElement>('input')[1] ?? null;
  }

  get minute() {
    return this.elements<HTMLInputElement>('input')[2] ?? null;
  }

  get second() {
    return this.elements<HTMLInputElement>('input')[3] ?? null;
  }

  get displayedValue() {
    let result = `${this.date.value} ${this.hour.value}:${this.minute.value}`;
    if (this.second) {
      result += `:${this.second.value}`;
    }
    return result;
  }

  fillWith(date: LocalDate, hour = '00', minute = '00', second = '00') {
    this.date.fillWith(date);
    this.hour.fillWith(hour);
    this.hour.dispatchEventOfType('change');
    this.minute.fillWith(minute);
    this.minute.dispatchEventOfType('change');
    if (this.second) {
      this.second.fillWith(second);
      this.second.dispatchEventOfType('change');
    }
  }
}
