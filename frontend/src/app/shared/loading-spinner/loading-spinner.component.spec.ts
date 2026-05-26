import { TestBed } from '@angular/core/testing';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test } from 'vitest';
import { LoadingSpinnerComponent } from './loading-spinner.component';

class LoadingSpinnerComponentTester {
  readonly fixture = TestBed.createComponent(LoadingSpinnerComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly spinner = this.root.getByCss('.fa-spinner');
}

describe('LoadingSpinnerComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [LoadingSpinnerComponent] });
  });

  test('should display a spinner', async () => {
    const tester = new LoadingSpinnerComponentTester();
    await expect.element(tester.spinner).toBeInTheDocument();
  });
});
