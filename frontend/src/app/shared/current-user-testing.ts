import { CurrentUserService } from './current-user.service';
import { of } from 'rxjs';
import { createMock } from 'ngx-speculoos';
import { User } from '../../../../shared/model/user.model';
import { DEFAULT_TZ } from '../../../../shared/model/types';

const defaultCurrentUser = {
  timezone: DEFAULT_TZ
} as User;

/**
 * Provide a mock for the CurrentUserService with the given user (or a default one if not provided)
 * @param currentUser The user to provide
 */
export function provideCurrentUser(currentUser?: User) {
  const currentUserService = createMock(CurrentUserService);
  const user = currentUser ?? defaultCurrentUser;
  currentUserService.get.and.returnValue(of(user));
  currentUserService.getTimezone.and.returnValue(user.timezone);
  return { provide: CurrentUserService, useValue: currentUserService };
}
