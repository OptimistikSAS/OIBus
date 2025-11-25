import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Injectable, inject } from '@angular/core';
import {
  EngineSettingsCommandDTO,
  EngineSettingsDTO,
  OIBusInfo,
  RegistrationSettingsCommandDTO,
  RegistrationSettingsDTO
} from '../../../../backend/shared/model/engine.model';

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

  /**
   * Reset the Engine metrics
   */
  resetEngineMetrics(): Observable<void> {
    return this.http.post<void>(`/api/engine/metrics/reset`, null);
  }

  restart(): Observable<void> {
    return this.http.post<void>('/api/engine/restart', null);
  }

  getInfo(): Observable<OIBusInfo> {
    return this.http.get<OIBusInfo>('/api/engine/info');
  }

  getRegistrationSettings(): Observable<RegistrationSettingsDTO> {
    return this.http.get<RegistrationSettingsDTO>(`/api/oianalytics/registration`);
  }

  /**
   * Register OIAnalytics (generate 6 characters code)
   */
  register(command: RegistrationSettingsCommandDTO): Observable<void> {
    return this.http.post<void>(`/api/oianalytics/register`, command);
  }

  /**
   * Edit registration permissions and intervals
   */
  editRegistrationSettings(command: RegistrationSettingsCommandDTO): Observable<void> {
    return this.http.put<void>(`/api/oianalytics/registration`, command);
  }

  /**
   * Test connection to OIAnalytics with the provided settings
   */
  testOIAnalyticsConnection(command: RegistrationSettingsCommandDTO): Observable<void> {
    return this.http.post<void>(`/api/oianalytics/registration/test-connection`, command);
  }

  unregister(): Observable<void> {
    return this.http.post<void>(`/api/oianalytics/unregister`, null);
  }
}
