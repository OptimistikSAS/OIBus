import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { SaveButtonComponent } from './save-button.component';
import { TestBed } from '@angular/core/testing';
import { delay, of } from 'rxjs';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ObservableState } from './save-button.component';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

@Component({
  selector: 'oib-test-save-button-component',
  template: `
    <form [formGroup]="form" id="test-form" (ngSubmit)="save()">
      <button [oib-save-button]="state" form="test-form" [forceDisabled]="forceDisabled()"></button>
    </form>
  `,
  imports: [ReactiveFormsModule, SaveButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestComponent {
  private fb = inject(FormBuilder);

  state = new ObservableState();
  save$ = of(null).pipe(delay(500), this.state.pendingUntilFinalization());
  form = this.fb.group({ name: '' });

  forceDisabled = signal(false);

  save() {
    this.save$.subscribe();
  }
}

class TestComponentTester {
  readonly fixture = TestBed.createComponent(TestComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly saveButton = this.root.getByRole('button', { name: 'Save' });
  readonly spinner = this.root.getByCss('.fa.fa-spinner');
  readonly saveIcon = this.root.getByCss('.fa.fa-save');
}

describe('SaveButton', () => {
  let tester: TestComponentTester;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideI18nTesting()]
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('with form attribute and without id attribute', () => {
    beforeEach(() => {
      tester = new TestComponentTester();
      tester.fixture.detectChanges();
    });

    test('should display the button by default', async () => {
      await expect.element(tester.saveButton).toHaveTextContent('Save');
      await expect.element(tester.saveButton).toHaveClass('btn');
      await expect.element(tester.saveButton).toHaveClass('btn-primary');
      await expect.element(tester.saveButton).toHaveAttribute('form', 'test-form');
      await expect.element(tester.saveButton).toHaveAttribute('id', 'save-button');
      await expect.element(tester.saveIcon).toBeInTheDocument();
      await expect.element(tester.saveButton).not.toBeDisabled();
      await expect.element(tester.spinner).not.toBeInTheDocument();
    });

    test('should disable the button and display the spinner when saving', async () => {
      vi.useFakeTimers();
      await tester.saveButton.click();
      tester.fixture.detectChanges();

      await expect.element(tester.saveButton).toHaveTextContent('Save');
      await expect.element(tester.saveButton).toBeDisabled();
      await expect.element(tester.spinner).toBeInTheDocument();
      await expect.element(tester.saveIcon).not.toBeInTheDocument();

      await vi.advanceTimersByTimeAsync(500);
      tester.fixture.detectChanges();
      await expect.element(tester.saveButton).not.toBeDisabled();
      await expect.element(tester.spinner).not.toBeInTheDocument();
      await expect.element(tester.saveIcon).toBeInTheDocument();

      // save again
      await tester.saveButton.click();
      tester.fixture.detectChanges();

      await expect.element(tester.saveButton).toHaveTextContent('Save');
      await expect.element(tester.saveButton).toBeDisabled();
      await expect.element(tester.spinner).toBeInTheDocument();
      await expect.element(tester.saveIcon).not.toBeInTheDocument();

      await vi.advanceTimersByTimeAsync(500);
      tester.fixture.detectChanges();
      await expect.element(tester.saveButton).not.toBeDisabled();
      await expect.element(tester.spinner).not.toBeInTheDocument();
      await expect.element(tester.saveIcon).toBeInTheDocument();
    });

    test('should disable the button when forceDisabled', async () => {
      tester.fixture.componentInstance.forceDisabled.set(true);
      tester.fixture.detectChanges();

      await expect.element(tester.saveButton).toBeDisabled();

      tester.fixture.componentInstance.forceDisabled.set(false);
      tester.fixture.detectChanges();

      await expect.element(tester.saveButton).not.toBeDisabled();
    });
  });

  describe('without form attribute and with id attribute', () => {
    beforeEach(() => {
      TestBed.overrideTemplate(
        TestComponent,
        `
        <form [formGroup]="form" (ngSubmit)="save()">
            <button [oib-save-button]="state" id="foo"></button>
        </form>
      `
      );

      tester = new TestComponentTester();
      tester.fixture.detectChanges();
    });

    test('should have no form attribute and the specified id the button by default', async () => {
      await expect.element(tester.saveButton).toHaveTextContent('Save');
      await expect.element(tester.saveButton).not.toHaveAttribute('form');
      await expect.element(tester.saveButton).toHaveAttribute('id', 'foo');
    });
  });
});
