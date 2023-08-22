import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Injectable } from '@angular/core';
import { CertificateCommandDTO, CertificateDTO } from '../../../../shared/model/certificate.model';

const ENDPOINT = '/api/certificates';

/**
 * Service used to interact with the backend for CRUD operations on Certificates
 */
@Injectable({
  providedIn: 'root'
})
export class CertificateService {
  constructor(private http: HttpClient) {}

  /**
   * Get the scan modes
   */
  list(): Observable<Array<CertificateDTO>> {
    return this.http.get<Array<CertificateDTO>>(ENDPOINT);
  }

  findById(certificateId: string): Observable<CertificateDTO> {
    return this.http.get<CertificateDTO>(`${ENDPOINT}/${certificateId}`);
  }

  create(command: CertificateCommandDTO): Observable<CertificateDTO> {
    return this.http.post<CertificateDTO>(`${ENDPOINT}`, command);
  }

  update(certificateId: string, command: CertificateCommandDTO) {
    return this.http.put<void>(`${ENDPOINT}/${certificateId}`, command);
  }

  delete(certificateId: string) {
    return this.http.delete<void>(`${ENDPOINT}/${certificateId}`);
  }
}
