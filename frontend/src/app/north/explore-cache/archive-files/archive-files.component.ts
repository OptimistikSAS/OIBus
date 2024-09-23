import { Component, Input, OnInit, ViewChild, inject } from '@angular/core';
import { SaveButtonComponent } from '../../../shared/save-button/save-button.component';
import { TranslateModule } from '@ngx-translate/core';
import { formDirectives } from '../../../shared/form-directives';
import { NorthConnectorService } from '../../../services/north-connector.service';

import { NorthCacheFiles, NorthConnectorDTO } from '../../../../../../shared/model/north-connector.model';
import { RouterLink } from '@angular/router';
import { DatetimePipe } from '../../../shared/datetime.pipe';
import { PaginationComponent } from '../../../shared/pagination/pagination.component';
import { FileSizePipe } from '../../../shared/file-size.pipe';
import { BoxComponent, BoxTitleDirective } from '../../../shared/box/box.component';
import { emptyPage } from '../../../shared/test-utils';
import { FileTableComponent, FileTableData, ItemActionEvent } from '../file-table/file-table.component';
import { ModalService } from '../../../shared/modal.service';
import { FileContentModalComponent } from '../file-content-modal/file-content-modal.component';
import { NorthSettings } from '../../../../../../shared/model/north-settings.model';

@Component({
  selector: 'oib-archive-files',
  templateUrl: './archive-files.component.html',
  styleUrl: './archive-files.component.scss',
  imports: [
    ...formDirectives,
    TranslateModule,
    SaveButtonComponent,
    DatetimePipe,
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
  private northConnectorService = inject(NorthConnectorService);
  private modalService = inject(ModalService);

  @Input() northConnector: NorthConnectorDTO<NorthSettings> | null = null;
  archiveFiles: Array<NorthCacheFiles> = [];
  @ViewChild('fileTable') fileTable!: FileTableComponent;
  fileTablePages = emptyPage<FileTableData>();

  ngOnInit() {
    this.northConnectorService.getCacheArchiveFiles(this.northConnector!.id).subscribe(archiveFiles => {
      this.archiveFiles = archiveFiles;
      this.refreshArchiveFiles();
    });
  }

  /**
   * Retry archive files.
   * By default, retry all checked files.
   */
  retryArchiveFiles(files: Array<string> = this.getCheckedFiles()) {
    this.northConnectorService.retryCacheArchiveFiles(this.northConnector!.id, files).subscribe(() => {
      this.refreshArchiveFiles();
    });
  }

  /**
   * Remove archive files.
   * By default, remove all checked files.
   */
  removeArchiveFiles(files: Array<string> = this.getCheckedFiles()) {
    this.northConnectorService.removeCacheArchiveFiles(this.northConnector!.id, files).subscribe(() => {
      this.refreshArchiveFiles();
    });
  }

  refreshArchiveFiles() {
    this.northConnectorService.getCacheArchiveFiles(this.northConnector!.id).subscribe(archiveFiles => {
      this.archiveFiles = archiveFiles;
      if (this.fileTable) {
        this.fileTable.refreshTable(archiveFiles);
        this.fileTablePages = this.fileTable.pages;
      }
    });
  }

  onItemAction(event: ItemActionEvent) {
    switch (event.type) {
      case 'remove':
        this.removeArchiveFiles([event.file.filename]);
        break;
      case 'retry':
        this.retryArchiveFiles([event.file.filename]);
        break;
      case 'view':
        this.northConnectorService.getCacheArchiveFileContent(this.northConnector!.id, event.file.filename).subscribe(async response => {
          if (!response.body) return;
          const content = await response.body.text();
          // Split header into content type and encoding
          const contentType = response.headers.get('content-type')?.split(';')[0] ?? '';
          // Get file type from content type. Additionally, remove 'x-' from the type.
          const fileType = contentType.split('/')[1].replace(/x-/g, '');

          const modalRef = this.modalService.open(FileContentModalComponent, { size: 'xl' });
          const component: FileContentModalComponent = modalRef.componentInstance;
          component.prepareForCreation(event.file.filename, fileType, content);
        });
        break;
    }
  }

  private getCheckedFiles(): Array<string> {
    return this.archiveFiles.filter(file => this.fileTable.checkboxByFiles.get(file.filename)).map(file => file.filename);
  }
}
