import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { ComponentTester } from 'ngx-speculoos';
import { PillComponent } from './pill.component';

@Component({
  template: ` <oib-pill [type]="type" [removable]="removable" (removed)="removed = true">Pill content</oib-pill>`,
  imports: [PillComponent],
  standalone: true
})
class TestComponent {
  type = 'primary' as const;
  removable = true;
  removed = false;
}

class TestComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  get pill() {
    return this.element('.rounded-pill')!;
  }

  get removeButton() {
    return this.button('button')!;
  }
}

describe('PillComponent', () => {
  let tester: TestComponentTester;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TestComponent]
    });

    tester = new TestComponentTester();
    tester.detectChanges();
  });

  it('should display a pill and button to remove it', () => {
    expect(tester.pill).toContainText('Pill content');
    // correct style
    expect(tester.pill).toHaveClass('badge-primary');
    // focusable
    expect(tester.pill.attr('tabIndex')).toBe('0');

    // emit an event on remove
    tester.removeButton.click();
    expect(tester.componentInstance.removed).toBe(true);
  });

  it('should not have a button if not removable', () => {
    tester.componentInstance.removable = false;
    tester.detectChanges();
    expect(tester.pill).toContainText('Pill content');
    // no button
    expect(tester.removeButton).toBeNull();
    // not focusable
    expect(tester.pill.attr('tabIndex')).toBe('-1');
  });
});
