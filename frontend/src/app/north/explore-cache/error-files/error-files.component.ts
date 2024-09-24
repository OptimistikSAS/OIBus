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
import { FileTableComponent, FileTableData, ItemActionEvent } from '../file-table/file-table.component';
import { emptyPage } from '../../../shared/test-utils';
import { ModalService } from '../../../shared/modal.service';
import { FileContentModalComponent } from '../file-content-modal/file-content-modal.component';

@Component({
  selector: 'oib-error-files',
  templateUrl: './error-files.component.html',
  styleUrl: './error-files.component.scss',
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
export class ErrorFilesComponent implements OnInit {
  private northConnectorService = inject(NorthConnectorService);
  private modalService = inject(ModalService);

  @Input() northConnector: NorthConnectorDTO | null = null;
  errorFiles: Array<NorthCacheFiles> = [];
  @ViewChild('fileTable') fileTable!: FileTableComponent;
  fileTablePages = emptyPage<FileTableData>();

  ngOnInit() {
    this.northConnectorService.getCacheErrorFiles(this.northConnector!.id).subscribe(errorFiles => {
      this.errorFiles = errorFiles;
      this.refreshErrorFiles();
    });
  }

  /**
   * Retry error files.
   * By default, retry all checked files.
   */
  retryErrorFiles(files: Array<string> = this.getCheckedFiles()) {
    this.northConnectorService.retryCacheErrorFiles(this.northConnector!.id, files).subscribe(() => {
      this.refreshErrorFiles();
    });
  }

  /**
   * Remove error files from cache.
   * By default, remove all checked files.
   */
  removeErrorFiles(files: Array<string> = this.getCheckedFiles()) {
    this.northConnectorService.removeCacheErrorFiles(this.northConnector!.id, files).subscribe(() => {
      this.refreshErrorFiles();
    });
  }

  refreshErrorFiles() {
    this.northConnectorService.getCacheErrorFiles(this.northConnector!.id).subscribe(errorFiles => {
      this.errorFiles = errorFiles;
      if (this.fileTable) {
        this.fileTable.refreshTable(errorFiles);
        this.fileTablePages = this.fileTable.pages;
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
        this.northConnectorService.getCacheErrorFileContent(this.northConnector!.id, event.file.filename).subscribe(async response => {
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
    return this.errorFiles.filter(file => this.fileTable.checkboxByFiles.get(file.filename)).map(file => file.filename);
  }
}
