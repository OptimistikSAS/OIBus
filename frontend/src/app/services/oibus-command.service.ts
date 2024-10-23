import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CommandSearchParam, OIBusCommandDTO } from '../../../../backend/shared/model/command.model';
import { Page } from '../../../../backend/shared/model/types';

@Injectable({
  providedIn: 'root'
})
export class OibusCommandService {
  private http = inject(HttpClient);

  searchCommands(searchParams: CommandSearchParam): Observable<Page<OIBusCommandDTO>> {
    const params: Record<string, string | Array<string>> = {
      page: `${searchParams.page || 0}`
    };
    if (searchParams.types) {
      params['types'] = searchParams.types;
    }
    if (searchParams.status) {
      params['status'] = searchParams.status;
    }
    return this.http.get<Page<OIBusCommandDTO>>('/api/commands', {
      params: params
    });
  }
}
