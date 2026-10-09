import { TestBed } from '@angular/core/testing';

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { NotificationService } from '../notification.service';
import { NotificationComponent } from './notification.component';

class NotificationComponentTester {
  readonly fixture = TestBed.createComponent(NotificationComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly toasts = this.root.getByRole('alert');
}

describe('NotificationComponent', () => {
  let tester: NotificationComponentTester;
  let notificationService: NotificationService;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ providers: [provideI18nTesting()] });
    tester = new NotificationComponentTester();
    notificationService = TestBed.inject(NotificationService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('should not display initially', async () => {
    await expect.element(tester.toasts).toHaveLength(0);
  });

  test('should display an i18ned success message and hide it after some seconds', async () => {
    notificationService.success('common.save');
    await vi.advanceTimersByTimeAsync(2500);
    await expect.element(tester.toasts).toHaveLength(1);
    await expect.element(tester.toasts.nth(0)).toHaveClass('bg-success');
    await expect.element(tester.toasts.nth(0)).toHaveTextContent('Save');

    notificationService.success('common.cancel');
    await expect.element(tester.toasts).toHaveLength(2);

    await vi.advanceTimersByTimeAsync(3000);
    await expect.element(tester.toasts).toHaveLength(1);
    await expect.element(tester.toasts.nth(0)).toHaveTextContent('Cancel');

    await vi.advanceTimersByTimeAsync(5000);
    await expect.element(tester.toasts).toHaveLength(0);
  });

  test('should display an i18ned error message and hide it after some seconds', async () => {
    notificationService.error('common.save');
    await vi.advanceTimersByTimeAsync(500);
    await expect.element(tester.toasts).toHaveLength(1);
    await expect.element(tester.toasts.nth(0)).toHaveClass('bg-danger');
    await expect.element(tester.toasts.nth(0)).toHaveTextContent('Save');

    await vi.advanceTimersByTimeAsync(5000);
    await expect.element(tester.toasts).toHaveLength(0);
  });

  test('should display a non-i18ned error message and hide it after some seconds', async () => {
    notificationService.errorMessage('common.save');
    await vi.advanceTimersByTimeAsync(500);
    await expect.element(tester.toasts).toHaveLength(1);
    await expect.element(tester.toasts.nth(0)).toHaveClass('bg-danger');
    await expect.element(tester.toasts.nth(0)).toHaveTextContent('common.save');

    await vi.advanceTimersByTimeAsync(5000);
    await expect.element(tester.toasts).toHaveLength(0);
  });

  test('should display a success message with parameters', async () => {
    notificationService.success('common.forbidden', { url: '/south' });
    await vi.advanceTimersByTimeAsync(500);
    await expect.element(tester.toasts).toHaveLength(1);
    await expect.element(tester.toasts.nth(0)).toHaveClass('bg-success');
    await expect.element(tester.toasts.nth(0)).toHaveTextContent(`You don't have the access rights for this entity. /south`);
  });
});
