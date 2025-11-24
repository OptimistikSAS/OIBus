import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { ComponentTester } from 'ngx-speculoos';
import { LegendComponent } from './legend.component';
import { provideI18nTesting } from '../../../i18n/mock-i18n';

@Component({
  selector: 'test-legend-component',
  template: `<oib-legend [legendList]="legend" />`,
  imports: [LegendComponent]
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

  get legendItems() {
    return this.elements('.legend-item')!;
  }
}

describe('LegendComponent', () => {
  let tester: TestComponentTester;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [TestComponent],
      providers: [provideI18nTesting()]
    });

    tester = new TestComponentTester();
    await tester.change();
  });

  it('should display a legend list', () => {
    expect(tester.legendItems.length).toBe(2);
    // correct style
    expect(tester.legendItems[0].element('div')).toHaveClass('grey-dot');
    expect(tester.legendItems[1].element('div')).toHaveClass('green-dot');

    expect(tester.legendItems[0].element('span')).toContainText('Disabled');
    expect(tester.legendItems[1].element('span')).toContainText('Enabled');
  });
});
