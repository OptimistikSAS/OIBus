import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { ComponentTester } from 'ngx-speculoos';
import { OibHelpComponent } from './oib-help.component';

@Component({
  template: ` <oib-help [url]="url"></oib-help>`,
  imports: [OibHelpComponent],
  standalone: true
})
class TestComponent {
  url = 'https://oibus.optimistik.com' as const;
}

class TestComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  get infoCircle() {
    return this.element('.fa-info-circle')!;
  }
}

describe('OibHelpComponent', () => {
  let tester: TestComponentTester;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TestComponent]
    });

    tester = new TestComponentTester();
    tester.detectChanges();
  });

  it('should display a info circle', () => {
    expect(tester.infoCircle).toHaveText('');
  });
});
