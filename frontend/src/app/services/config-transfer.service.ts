import { HttpClient, HttpStatusCode } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Service, inject } from '@angular/core';
import { ConfigImportResponseDTO } from '../../../../backend/shared/model/config-transfer.model';
import { DownloadService } from './download.service';
import { ignoreErrorIfStatusIs, rethrowServerMessage } from '../shared/error-interceptor.service';

const ENDPOINT = '/api/config-transfer';

/**
 * Service used to export and import a full, secret-free snapshot of the OIBus configuration
 */
@Service()
export class ConfigTransferService {
  private http = inject(HttpClient);
  private downloadService = inject(DownloadService);

  /**
   * Export the full OIBus configuration as a downloadable, secret-free, version-stamped JSON file
   */
  export(filename = 'oibus-config-export.json'): Observable<void> {
    const context = ignoreErrorIfStatusIs(HttpStatusCode.BadRequest, HttpStatusCode.NotFound);

    return this.http.get(`${ENDPOINT}/export`, { context, responseType: 'blob', observe: 'response' }).pipe(
      map(response => this.downloadService.download(response, filename)),
      catchError(rethrowServerMessage)
    );
  }

  /**
   * Import a previously exported configuration file, transactionally wiping and recreating every
   * in-scope section of the local configuration
   */
  import(file: File): Observable<ConfigImportResponseDTO> {
    const formData = new FormData();
    formData.set('file', file);

    const context = ignoreErrorIfStatusIs(HttpStatusCode.BadRequest, HttpStatusCode.NotFound);
    return this.http.post<ConfigImportResponseDTO>(`${ENDPOINT}/import`, formData, { context }).pipe(catchError(rethrowServerMessage));
  }
}
