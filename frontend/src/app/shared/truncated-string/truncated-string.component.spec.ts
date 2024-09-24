import { TestBed } from '@angular/core/testing';

import { Component } from '@angular/core';
import { ComponentTester } from 'ngx-speculoos';
import { TruncatedStringComponent } from './truncated-string.component';

@Component({
  template: `<oib-truncated-string [string]="text" maxLength="10" />`,
  standalone: true,
  imports: [TruncatedStringComponent]
})
class TestComponent {
  text: string | null | undefined = null;
}

class TestComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  get textSpan() {
    return this.element('span');
  }

  get seeAllButton() {
    return this.button('button');
  }

  get popoverWindow() {
    return this.element('ngb-popover-window');
  }
}

describe('TruncatedStringComponent', () => {
  let tester: TestComponentTester;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    tester = new TestComponentTester();
  });

  it('should display nothing when text is null', () => {
    tester.detectChanges();
    expect(tester.textSpan).toHaveText('');
    expect(tester.seeAllButton).toBeNull();
  });

  it('should display text when text is short', () => {
    tester.componentInstance.text = 'Hello';
    tester.detectChanges();
    expect(tester.textSpan).toHaveText('Hello');
    expect(tester.seeAllButton).toBeNull();
  });

  it('should display truncated text and button when text is long', () => {
    tester.componentInstance.text = 'Hello World. this is truncated.';
    tester.detectChanges();
    expect(tester.textSpan).toHaveText('Hello Worl');
    expect(tester.seeAllButton).not.toBeNull();

    expect(tester.popoverWindow).toBeNull();
    tester.seeAllButton!.click();
    expect(tester.popoverWindow).toContainText('Hello World. this is truncated.');
  });
});
