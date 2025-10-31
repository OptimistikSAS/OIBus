import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ChangePasswordCommand, UserDTO, UserCommandDTO } from '../../../../backend/shared/model/user.model';

@Injectable({
  providedIn: 'root'
})
export class UserSettingsService {
  private http = inject(HttpClient);

  // we do not use the current user service here, to make sure we get the actual data from the server and not the cached data
  currentUser(): Observable<UserDTO> {
    return this.http.get<UserDTO>('/api/users/current-user');
  }

  update(userId: string, command: UserCommandDTO): Observable<void> {
    return this.http.put<void>(`/api/users/${userId}`, command);
  }

  updatePassword(userId: string, command: ChangePasswordCommand): Observable<void> {
    return this.http.put<void>(`/api/users/${userId}/change-password`, command);
  }
}
