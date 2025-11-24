import { Component, inject } from '@angular/core';
import { SaveButtonComponent } from './save-button.component';
import { ComponentTester } from 'ngx-speculoos';
import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { delay, of } from 'rxjs';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ObservableState } from './save-button.component';
import { provideI18nTesting } from '../../../i18n/mock-i18n';

@Component({
  selector: 'test-save-button-component',
  template: `
    <form [formGroup]="form" id="test-form" (ngSubmit)="save()">
      <button [oib-save-button]="state" form="test-form" [forceDisabled]="forceDisabled"></button>
    </form>
  `,
  imports: [ReactiveFormsModule, SaveButtonComponent]
})
class TestComponent {
  private fb = inject(FormBuilder);

  state = new ObservableState();
  save$ = of(null).pipe(delay(500), this.state.pendingUntilFinalization());
  form = this.fb.group({ name: '' });

  forceDisabled = false;

  save() {
    this.save$.subscribe();
  }
}

class TestComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  get saveButton() {
    return this.button('button')!;
  }

  get spinner() {
    return this.element('.fa.fa-spinner');
  }

  get saveIcon() {
    return this.element('.fa.fa-save');
  }
}

describe('SaveButton', () => {
  let tester: TestComponentTester;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideI18nTesting()]
    });
  });

  describe('with form attribute and without id attribute', () => {
    beforeEach(async () => {
      tester = new TestComponentTester();
      await tester.change();
    });

    it('should display the button by default', () => {
      expect(tester.saveButton).toContainText('Save');
      expect(tester.saveButton).toHaveClass('btn');
      expect(tester.saveButton).toHaveClass('btn-primary');
      expect(tester.saveButton.attr('form')).toBe('test-form');
      expect(tester.saveButton.attr('id')).toBe('save-button');
      expect(tester.saveIcon).not.toBeNull();
      expect(tester.saveButton.disabled).toBe(false);
      expect(tester.spinner).toBeNull();
    });

    it('should disable the button and display the spinner when saving', fakeAsync(async () => {
      tester.saveButton.click();

      expect(tester.saveButton).toContainText('Save');
      expect(tester.saveButton.disabled).toBe(true);
      expect(tester.spinner).not.toBeNull();
      expect(tester.saveIcon).toBeNull();

      tick(500);
      await tester.change();
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
      await tester.change();
      expect(tester.saveButton.disabled).toBe(false);
      expect(tester.spinner).toBeNull();
      expect(tester.saveIcon).not.toBeNull();
    }));

    it('should disable the button when forceDisabled', async () => {
      tester.componentInstance.forceDisabled = true;
      await tester.change();

      expect(tester.saveButton.disabled).toBeTrue();

      tester.componentInstance.forceDisabled = false;
      await tester.change();

      expect(tester.saveButton.disabled).toBeFalse();
    });
  });

  describe('without form attribute and with id attribute', () => {
    beforeEach(async () => {
      TestBed.overrideTemplate(
        TestComponent,
        `
        <form [formGroup]="form" (ngSubmit)="save()">
            <button [oib-save-button]="state" id="foo"></button>
        </form>
      `
      );

      tester = new TestComponentTester();
      await tester.change();
    });

    it('should have no form attribute and the specified id the button by default', () => {
      expect(tester.saveButton).toContainText('Save');
      expect(tester.saveButton.attr('form')).toBeNull();
      expect(tester.saveButton.attr('id')).toBe('foo');
    });
  });
});
