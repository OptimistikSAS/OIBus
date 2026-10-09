import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';

import { Observable } from 'rxjs';

import { Page } from '@oibus/shared/common/types';
import { CommandSearchParam, OIBusCommandDTO } from '@oibus/shared/oia/command.model';

@Service()
export class OibusCommandService {
  private readonly http = inject(HttpClient);

  search(searchParams: CommandSearchParam): Observable<Page<OIBusCommandDTO>> {
    const params: Record<string, string | Array<string>> = {
      page: `${searchParams.page || 0}`
    };
    if (searchParams.types) {
      params['types'] = searchParams.types;
    }
    if (searchParams.status) {
      params['status'] = searchParams.status;
    }
    return this.http.get<Page<OIBusCommandDTO>>('/api/oianalytics/commands/search', {
      params: params
    });
  }

  delete(command: OIBusCommandDTO): Observable<void> {
    return this.http.delete<void>(`/api/oianalytics/commands/${command.id}`);
  }
}
