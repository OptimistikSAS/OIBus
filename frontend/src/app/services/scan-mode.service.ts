import { HttpClient } from '@angular/common/http';
import { inject, Service, signal } from '@angular/core';

import { BehaviorSubject, Observable, shareReplay, switchMap } from 'rxjs';
import { tap } from 'rxjs/operators';

import { ScanModeCommandDTO, ScanModeDTO, ValidatedCronExpression } from '@oibus/shared/api/scan-mode.model';

/**
 * Service used to interact with the backend for CRUD operations on Scan Modes
 */
@Service()
export class ScanModeService {
  private readonly http = inject(HttpClient);

  private readonly listTrigger$ = new BehaviorSubject<void>(undefined);
  private readonly list$ = this.listTrigger$.pipe(
    switchMap(() => this.http.get<Array<ScanModeDTO>>(`/api/scan-modes`)),
    shareReplay(1)
  );
  private readonly createdScanModes = signal<Array<ScanModeDTO>>([]);

  /**
   * The scan modes created since the application was loaded, until deleted: the lists loaded before do not have them
   */
  readonly created = this.createdScanModes.asReadonly();

  /**
   * Get the scan modes
   */
  list(): Observable<Array<ScanModeDTO>> {
    return this.list$;
  }

  /**
   * Get one scan mode
   * @param scanModeId - the ID of the scan mode
   */
  findById(scanModeId: string): Observable<ScanModeDTO> {
    return this.http.get<ScanModeDTO>(`/api/scan-modes/${scanModeId}`);
  }

  /**
   * Create a new scan mode
   * @param command - the new scan mode
   */
  create(command: ScanModeCommandDTO): Observable<ScanModeDTO> {
    return this.http.post<ScanModeDTO>(`/api/scan-modes`, command).pipe(
      tap(scanMode => {
        this.createdScanModes.update(scanModes => [...scanModes, scanMode]);
        this.listTrigger$.next();
      })
    );
  }

  /**
   * Update the selected scan mode
   * @param scanModeId - the ID of the scan mode
   * @param command - the new values of the selected scan mode
   */
  update(scanModeId: string, command: ScanModeCommandDTO) {
    return this.http.put<void>(`/api/scan-modes/${scanModeId}`, command).pipe(
      tap(() => {
        this.createdScanModes.update(scanModes =>
          scanModes.map(scanMode =>
            scanMode.id === scanModeId ? { ...scanMode, name: command.name, description: command.description } : scanMode
          )
        );
        this.listTrigger$.next();
      })
    );
  }

  /**
   * Delete the selected scan mode
   * @param scanModeId - the ID of the scan mode to delete
   */
  delete(scanModeId: string) {
    return this.http.delete<void>(`/api/scan-modes/${scanModeId}`).pipe(
      tap(() => {
        this.createdScanModes.update(scanModes => scanModes.filter(scanMode => scanMode.id !== scanModeId));
        this.listTrigger$.next();
      })
    );
  }

  /**
   * Verify the cron expression
   * @param cron - the cron expression to verify
   */
  verifyCron(cron: string): Observable<ValidatedCronExpression> {
    return this.http.post<ValidatedCronExpression>(`/api/scan-modes/verify`, { cron });
  }
}
