import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Injectable } from '@angular/core';
import { IpFilterCommandDTO, IpFilterDTO } from '../model/ip-filter.model';

/**
 * Service used to interact with the backend for CRUD operations on IP filters
 */
@Injectable({
  providedIn: 'root'
})
export class IpFilterService {
  constructor(private http: HttpClient) {}

  /**
   * Get the IP filters
   */
  getIpFilters(): Observable<Array<IpFilterDTO>> {
    return this.http.get<Array<IpFilterDTO>>(`/api/ip-filters`);
  }

  /**
   * Get one IP filter
   * @param ipFilterId - the ID of the IP filter
   */
  getIpFilter(ipFilterId: string): Observable<IpFilterDTO> {
    return this.http.get<IpFilterDTO>(`/api/ip-filters/${ipFilterId}`);
  }

  /**
   * Create a new IP filter
   * @param command - the new IP filter
   */
  createIpFilter(command: IpFilterCommandDTO): Observable<IpFilterDTO> {
    return this.http.post<IpFilterDTO>(`/api/ip-filters`, command);
  }

  /**
   * Update the selected IP filter
   * @param ipFilterId - the ID of the IP filter
   * @param command - the new values of the selected proxy
   */
  updateIpFilter(ipFilterId: string, command: IpFilterCommandDTO) {
    return this.http.put<void>(`/api/ip-filters/${ipFilterId}`, command);
  }

  /**
   * Delete the selected proxy
   * @param ipFilterId - the ID of the IP filter to delete
   */
  deleteIpFilter(ipFilterId: string) {
    return this.http.delete<void>(`/api/ip-filters/${ipFilterId}`);
  }
}
