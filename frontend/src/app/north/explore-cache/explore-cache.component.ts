import { Component, OnInit, ViewChild } from '@angular/core';
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
import { CacheFilesComponent } from './cache-files/cache-files.component';
import { CacheValuesComponent } from './cache-values/cache-values.component';

@Component({
  selector: 'oib-explore-cache',
  templateUrl: './explore-cache.component.html',
  styleUrl: './explore-cache.component.scss',
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
    ArchiveFilesComponent,
    CacheFilesComponent,
    CacheValuesComponent
  ],
  standalone: true
})
export class ExploreCacheComponent implements OnInit {
  northConnector: NorthConnectorDTO | null = null;
  @ViewChild(ArchiveFilesComponent) archiveFilesComponent!: ArchiveFilesComponent;
  @ViewChild(ErrorFilesComponent) errorFilesComponent!: ErrorFilesComponent;
  @ViewChild(CacheFilesComponent) cacheFilesComponent!: CacheFilesComponent;

  @ViewChild(CacheValuesComponent) cacheValuesComponent!: CacheValuesComponent;

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
            return this.northConnectorService.get(paramNorthId);
          }
          return of(null);
        })
      )
      .subscribe(northConnector => {
        this.northConnector = northConnector;
      });
  }

  refreshCache() {
    this.errorFilesComponent.refreshErrorFiles();
    this.archiveFilesComponent.refreshArchiveFiles();
    this.cacheFilesComponent.refreshCacheFiles();

    this.cacheValuesComponent.refreshCacheValues();
  }
}
