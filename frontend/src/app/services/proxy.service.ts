import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Injectable } from '@angular/core';
import { ProxyCommandDTO, ProxyDTO } from '../model/proxy.model';

/**
 * Service used to interact with the backend for CRUD operations on proxies
 */
@Injectable({
  providedIn: 'root'
})
export class ProxyService {
  constructor(private http: HttpClient) {}

  /**
   * Get the proxies
   */
  getProxies(): Observable<Array<ProxyDTO>> {
    return this.http.get<Array<ProxyDTO>>(`/api/proxies`);
  }

  /**
   * Get one proxy
   * @param proxyId - the ID of the proxy
   */
  getProxy(proxyId: string): Observable<ProxyDTO> {
    return this.http.get<ProxyDTO>(`/api/proxies/${proxyId}`);
  }

  /**
   * Create a new proxy
   * @param command - the new proxy
   */
  createProxy(command: ProxyCommandDTO): Observable<ProxyDTO> {
    return this.http.post<ProxyDTO>(`/api/proxies`, command);
  }

  /**
   * Update the selected proxy
   * @param proxyId - the ID of the proxy
   * @param command - the new values of the selected proxy
   */
  updateProxy(proxyId: string, command: ProxyCommandDTO) {
    return this.http.put<void>(`/api/proxies/${proxyId}`, command);
  }

  /**
   * Delete the selected proxy
   * @param proxyId - the ID of the proxy to delete
   */
  deleteProxy(proxyId: string) {
    return this.http.delete<void>(`/api/proxies/${proxyId}`);
  }
}
