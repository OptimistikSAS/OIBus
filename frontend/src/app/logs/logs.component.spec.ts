import { TestBed } from '@angular/core/testing';

import { LogsComponent } from './logs.component';
import { ComponentTester } from 'ngx-speculoos';

class LogsComponentTester extends ComponentTester<LogsComponent> {
  constructor() {
    super(LogsComponent);
  }
}
describe('LogsComponent', () => {
  let tester: LogsComponentTester;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [LogsComponent]
    });

    tester = new LogsComponentTester();
  });

  it('should create', () => {
    tester.detectChanges();
    expect(tester).toBeTruthy();
  });
});
