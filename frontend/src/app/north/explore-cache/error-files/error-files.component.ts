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
import { FileTableComponent, FileTableData } from '../file-table/file-table.component';
import { emptyPage } from 'src/app/shared/test-utils';

@Component({
  selector: 'oib-error-files',
  templateUrl: './error-files.component.html',
  styleUrls: ['./error-files.component.scss'],
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
export class ErrorFilesComponent implements OnInit {
  @Input() northConnector: NorthConnectorDTO | null = null;
  errorFiles: Array<NorthCacheFiles> = [];
  @ViewChild('fileTable') fileTable!: FileTableComponent;
  fileTablePages = emptyPage<FileTableData>();

  constructor(private northConnectorService: NorthConnectorService) {}

  ngOnInit() {
    this.northConnectorService.getNorthConnectorCacheErrorFiles(this.northConnector!.id).subscribe(errorFiles => {
      this.errorFiles = errorFiles;
      this.refreshErrorFiles();
    });
  }

  retryErrorFiles() {
    const files = this.errorFiles.filter(file => this.fileTable.checkboxByFiles.get(file.filename)).map(file => file.filename);
    this.northConnectorService.retryNorthConnectorCacheErrorFiles(this.northConnector!.id, files).subscribe(() => {
      this.refreshErrorFiles();
    });
  }

  removeErrorFiles() {
    const files = this.errorFiles.filter(file => this.fileTable.checkboxByFiles.get(file.filename)).map(file => file.filename);
    this.northConnectorService.removeNorthConnectorCacheErrorFiles(this.northConnector!.id, files).subscribe(() => {
      this.refreshErrorFiles();
    });
  }

  refreshErrorFiles() {
    this.northConnectorService.getNorthConnectorCacheErrorFiles(this.northConnector!.id).subscribe(errorFiles => {
      this.errorFiles = errorFiles;
      if (this.fileTable) {
        this.fileTable.refreshTable(errorFiles);
        this.fileTablePages = this.fileTable.pages;
      }
    });
  }
}
