import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, map, Observable, shareReplay, switchMap } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Service, inject } from '@angular/core';
import { CertificateCommandDTO, CertificateDTO, CertificateExportFormat } from '../../../../backend/shared/model/certificate.model';
import { DownloadService } from './download.service';

const ENDPOINT = '/api/certificates';

/**
 * Service used to interact with the backend for CRUD operations on Certificates
 */
@Service()
export class CertificateService {
  private http = inject(HttpClient);
  private downloadService = inject(DownloadService);

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

  /**
   * Import a certificate from a certificate file, a private key file and an optional CA chain file
   */
  importCertificate(
    command: { name: string; description: string; privateKeyPassphrase: string | null },
    files: { certificate: File; privateKey: File; certificateChain: File | null }
  ): Observable<CertificateDTO> {
    const formData = new FormData();
    formData.set('certificate', files.certificate);
    formData.set('privateKey', files.privateKey);
    if (files.certificateChain) {
      formData.set('certificateChain', files.certificateChain);
    }
    formData.set('name', command.name);
    formData.set('description', command.description);
    if (command.privateKeyPassphrase) {
      formData.set('privateKeyPassphrase', command.privateKeyPassphrase);
    }

    return this.http.post<CertificateDTO>(`${ENDPOINT}/import`, formData).pipe(tap(() => this.listTrigger$.next()));
  }

  /**
   * Export a certificate (and optionally its CA chain) in the given format
   */
  exportCertificate(certificateId: string, format: CertificateExportFormat, includeChain: boolean, filename: string): Observable<void> {
    const params = new HttpParams().set('format', format).set('includeChain', includeChain);

    return this.http
      .get(`${ENDPOINT}/${certificateId}/export`, { params, responseType: 'blob', observe: 'response' })
      .pipe(map(response => this.downloadService.download(response, filename)));
  }

  /**
   * Export the encrypted private key of a certificate
   */
  exportPrivateKey(certificateId: string, passphrase: string, filename: string): Observable<void> {
    return this.http
      .post(`${ENDPOINT}/${certificateId}/export/private-key`, { passphrase }, { responseType: 'blob', observe: 'response' })
      .pipe(map(response => this.downloadService.download(response, filename)));
  }
}
