import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Injectable } from '@angular/core';
import { ExternalSourceCommandDTO, ExternalSourceDTO } from '../../../../shared/model/external-sources.model';

/**
 * Service used to interact with the backend for CRUD operations on external sources
 */
@Injectable({
  providedIn: 'root'
})
export class ExternalSourceService {
  constructor(private http: HttpClient) {}

  /**
   * Get the external sources
   */
  getExternalSources(): Observable<Array<ExternalSourceDTO>> {
    return this.http.get<Array<ExternalSourceDTO>>(`/api/external-sources`);
  }

  /**
   * Get one external source
   * @param externalSourceId - the ID of the external source
   */
  getExternalSource(externalSourceId: string): Observable<ExternalSourceDTO> {
    return this.http.get<ExternalSourceDTO>(`/api/external-sources/${externalSourceId}`);
  }

  /**
   * Create a new external source
   * @param command - the new external source
   */
  createExternalSource(command: ExternalSourceCommandDTO): Observable<ExternalSourceDTO> {
    return this.http.post<ExternalSourceDTO>(`/api/external-sources`, command);
  }

  /**
   * Update the selected external source
   * @param externalSourceId - the ID of the external source
   * @param command - the new values of the selected external source
   */
  updateExternalSource(externalSourceId: string, command: ExternalSourceCommandDTO) {
    return this.http.put<void>(`/api/external-sources/${externalSourceId}`, command);
  }

  /**
   * Delete the selected external source
   * @param externalSourceId - the ID of the external source to delete
   */
  deleteExternalSource(externalSourceId: string) {
    return this.http.delete<void>(`/api/external-sources/${externalSourceId}`);
  }
}
