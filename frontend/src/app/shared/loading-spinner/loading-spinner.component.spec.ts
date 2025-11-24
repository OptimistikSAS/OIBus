import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { ComponentTester } from 'ngx-speculoos';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { LoadingSpinnerComponent } from './loading-spinner.component';

@Component({
  selector: 'oib-test-loading-spinner-component',
  template: ` <oib-loading-spinner />`,
  imports: [LoadingSpinnerComponent]
})
class TestComponent {
  legend = [
    { label: 'north.disabled', class: 'grey-dot' },
    { label: 'north.enabled', class: 'green-dot' }
  ];
}

class TestComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  get loadingSpinner() {
    return this.element('.fa-spinner')!;
  }
}

describe('LoadingSpinnerComponent', () => {
  let tester: TestComponentTester;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [TestComponent],
      providers: [provideI18nTesting()]
    });

    tester = new TestComponentTester();
    await tester.change();
  });

  it('should display a spinner', () => {
    expect(tester.loadingSpinner).toBeDefined();
  });
});
