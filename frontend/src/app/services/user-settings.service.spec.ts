import { TestBed } from '@angular/core/testing';

import { UserSettingsService } from './user-settings.service';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ChangePasswordCommand, User, UserCommandDTO } from '../../../../shared/model/user.model';

describe('UserSettingsService', () => {
  let http: HttpTestingController;
  let service: UserSettingsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule]
    });
    http = TestBed.inject(HttpTestingController);

    service = TestBed.inject(UserSettingsService);
  });

  afterEach(() => http.verify());

  it('should get user settings', () => {
    let actualSettings: User | null = null;
    service.get().subscribe(settings => (actualSettings = settings));

    const expectedSettings = { login: 'admin' } as User;
    http.expectOne({ method: 'GET', url: '/api/users/current-user' }).flush(expectedSettings);

    expect(actualSettings!).toEqual(expectedSettings);
  });

  it('should update user settings', () => {
    let done = false;
    const command: UserCommandDTO = { firstName: 'Admin' } as UserCommandDTO;
    service.update(command).subscribe(() => (done = true));

    const testRequest = http.expectOne({ method: 'PUT', url: '/api/users/current-user' });
    expect(testRequest.request.body).toBe(command);
    testRequest.flush(null);

    expect(done).toBeTrue();
  });

  it('should change password', () => {
    let done = false;
    const command: ChangePasswordCommand = { currentPassword: 'current-password', newPassword: 'new-password' };
    service.changePassword(command).subscribe(() => (done = true));

    const testRequest = http.expectOne({ method: 'PUT', url: '/api/users/current-user/change-password' });
    expect(testRequest.request.body).toBe(command);
    testRequest.flush(null);

    expect(done).toBeTrue();
  });
});
