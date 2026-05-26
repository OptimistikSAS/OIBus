import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { NotificationService } from '../notification.service';
import { NotificationComponent } from './notification.component';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { page } from 'vitest/browser';

class NotificationComponentTester {
  readonly fixture = TestBed.createComponent(NotificationComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly toasts = this.root.getByCss('ngb-toast');

  detectChanges() {
    this.fixture.detectChanges();
  }
}

describe('NotificationComponent', () => {
  let tester: NotificationComponentTester;
  let notificationService: NotificationService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideI18nTesting()] });
    tester = new NotificationComponentTester();
    notificationService = TestBed.inject(NotificationService);
    tester.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('should not display initially', async () => {
    await expect.element(tester.toasts).toHaveLength(0);
  });

  test('should display an i18ned success message and hide it after some seconds', async () => {
    vi.useFakeTimers();

    notificationService.success('common.save');
    tester.detectChanges();
    await vi.advanceTimersByTimeAsync(2500);
    await expect.element(tester.toasts).toHaveLength(1);
    await expect.element(tester.toasts.nth(0)).toHaveClass('bg-success');
    await expect.element(tester.toasts.nth(0)).toHaveTextContent('Save');

    notificationService.success('common.cancel');
    tester.detectChanges();
    await expect.element(tester.toasts).toHaveLength(2);

    await vi.advanceTimersByTimeAsync(3000);
    tester.detectChanges();
    await expect.element(tester.toasts).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(5000);
    tester.detectChanges();
    await expect.element(tester.toasts).toHaveLength(0);
  });

  test('should display an i18ned error message and hide it after some seconds', async () => {
    vi.useFakeTimers();

    notificationService.error('common.save');
    tester.detectChanges();
    await vi.advanceTimersByTimeAsync(500);
    await expect.element(tester.toasts).toHaveLength(1);
    await expect.element(tester.toasts.nth(0)).toHaveClass('bg-danger');
    await expect.element(tester.toasts.nth(0)).toHaveTextContent('Save');
    await vi.advanceTimersByTimeAsync(5000);
    tester.detectChanges();
    await expect.element(tester.toasts).toHaveLength(0);
  });

  test('should display a non-i18ned error message and hide it after some seconds', async () => {
    vi.useFakeTimers();

    notificationService.errorMessage('common.save');
    tester.detectChanges();
    await vi.advanceTimersByTimeAsync(500);
    await expect.element(tester.toasts).toHaveLength(1);
    await expect.element(tester.toasts.nth(0)).toHaveClass('bg-danger');
    await expect.element(tester.toasts.nth(0)).toHaveTextContent('common.save');
    await vi.advanceTimersByTimeAsync(5000);
    tester.detectChanges();
    await expect.element(tester.toasts).toHaveLength(0);
  });

  test('should display a success message with parameters', async () => {
    vi.useFakeTimers();

    notificationService.success('engine.updated');
    tester.detectChanges();
    await vi.advanceTimersByTimeAsync(500);
    await expect.element(tester.toasts).toHaveLength(1);
    await expect.element(tester.toasts.nth(0)).toHaveClass('bg-success');
    await expect.element(tester.toasts.nth(0)).toHaveTextContent('Engine settings updated');
    await vi.advanceTimersByTimeAsync(5000);
    tester.detectChanges();
    await expect.element(tester.toasts).toHaveLength(0);
  });
});
