import { Component, Input, OnInit, ViewChild } from '@angular/core';
import { SaveButtonComponent } from '../../../shared/save-button/save-button.component';
import { TranslateModule } from '@ngx-translate/core';
import { formDirectives } from '../../../shared/form-directives';
import { NorthConnectorService } from '../../../services/north-connector.service';
import { NgForOf, NgIf } from '@angular/common';
import { NorthCacheFiles, NorthConnectorDTO } from '../../../../../../shared/model/north-connector.model';
import { RouterLink } from '@angular/router';
import { DatetimePipe } from '../../../shared/datetime.pipe';
import { PaginationComponent } from '../../../shared/pagination/pagination.component';
import { FileSizePipe } from '../../../shared/file-size.pipe';
import { BoxComponent, BoxTitleDirective } from '../../../shared/box/box.component';
import { emptyPage } from 'src/app/shared/test-utils';
import { FileTableComponent, FileTableData } from '../file-table/file-table.component';

@Component({
  selector: 'oib-cache-files',
  templateUrl: './cache-files.component.html',
  styleUrls: ['./cache-files.component.scss'],
  imports: [
    ...formDirectives,
    TranslateModule,
    SaveButtonComponent,
    NgForOf,
    DatetimePipe,
    NgIf,
    PaginationComponent,
    FileSizePipe,
    RouterLink,
    BoxComponent,
    BoxTitleDirective,
    FileTableComponent
  ],
  standalone: true
})
export class CacheFilesComponent implements OnInit {
  @Input() northConnector: NorthConnectorDTO | null = null;
  cacheFiles: Array<NorthCacheFiles> = [];
  @ViewChild('fileTable') fileTable!: FileTableComponent;
  fileTablePages = emptyPage<FileTableData>();

  constructor(private northConnectorService: NorthConnectorService) {}

  ngOnInit() {
    this.northConnectorService.getCacheFiles(this.northConnector!.id).subscribe(cacheFiles => {
      this.cacheFiles = cacheFiles;
      this.refreshCacheFiles();
    });
  }

  archiveCacheFiles() {
    const files = this.cacheFiles.filter(file => this.fileTable.checkboxByFiles.get(file.filename)).map(file => file.filename);
    this.northConnectorService.archiveCacheFiles(this.northConnector!.id, files).subscribe(() => {
      this.refreshCacheFiles();
    });
  }

  removeCacheFiles() {
    const files = this.cacheFiles.filter(file => this.fileTable.checkboxByFiles.get(file.filename)).map(file => file.filename);
    this.northConnectorService.removeCacheFiles(this.northConnector!.id, files).subscribe(() => {
      this.refreshCacheFiles();
    });
  }

  refreshCacheFiles() {
    this.northConnectorService.getCacheFiles(this.northConnector!.id).subscribe(cacheFiles => {
      this.cacheFiles = cacheFiles;
      if (this.fileTable) {
        this.fileTable.refreshTable(cacheFiles);
        this.fileTablePages = this.fileTable.pages;
      }
    });
  }
}
