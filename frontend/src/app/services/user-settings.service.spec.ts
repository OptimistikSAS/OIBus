import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { ChangePasswordCommand } from '@oibus/shared/api/user.model';

import { expectHttp } from '../../test/http-testing';
import testData from '../../test/test-data';
import { UserSettingsService } from './user-settings.service';

describe('UserSettingsService', () => {
  let http: HttpTestingController;
  let service: UserSettingsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClientTesting()]
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(UserSettingsService);
  });

  afterEach(() => http.verify());

  test('should get the current user from the server', async () => {
    const user = testData.users.list[0];

    const result = await expectHttp(http, service.currentUser(), { method: 'GET', url: '/api/users/current-user' }, { response: user });

    expect(result).toEqual(user);
  });

  test('should update the user settings', async () => {
    const command = testData.users.command;

    const result = await expectHttp(http, service.update('id1', command), { method: 'PUT', url: '/api/users/id1' }, { body: command });

    expect(result).toBeNull();
  });

  test('should change the password', async () => {
    const command: ChangePasswordCommand = { currentPassword: 'current-password', newPassword: 'new-password' };

    const result = await expectHttp(
      http,
      service.updatePassword('id1', command),
      { method: 'POST', url: '/api/users/id1/password' },
      { body: command }
    );

    expect(result).toBeNull();
  });
});
