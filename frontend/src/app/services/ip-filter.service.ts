import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Injectable, inject } from '@angular/core';
import { IPFilterCommandDTO, IPFilterDTO } from '../../../../shared/model/ip-filter.model';

/**
 * Service used to interact with the backend for CRUD operations on IP filters
 */
@Injectable({
  providedIn: 'root'
})
export class IpFilterService {
  private http = inject(HttpClient);

  /**
   * Get the IP filters
   */
  list(): Observable<Array<IPFilterDTO>> {
    return this.http.get<Array<IPFilterDTO>>(`/api/ip-filters`);
  }

  /**
   * Get one IP filter
   * @param ipFilterId - the ID of the IP filter
   */
  get(ipFilterId: string): Observable<IPFilterDTO> {
    return this.http.get<IPFilterDTO>(`/api/ip-filters/${ipFilterId}`);
  }

  /**
   * Create a new IP filter
   * @param command - the new IP filter
   */
  create(command: IPFilterCommandDTO): Observable<IPFilterDTO> {
    return this.http.post<IPFilterDTO>(`/api/ip-filters`, command);
  }

  /**
   * Update the selected IP filter
   * @param ipFilterId - the ID of the IP filter
   * @param command - the new values of the selected proxy
   */
  update(ipFilterId: string, command: IPFilterCommandDTO) {
    return this.http.put<void>(`/api/ip-filters/${ipFilterId}`, command);
  }

  /**
   * Delete the selected proxy
   * @param ipFilterId - the ID of the IP filter to delete
   */
  delete(ipFilterId: string) {
    return this.http.delete<void>(`/api/ip-filters/${ipFilterId}`);
  }
}
