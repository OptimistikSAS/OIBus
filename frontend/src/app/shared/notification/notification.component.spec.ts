import { TestBed } from '@angular/core/testing';
import { ComponentTester } from 'ngx-speculoos';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { NotificationService } from '../notification.service';
import { NotificationComponent } from './notification.component';
import { provideI18nTesting } from '../../../i18n/mock-i18n';

class NotificationComponentTester extends ComponentTester<NotificationComponent> {
  constructor() {
    super(NotificationComponent);
  }

  get toasts() {
    return this.elements('ngb-toast')!;
  }
}

describe('NotificationComponent', () => {
  let tester: NotificationComponentTester;
  let notificationService: NotificationService;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideI18nTesting()] });
    tester = new NotificationComponentTester();
    notificationService = TestBed.inject(NotificationService);
    await tester.change();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('should not display initially', () => {
    expect(tester.toasts.length).toBe(0);
  });

  test('should display an i18ned success message and hide it after some seconds', async () => {
    vi.useFakeTimers();

    notificationService.success('common.save');
    await tester.change();
    vi.advanceTimersByTime(2500);
    expect(tester.toasts.length).toBe(1);
    expect(tester.toasts[0].nativeElement.classList).toContain('bg-success');
    expect(tester.toasts[0].textContent).toContain('Save');

    notificationService.success('common.cancel');
    await tester.change();
    expect(tester.toasts.length).toBe(2);

    vi.advanceTimersByTime(3000);
    await tester.change();
    expect(tester.toasts.length).toBe(1);

    vi.advanceTimersByTime(5000);
    await tester.change();
    expect(tester.toasts.length).toBe(0);
  });

  test('should display an i18ned error message and hide it after some seconds', async () => {
    vi.useFakeTimers();

    notificationService.error('common.save');
    await tester.change();
    vi.advanceTimersByTime(500);
    expect(tester.toasts.length).toBe(1);
    expect(tester.toasts[0].nativeElement.classList).toContain('bg-danger');
    expect(tester.toasts[0].textContent).toContain('Save');
    vi.advanceTimersByTime(5000);
    await tester.change();
    expect(tester.toasts.length).toBe(0);
  });

  test('should display a non-i18ned error message and hide it after some seconds', async () => {
    vi.useFakeTimers();

    notificationService.errorMessage('common.save');
    await tester.change();
    vi.advanceTimersByTime(500);
    expect(tester.toasts.length).toBe(1);
    expect(tester.toasts[0].nativeElement.classList).toContain('bg-danger');
    expect(tester.toasts[0].textContent).toContain('common.save');
    vi.advanceTimersByTime(5000);
    await tester.change();
    expect(tester.toasts.length).toBe(0);
  });

  test('should display a success message with parameters', async () => {
    vi.useFakeTimers();

    notificationService.success('engine.updated');
    await tester.change();
    vi.advanceTimersByTime(500);
    expect(tester.toasts.length).toBe(1);
    expect(tester.toasts[0].nativeElement.classList).toContain('bg-success');
    expect(tester.toasts[0].textContent).toContain('Engine settings updated');
    vi.advanceTimersByTime(5000);
    await tester.change();
    expect(tester.toasts.length).toBe(0);
  });
});
