import { Component, OnInit, inject, input, signal } from '@angular/core';
import { TranslateDirective } from '@ngx-translate/core';
import { formDirectives } from '../../../shared/form-directives';
import { NorthConnectorService } from '../../../services/north-connector.service';
import { NorthCacheFiles, NorthConnectorDTO } from '../../../../../../backend/shared/model/north-connector.model';
import { PaginationComponent } from '../../../shared/pagination/pagination.component';
import { BoxComponent, BoxTitleDirective } from '../../../shared/box/box.component';
import { emptyPage } from '../../../shared/test-utils';
import { FileTableComponent, FileTableData, ItemActionEvent } from '../file-table/file-table.component';
import { ModalService } from '../../../shared/modal.service';
import { FileContentModalComponent } from '../file-content-modal/file-content-modal.component';
import { NorthSettings } from '../../../../../../backend/shared/model/north-settings.model';

@Component({
  selector: 'oib-archive-files',
  templateUrl: './archive-files.component.html',
  styleUrl: './archive-files.component.scss',
  imports: [...formDirectives, TranslateDirective, PaginationComponent, BoxComponent, BoxTitleDirective, FileTableComponent]
})
export class ArchiveFilesComponent implements OnInit {
  private northConnectorService = inject(NorthConnectorService);
  private modalService = inject(ModalService);

  readonly northConnector = input<NorthConnectorDTO<NorthSettings> | null>(null);
  archiveFiles: Array<NorthCacheFiles> = [];
  readonly page = signal(0);
  fileTablePages = emptyPage<FileTableData>();
  readonly selectedFiles = signal<Array<FileTableData>>([]);

  ngOnInit() {
    this.northConnectorService.getCacheArchiveFiles(this.northConnector()!.id).subscribe(archiveFiles => {
      this.archiveFiles = archiveFiles;
      this.refreshArchiveFiles();
    });
  }

  /**
   * Retry archive files.
   * By default, retry all checked files.
   */
  retryArchiveFiles(files: Array<string> = this.getCheckedFiles()) {
    this.northConnectorService.retryCacheArchiveFiles(this.northConnector()!.id, files).subscribe(() => {
      this.refreshArchiveFiles();
    });
  }

  /**
   * Remove archive files.
   * By default, remove all checked files.
   */
  removeArchiveFiles(files: Array<string> = this.getCheckedFiles()) {
    this.northConnectorService.removeCacheArchiveFiles(this.northConnector()!.id, files).subscribe(() => {
      this.refreshArchiveFiles();
    });
  }

  refreshArchiveFiles() {
    this.northConnectorService.getCacheArchiveFiles(this.northConnector()!.id).subscribe(archiveFiles => {
      this.archiveFiles = archiveFiles;
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
        this.northConnectorService.getCacheArchiveFileContent(this.northConnector()!.id, event.file.filename).subscribe(async response => {
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
    return this.selectedFiles().map(file => file.filename);
  }
}
