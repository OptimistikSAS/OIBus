import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ChangePasswordCommand, User, UserCommandDTO } from '../../../../shared/model/user.model';

@Injectable({
  providedIn: 'root'
})
export class UserSettingsService {
  constructor(private http: HttpClient) {}

  // we do not use the current user service here, to make sure we get the actual data from the server and not the cached data
  get(): Observable<User> {
    return this.http.get<User>('/api/users/current-user');
  }

  update(userId: string, command: UserCommandDTO): Observable<void> {
    return this.http.put<void>(`/api/users/${userId}`, command);
  }

  changePassword(userId: string, command: ChangePasswordCommand): Observable<void> {
    return this.http.put<void>(`/api/users/${userId}/change-password`, command);
  }
}
