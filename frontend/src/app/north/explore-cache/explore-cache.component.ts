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
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { BackNavigationDirective } from '../../shared/back-navigation.directives';
import { FileSizePipe } from '../../shared/file-size.pipe';
import { ErrorFilesComponent } from './error-files/error-files.component';
import { ArchiveFilesComponent } from './archive-files/archive-files.component';

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
    NgIf,
    PaginationComponent,
    BackNavigationDirective,
    FileSizePipe,
    RouterLink,
    ErrorFilesComponent,
    ArchiveFilesComponent
  ],
  standalone: true
})
export class ExploreCacheComponent implements OnInit {
  northConnector: NorthConnectorDTO | null = null;

  constructor(
    private route: ActivatedRoute,
    private northConnectorService: NorthConnectorService
  ) {}

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
