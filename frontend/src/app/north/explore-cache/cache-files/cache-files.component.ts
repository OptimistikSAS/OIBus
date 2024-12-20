import { Component, OnInit, inject, viewChild, input } from '@angular/core';
import { TranslateDirective } from '@ngx-translate/core';
import { formDirectives } from '../../../shared/form-directives';
import { NorthConnectorService } from '../../../services/north-connector.service';
import { NorthCacheFiles, NorthConnectorDTO } from '../../../../../../backend/shared/model/north-connector.model';
import { PaginationComponent } from '../../../shared/pagination/pagination.component';
import { BoxComponent, BoxTitleDirective } from '../../../shared/box/box.component';
import { emptyPage } from '../../../shared/test-utils';
import { FileTableComponent, FileTableData, ItemActionEvent } from '../file-table/file-table.component';
import { FileContentModalComponent } from '../file-content-modal/file-content-modal.component';
import { ModalService } from '../../../shared/modal.service';
import { NorthSettings } from '../../../../../../backend/shared/model/north-settings.model';

@Component({
  selector: 'oib-cache-files',
  templateUrl: './cache-files.component.html',
  styleUrl: './cache-files.component.scss',
  imports: [...formDirectives, TranslateDirective, PaginationComponent, BoxComponent, BoxTitleDirective, FileTableComponent]
})
export class CacheFilesComponent implements OnInit {
  private northConnectorService = inject(NorthConnectorService);
  private modalService = inject(ModalService);

  readonly northConnector = input<NorthConnectorDTO<NorthSettings> | null>(null);
  cacheFiles: Array<NorthCacheFiles> = [];
  readonly fileTable = viewChild<FileTableComponent>('fileTable');
  fileTablePages = emptyPage<FileTableData>();

  ngOnInit() {
    this.northConnectorService.getCacheFiles(this.northConnector()!.id).subscribe(cacheFiles => {
      this.cacheFiles = cacheFiles;
      this.refreshCacheFiles();
    });
  }

  /**
   * Archive cache files.
   * By default, retry all checked files.
   */
  archiveCacheFiles(files: Array<string> = this.getCheckedFiles()) {
    this.northConnectorService.archiveCacheFiles(this.northConnector()!.id, files).subscribe(() => {
      this.refreshCacheFiles();
    });
  }

  /**
   * Remove cache files.
   * By default, remove all checked files.
   */
  removeCacheFiles(files: Array<string> = this.getCheckedFiles()) {
    this.northConnectorService.removeCacheFiles(this.northConnector()!.id, files).subscribe(() => {
      this.refreshCacheFiles();
    });
  }

  refreshCacheFiles() {
    this.northConnectorService.getCacheFiles(this.northConnector()!.id).subscribe(cacheFiles => {
      this.cacheFiles = cacheFiles;
      const fileTable = this.fileTable();
      if (fileTable) {
        fileTable.refreshTable(cacheFiles);
        this.fileTablePages = fileTable.pages;
      }
    });
  }

  onItemAction(event: ItemActionEvent) {
    switch (event.type) {
      case 'remove':
        this.removeCacheFiles([event.file.filename]);
        break;
      case 'archive':
        this.archiveCacheFiles([event.file.filename]);
        break;
      case 'view':
        this.northConnectorService.getCacheFileContent(this.northConnector()!.id, event.file.filename).subscribe(async response => {
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
    return this.cacheFiles.filter(file => this.fileTable()?.checkboxByFiles.get(file.filename)).map(file => file.filename);
  }
}
