import { TestBed } from '@angular/core/testing';

import { beforeEach, describe, expect, test } from 'vitest';

import { Notification, NotificationService } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;
  let notifications: Array<Notification>;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NotificationService);
    notifications = [];
    service.notificationChanges.subscribe(notification => notifications.push(notification));
  });

  test('should emit every time a success is called', () => {
    service.success('hello');
    service.success('world', { value: '!' });

    expect(notifications).toEqual([
      { type: 'success', i18nKey: 'hello', i18nArgs: undefined },
      { type: 'success', i18nKey: 'world', i18nArgs: { value: '!' } }
    ]);
  });

  test('should emit every time an error is called', () => {
    service.error('hello');
    service.error('world', { value: '!' });

    expect(notifications).toEqual([
      { type: 'error', i18nKey: 'hello', i18nArgs: undefined },
      { type: 'error', i18nKey: 'world', i18nArgs: { value: '!' } }
    ]);
  });

  test('should emit every time an error message is called', () => {
    service.errorMessage('hello');

    expect(notifications).toEqual([{ type: 'error', message: 'hello' }]);
  });
});
