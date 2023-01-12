import { Component } from '@angular/core';
import { ObservableState, SaveButtonComponent } from './save-button.component';
import { ComponentTester } from 'ngx-speculoos';
import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { MockI18nModule } from '../../../i18n/mock-i18n.spec';
import { delay, of } from 'rxjs';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';

@Component({
  template: `
    <form [formGroup]="form" id="test-form" (ngSubmit)="save()">
      <oib-save-button form="test-form" [state]="state"></oib-save-button>
    </form>
  `,
  imports: [SaveButtonComponent, ReactiveFormsModule],
  standalone: true
})
class TestComponent {
  state = new ObservableState();
  save$ = of(null).pipe(delay(500), this.state.pendingUntilFinalization());
  form = this.fb.group({ name: '' });

  constructor(private fb: FormBuilder) {}

  save() {
    this.save$.subscribe();
  }
}

class TestComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  get saveButton() {
    return this.button('#save-button')!;
  }

  get spinner() {
    return this.element('.fa.fa-spinner')!;
  }

  get saveIcon() {
    return this.element('.fa.fa-save')!;
  }
}

describe('SaveButton', () => {
  let tester: TestComponentTester;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [MockI18nModule, ReactiveFormsModule, SaveButtonComponent, TestComponent]
    });

    tester = new TestComponentTester();
  });

  it('should display the button by default', () => {
    tester.detectChanges();
    expect(tester.saveButton).toContainText('Save');
    expect(tester.saveButton).toHaveClass('btn');
    expect(tester.saveButton).toHaveClass('btn-primary');
    expect(tester.saveButton.attr('form')).toBe('test-form');
    expect(tester.saveIcon).not.toBeNull();
    expect(tester.saveButton.disabled).toBe(false);
    expect(tester.spinner).toBeNull();
  });

  it('should disable the button and display the spinner when saving', fakeAsync(() => {
    tester.detectChanges();
    tester.saveButton.click();

    expect(tester.saveButton).toContainText('Save');
    expect(tester.saveButton.disabled).toBe(true);
    expect(tester.spinner).not.toBeNull();
    expect(tester.saveIcon).toBeNull();

    tick(500);
    tester.detectChanges();
    expect(tester.saveButton.disabled).toBe(false);
    expect(tester.spinner).toBeNull();
    expect(tester.saveIcon).not.toBeNull();

    // save again
    tester.saveButton.click();

    expect(tester.saveButton).toContainText('Save');
    expect(tester.saveButton.disabled).toBe(true);
    expect(tester.spinner).not.toBeNull();
    expect(tester.saveIcon).toBeNull();

    tick(500);
    tester.detectChanges();
    expect(tester.saveButton.disabled).toBe(false);
    expect(tester.spinner).toBeNull();
    expect(tester.saveIcon).not.toBeNull();
  }));
});
