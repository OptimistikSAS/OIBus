import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Injectable, inject } from '@angular/core';
import {
  EngineSettingsCommandDTO,
  EngineSettingsDTO,
  OIBusInfo,
  RegistrationSettingsCommandDTO,
  RegistrationSettingsDTO
} from '../../../../shared/model/engine.model';

/**
 * Service used to interact with the backend for CRUD operations on the engine settings
 */
@Injectable({
  providedIn: 'root'
})
export class EngineService {
  private http = inject(HttpClient);

  /**
   * Get the engine settings
   */
  getEngineSettings(): Observable<EngineSettingsDTO> {
    return this.http.get<EngineSettingsDTO>(`/api/engine`);
  }

  /**
   * Update the selected external source
   * @param command - the new values of the engine settings
   */
  updateEngineSettings(command: EngineSettingsCommandDTO): Observable<void> {
    return this.http.put<void>(`/api/engine`, command);
  }

  getInfo(): Observable<OIBusInfo> {
    return this.http.get<OIBusInfo>('/api/info');
  }

  shutdown(): Observable<void> {
    return this.http.put<void>('/api/shutdown', null);
  }

  restart(): Observable<void> {
    return this.http.put<void>('/api/restart', null);
  }

  /**
   * Reset the Engine metrics
   */
  resetMetrics(): Observable<void> {
    return this.http.put<void>(`/api/engine/reset-metrics`, null);
  }

  /**
   * Get the engine settings
   */
  getRegistrationSettings(): Observable<RegistrationSettingsDTO> {
    return this.http.get<RegistrationSettingsDTO>(`/api/registration`);
  }

  /**
   * Get the engine settings
   */
  updateRegistrationSettings(command: RegistrationSettingsCommandDTO): Observable<void> {
    return this.http.put<void>(`/api/registration`, command);
  }

  /**
   * Edit the engine settings
   */
  editRegistrationSettings(command: RegistrationSettingsCommandDTO): Observable<void> {
    return this.http.put<void>(`/api/registration/edit`, command);
  }

  unregister(): Observable<void> {
    return this.http.put<void>(`/api/registration/unregister`, null);
  }
}
