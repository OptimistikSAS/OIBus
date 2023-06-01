import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Injectable } from '@angular/core';
import { ScanModeCommandDTO, ScanModeDTO } from '../../../../shared/model/scan-mode.model';

/**
 * Service used to interact with the backend for CRUD operations on Scan Modes
 */
@Injectable({
  providedIn: 'root'
})
export class ScanModeService {
  constructor(private http: HttpClient) {}

  /**
   * Get the scan modes
   */
  list(): Observable<Array<ScanModeDTO>> {
    return this.http.get<Array<ScanModeDTO>>(`/api/scan-modes`);
  }

  /**
   * Get one scan mode
   * @param scanModeId - the ID of the scan mode
   */
  get(scanModeId: string): Observable<ScanModeDTO> {
    return this.http.get<ScanModeDTO>(`/api/scan-modes/${scanModeId}`);
  }

  /**
   * Create a new scan mode
   * @param command - the new scan mode
   */
  create(command: ScanModeCommandDTO): Observable<ScanModeDTO> {
    return this.http.post<ScanModeDTO>(`/api/scan-modes`, command);
  }

  /**
   * Update the selected scan mode
   * @param scanModeId - the ID of the scan mode
   * @param command - the new values of the selected scan mode
   */
  update(scanModeId: string, command: ScanModeCommandDTO) {
    return this.http.put<void>(`/api/scan-modes/${scanModeId}`, command);
  }

  /**
   * Delete the selected scan mode
   * @param scanModeId - the ID of the scan mode to delete
   */
  delete(scanModeId: string) {
    return this.http.delete<void>(`/api/scan-modes/${scanModeId}`);
  }
}
