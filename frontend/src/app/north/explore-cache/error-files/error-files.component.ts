import { Component, OnInit, inject, viewChild, input } from '@angular/core';
import { TranslateDirective } from '@ngx-translate/core';
import { formDirectives } from '../../../shared/form-directives';
import { NorthConnectorService } from '../../../services/north-connector.service';
import { NorthCacheFiles, NorthConnectorDTO } from '../../../../../../backend/shared/model/north-connector.model';
import { PaginationComponent } from '../../../shared/pagination/pagination.component';
import { BoxComponent, BoxTitleDirective } from '../../../shared/box/box.component';
import { FileTableComponent, FileTableData, ItemActionEvent } from '../file-table/file-table.component';
import { emptyPage } from '../../../shared/test-utils';
import { ModalService } from '../../../shared/modal.service';
import { FileContentModalComponent } from '../file-content-modal/file-content-modal.component';
import { NorthSettings } from '../../../../../../backend/shared/model/north-settings.model';

@Component({
  selector: 'oib-error-files',
  templateUrl: './error-files.component.html',
  styleUrl: './error-files.component.scss',
  imports: [...formDirectives, TranslateDirective, PaginationComponent, BoxComponent, BoxTitleDirective, FileTableComponent]
})
export class ErrorFilesComponent implements OnInit {
  private northConnectorService = inject(NorthConnectorService);
  private modalService = inject(ModalService);

  readonly northConnector = input<NorthConnectorDTO<NorthSettings> | null>(null);
  errorFiles: Array<NorthCacheFiles> = [];
  readonly fileTable = viewChild<FileTableComponent>('fileTable');
  fileTablePages = emptyPage<FileTableData>();

  ngOnInit() {
    this.northConnectorService.getCacheErrorFiles(this.northConnector()!.id).subscribe(errorFiles => {
      this.errorFiles = errorFiles;
      this.refreshErrorFiles();
    });
  }

  /**
   * Retry error files.
   * By default, retry all checked files.
   */
  retryErrorFiles(files: Array<string> = this.getCheckedFiles()) {
    this.northConnectorService.retryCacheErrorFiles(this.northConnector()!.id, files).subscribe(() => {
      this.refreshErrorFiles();
    });
  }

  /**
   * Remove error files from cache.
   * By default, remove all checked files.
   */
  removeErrorFiles(files: Array<string> = this.getCheckedFiles()) {
    this.northConnectorService.removeCacheErrorFiles(this.northConnector()!.id, files).subscribe(() => {
      this.refreshErrorFiles();
    });
  }

  refreshErrorFiles() {
    this.northConnectorService.getCacheErrorFiles(this.northConnector()!.id).subscribe(errorFiles => {
      this.errorFiles = errorFiles;
      const fileTable = this.fileTable();
      if (fileTable) {
        fileTable.refreshTable(errorFiles);
        this.fileTablePages = fileTable.pages;
      }
    });
  }

  onItemAction(event: ItemActionEvent) {
    switch (event.type) {
      case 'remove':
        this.removeErrorFiles([event.file.filename]);
        break;
      case 'retry':
        this.retryErrorFiles([event.file.filename]);
        break;
      case 'view':
        this.northConnectorService.getCacheErrorFileContent(this.northConnector()!.id, event.file.filename).subscribe(async response => {
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
    return this.errorFiles.filter(file => this.fileTable()?.checkboxByFiles.get(file.filename)).map(file => file.filename);
  }
}
