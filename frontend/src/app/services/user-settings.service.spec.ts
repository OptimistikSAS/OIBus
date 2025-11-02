import { TestBed } from '@angular/core/testing';

import { UserSettingsService } from './user-settings.service';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ChangePasswordCommand, UserDTO } from '../../../../backend/shared/model/user.model';
import { provideHttpClient } from '@angular/common/http';
import testData from '../../../../backend/src/tests/utils/test-data';

describe('UserSettingsService', () => {
  let http: HttpTestingController;
  let service: UserSettingsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    http = TestBed.inject(HttpTestingController);

    service = TestBed.inject(UserSettingsService);
  });

  afterEach(() => http.verify());

  it('should get user settings', () => {
    let actualSettings: UserDTO | null = null;
    service.currentUser().subscribe(settings => (actualSettings = settings));

    const expectedSettings = { id: 'id1', login: 'admin' } as UserDTO;
    http.expectOne({ method: 'GET', url: '/api/users/current-user' }).flush(expectedSettings);

    expect(actualSettings!).toEqual(expectedSettings);
  });

  it('should update user settings', () => {
    let done = false;
    const command = testData.users.command;
    service.update('id1', command).subscribe(() => (done = true));

    const testRequest = http.expectOne({ method: 'PUT', url: '/api/users/id1' });
    expect(testRequest.request.body).toBe(command);
    testRequest.flush(null);

    expect(done).toBeTrue();
  });

  it('should change password', () => {
    let done = false;
    const command: ChangePasswordCommand = { currentPassword: 'current-password', newPassword: 'new-password' };
    service.updatePassword('id1', command).subscribe(() => (done = true));

    const testRequest = http.expectOne({ method: 'POST', url: '/api/users/id1/password' });
    expect(testRequest.request.body).toBe(command);
    testRequest.flush(null);

    expect(done).toBeTrue();
  });
});
