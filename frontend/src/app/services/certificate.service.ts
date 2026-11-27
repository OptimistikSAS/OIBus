import { HttpClient, HttpParams, HttpStatusCode } from '@angular/common/http';
import { inject, Service, signal } from '@angular/core';

import { BehaviorSubject, map, Observable, shareReplay, switchMap } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

import { CertificateCommandDTO, CertificateDTO, CertificateExportFormat } from '@oibus/shared/api/certificate.model';

import { ignoreErrorIfStatusIs, rethrowServerMessage } from '../shared/error-interceptor.service';
import { DownloadService } from './download.service';

const ENDPOINT = '/api/certificates';

/**
 * Service used to interact with the backend for CRUD operations on Certificates
 */
@Service()
export class CertificateService {
  private readonly http = inject(HttpClient);
  private readonly downloadService = inject(DownloadService);

  private readonly listTrigger$ = new BehaviorSubject<void>(undefined);
  private readonly list$ = this.listTrigger$.pipe(
    switchMap(() => this.http.get<Array<CertificateDTO>>(ENDPOINT)),
    shareReplay(1)
  );
  private readonly createdCertificates = signal<Array<CertificateDTO>>([]);

  /**
   * The certificates created or imported since the application was loaded, until deleted: the lists loaded before do
   * not have them
   */
  readonly created = this.createdCertificates.asReadonly();

  /**
   * Get the certificates
   */
  list(): Observable<Array<CertificateDTO>> {
    return this.list$;
  }

  /**
   * Loads the certificates again, after a request which may have added one to the store: trusting the identity of a server
   * adds its certificate to the store
   */
  refreshList() {
    this.listTrigger$.next();
  }

  findById(certificateId: string): Observable<CertificateDTO> {
    return this.http.get<CertificateDTO>(`${ENDPOINT}/${certificateId}`);
  }

  create(command: CertificateCommandDTO): Observable<CertificateDTO> {
    return this.http.post<CertificateDTO>(`${ENDPOINT}`, command).pipe(tap(certificate => this.onCreated(certificate)));
  }

  update(certificateId: string, command: CertificateCommandDTO) {
    return this.http.put<void>(`${ENDPOINT}/${certificateId}`, command).pipe(
      tap(() => {
        this.createdCertificates.update(certificates =>
          certificates.map(certificate =>
            certificate.id === certificateId ? { ...certificate, name: command.name, description: command.description } : certificate
          )
        );
        this.listTrigger$.next();
      })
    );
  }

  delete(certificateId: string) {
    return this.http.delete<void>(`${ENDPOINT}/${certificateId}`).pipe(
      tap(() => {
        this.createdCertificates.update(certificates => certificates.filter(certificate => certificate.id !== certificateId));
        this.listTrigger$.next();
      })
    );
  }

  /**
   * Import a certificate from a certificate file, a private key file and an optional CA chain file
   */
  importCertificate(
    command: { name: string; description: string; privateKeyPassphrase: string | null },
    // Without private key, the certificate is imported as trusted (a certification authority, or the certificate of a server)
    files: { certificate: File; privateKey: File | null; certificateChain: File | null }
  ): Observable<CertificateDTO> {
    const formData = new FormData();
    formData.set('certificate', files.certificate);
    if (files.privateKey) {
      formData.set('privateKey', files.privateKey);
    }
    if (files.certificateChain) {
      formData.set('certificateChain', files.certificateChain);
    }
    formData.set('name', command.name);
    formData.set('description', command.description);
    if (command.privateKeyPassphrase) {
      formData.set('privateKeyPassphrase', command.privateKeyPassphrase);
    }

    const context = ignoreErrorIfStatusIs(HttpStatusCode.BadRequest, HttpStatusCode.NotFound);
    return this.http.post<CertificateDTO>(`${ENDPOINT}/import`, formData, { context }).pipe(
      tap(certificate => this.onCreated(certificate)),
      catchError(rethrowServerMessage)
    );
  }

  /**
   * Export a certificate (and optionally its CA chain) in the given format
   */
  exportCertificate(certificateId: string, format: CertificateExportFormat, includeChain: boolean, filename: string): Observable<void> {
    const params = new HttpParams().set('format', format).set('includeChain', includeChain);
    const context = ignoreErrorIfStatusIs(HttpStatusCode.BadRequest, HttpStatusCode.NotFound);

    return this.http.get(`${ENDPOINT}/${certificateId}/export`, { params, context, responseType: 'blob', observe: 'response' }).pipe(
      map(response => this.downloadService.download(response, filename)),
      catchError(rethrowServerMessage)
    );
  }

  /**
   * Export the encrypted private key of a certificate
   */
  exportPrivateKey(certificateId: string, passphrase: string, filename: string): Observable<void> {
    const context = ignoreErrorIfStatusIs(HttpStatusCode.BadRequest, HttpStatusCode.NotFound);
    return this.http
      .post(`${ENDPOINT}/${certificateId}/export/private-key`, { passphrase }, { context, responseType: 'blob', observe: 'response' })
      .pipe(
        map(response => this.downloadService.download(response, filename)),
        catchError(rethrowServerMessage)
      );
  }

  private onCreated(certificate: CertificateDTO) {
    this.createdCertificates.update(certificates => [...certificates, certificate]);
    this.listTrigger$.next();
  }
}
