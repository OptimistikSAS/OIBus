import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ArrayExportImportService {
  private http = inject(HttpClient);

  exportArray(southId: string, arrayKey: string, delimiter: string): Observable<Blob> {
    return this.http.put(`/api/south/${southId}/array/${arrayKey}/export`, { delimiter, arrayKey }, { responseType: 'blob' });
  }

  checkImportArray(
    southId: string,
    arrayKey: string,
    file: File,
    delimiter: string
  ): Observable<{
    items: Array<Record<string, any>>;
    errors: Array<{ item: Record<string, string>; error: string }>;
  }> {
    const formData = new FormData();
    formData.set('file', file);
    formData.set('delimiter', delimiter);
    formData.set('arrayKey', arrayKey);

    return this.http.post<{
      items: Array<Record<string, any>>;
      errors: Array<{ item: Record<string, string>; error: string }>;
    }>(`/api/south/${southId}/array/${arrayKey}/check-import`, formData);
  }

  importArray(southId: string, arrayKey: string, items: Array<Record<string, any>>): Observable<void> {
    const formData = new FormData();
    formData.set('items', new Blob([JSON.stringify(items)], { type: 'application/json' }));
    formData.set('arrayKey', arrayKey);

    return this.http.post<void>(`/api/south/${southId}/array/${arrayKey}/import`, formData);
  }
}
