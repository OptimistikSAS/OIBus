import { TestBed } from '@angular/core/testing';

import { UserSettingsService } from './user-settings.service';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ChangePasswordCommand, User, UserCommandDTO } from '../../../../shared/model/user.model';
import { provideHttpClient } from '@angular/common/http';

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
    let actualSettings: User | null = null;
    service.get().subscribe(settings => (actualSettings = settings));

    const expectedSettings = { id: 'id1', login: 'admin' } as User;
    http.expectOne({ method: 'GET', url: '/api/users/current-user' }).flush(expectedSettings);

    expect(actualSettings!).toEqual(expectedSettings);
  });

  it('should update user settings', () => {
    let done = false;
    const command: UserCommandDTO = { firstName: 'Admin' } as UserCommandDTO;
    service.update('id1', command).subscribe(() => (done = true));

    const testRequest = http.expectOne({ method: 'PUT', url: '/api/users/id1' });
    expect(testRequest.request.body).toBe(command);
    testRequest.flush(null);

    expect(done).toBeTrue();
  });

  it('should change password', () => {
    let done = false;
    const command: ChangePasswordCommand = { currentPassword: 'current-password', newPassword: 'new-password' };
    service.changePassword('id1', command).subscribe(() => (done = true));

    const testRequest = http.expectOne({ method: 'PUT', url: '/api/users/id1/change-password' });
    expect(testRequest.request.body).toBe(command);
    testRequest.flush(null);

    expect(done).toBeTrue();
  });
});
