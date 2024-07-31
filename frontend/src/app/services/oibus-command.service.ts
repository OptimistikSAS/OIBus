import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CommandSearchParam, OIBusCommand } from '../../../../shared/model/command.model';
import { Page } from '../../../../shared/model/types';

@Injectable({
  providedIn: 'root'
})
export class OibusCommandService {
  private http = inject(HttpClient);

  searchCommands(searchParams: CommandSearchParam): Observable<Page<OIBusCommand>> {
    const params: Record<string, string | Array<string>> = {
      page: `${searchParams.page || 0}`
    };
    if (searchParams.types) {
      params['types'] = searchParams.types;
    }
    if (searchParams.status) {
      params['status'] = searchParams.status;
    }
    return this.http.get<Page<OIBusCommand>>('/api/commands', {
      params: params
    });
  }
}
