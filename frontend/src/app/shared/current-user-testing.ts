import { CurrentUserService } from './current-user.service';
import { of } from 'rxjs';
import { createMock } from 'ngx-speculoos';
import { UserDTO } from '../../../../backend/shared/model/user.model';
import { DEFAULT_TZ } from '../../../../backend/shared/model/types';

const defaultCurrentUser = {
  timezone: DEFAULT_TZ
} as UserDTO;

/**
 * Provide a mock for the CurrentUserService with the given user (or a default one if not provided)
 * @param currentUser The user to provide
 */
export function provideCurrentUser(currentUser?: UserDTO) {
  const currentUserService = createMock(CurrentUserService);
  const user = currentUser ?? defaultCurrentUser;
  currentUserService.get.and.returnValue(of(user));
  currentUserService.getTimezone.and.returnValue(user.timezone);
  return { provide: CurrentUserService, useValue: currentUserService };
}
