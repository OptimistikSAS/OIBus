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
  selector: 'oib-archive-files',
  templateUrl: './archive-files.component.html',
  styleUrls: ['./archive-files.component.scss'],
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
export class ArchiveFilesComponent implements OnInit {
  @Input() northConnector: NorthConnectorDTO | null = null;
  archiveFiles: Array<NorthCacheFiles> = [];
  @ViewChild('fileTable') fileTable!: FileTableComponent;
  fileTablePages = emptyPage<FileTableData>();

  constructor(private northConnectorService: NorthConnectorService) {}

  ngOnInit() {
    this.northConnectorService.getNorthConnectorCacheArchiveFiles(this.northConnector!.id).subscribe(archiveFiles => {
      this.archiveFiles = archiveFiles;
      this.refreshArchiveFiles();
    });
  }

  retryArchiveFiles() {
    const files = this.archiveFiles.filter(file => this.fileTable.checkboxByFiles.get(file.filename)).map(file => file.filename);
    this.northConnectorService.retryNorthConnectorCacheArchiveFiles(this.northConnector!.id, files).subscribe(() => {
      this.refreshArchiveFiles();
    });
  }

  removeArchiveFiles() {
    const files = this.archiveFiles.filter(file => this.fileTable.checkboxByFiles.get(file.filename)).map(file => file.filename);
    this.northConnectorService.removeNorthConnectorCacheArchiveFiles(this.northConnector!.id, files).subscribe(() => {
      this.refreshArchiveFiles();
    });
  }

  refreshArchiveFiles() {
    this.northConnectorService.getNorthConnectorCacheArchiveFiles(this.northConnector!.id).subscribe(archiveFiles => {
      this.archiveFiles = archiveFiles;
      this.fileTable.refreshTable(archiveFiles);
      this.fileTablePages = this.fileTable.pages;
    });
  }
}
