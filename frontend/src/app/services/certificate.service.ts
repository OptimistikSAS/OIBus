import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, shareReplay, switchMap } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Injectable, inject } from '@angular/core';
import { CertificateCommandDTO, CertificateDTO } from '../../../../backend/shared/model/certificate.model';

const ENDPOINT = '/api/certificates';

/**
 * Service used to interact with the backend for CRUD operations on Certificates
 */
@Injectable({
  providedIn: 'root'
})
export class CertificateService {
  private http = inject(HttpClient);

  private listTrigger$ = new BehaviorSubject<void>(undefined);
  private list$ = this.listTrigger$.pipe(
    switchMap(() => this.http.get<Array<CertificateDTO>>(ENDPOINT)),
    shareReplay(1)
  );

  /**
   * Get the certificates
   */
  list(): Observable<Array<CertificateDTO>> {
    return this.list$;
  }

  findById(certificateId: string): Observable<CertificateDTO> {
    return this.http.get<CertificateDTO>(`${ENDPOINT}/${certificateId}`);
  }

  create(command: CertificateCommandDTO): Observable<CertificateDTO> {
    return this.http.post<CertificateDTO>(`${ENDPOINT}`, command).pipe(tap(() => this.listTrigger$.next()));
  }

  update(certificateId: string, command: CertificateCommandDTO) {
    return this.http.put<void>(`${ENDPOINT}/${certificateId}`, command).pipe(tap(() => this.listTrigger$.next()));
  }

  delete(certificateId: string) {
    return this.http.delete<void>(`${ENDPOINT}/${certificateId}`).pipe(tap(() => this.listTrigger$.next()));
  }
}
