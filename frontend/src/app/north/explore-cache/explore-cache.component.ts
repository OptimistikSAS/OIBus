import { Component, OnInit } from '@angular/core';
import { SaveButtonComponent } from '../../shared/save-button/save-button.component';
import { TranslateModule } from '@ngx-translate/core';
import { formDirectives } from '../../shared/form-directives';
import { NorthConnectorService } from '../../services/north-connector.service';
import { NgForOf, NgIf } from '@angular/common';
import { NorthConnectorDTO } from '../../../../../shared/model/north-connector.model';
import { of, switchMap } from 'rxjs';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatetimePipe } from '../../shared/datetime.pipe';
import { LogLevelsEnumPipe } from '../../shared/log-levels-enum.pipe';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { FileSizePipe } from '../../shared/file-size.pipe';
import { SubNavbarComponent } from '../sub-navbar/sub-navbar.component';
import { ErrorFilesComponent } from './error-files/error-files.component';

@Component({
  selector: 'oib-explore-cache',
  templateUrl: './explore-cache.component.html',
  styleUrls: ['./explore-cache.component.scss'],
  imports: [
    ...formDirectives,
    TranslateModule,
    SaveButtonComponent,
    NgForOf,
    DatetimePipe,
    LogLevelsEnumPipe,
    NgIf,
    PaginationComponent,
    FileSizePipe,
    SubNavbarComponent,
    RouterLink,
    ErrorFilesComponent
  ],
  standalone: true
})
export class ExploreCacheComponent implements OnInit {
  northConnector: NorthConnectorDTO | null = null;

  constructor(private route: ActivatedRoute, private northConnectorService: NorthConnectorService) {}

  ngOnInit() {
    this.route.paramMap
      .pipe(
        switchMap(params => {
          const paramNorthId = params.get('northId');
          if (paramNorthId) {
            return this.northConnectorService.getNorthConnector(paramNorthId);
          }
          return of(null);
        })
      )
      .subscribe(northConnector => {
        this.northConnector = northConnector;
      });
  }
}
