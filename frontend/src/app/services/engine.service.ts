import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Injectable } from '@angular/core';
import { EngineSettingsCommandDTO, EngineSettingsDTO } from '../model/engine.model';

/**
 * Service used to interact with the backend for CRUD operations on the engine settings
 */
@Injectable({
  providedIn: 'root'
})
export class EngineService {
  constructor(private http: HttpClient) {}

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
}
