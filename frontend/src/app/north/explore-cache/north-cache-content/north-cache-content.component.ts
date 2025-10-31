import { Component, inject, input, OnInit, output, signal } from '@angular/core';
import { TranslateDirective } from '@ngx-translate/core';
import { NorthConnectorService } from '../../../services/north-connector.service';
import { NorthConnectorDTO } from '../../../../../../backend/shared/model/north-connector.model';
import { BoxComponent, BoxTitleDirective } from '../../../shared/box/box.component';
import { FileTableComponent } from '../../../shared/file-table/file-table.component';
import { FileContentModalComponent } from '../../../shared/file-content-modal/file-content-modal.component';
import { ModalService } from '../../../shared/modal.service';
import { NorthSettings } from '../../../../../../backend/shared/model/north-settings.model';
import { CacheMetadata } from '../../../../../../backend/shared/model/engine.model';

@Component({
  selector: 'oib-north-cache-content',
  templateUrl: './north-cache-content.component.html',
  styleUrl: './north-cache-content.component.scss',
  imports: [TranslateDirective, BoxComponent, BoxTitleDirective, FileTableComponent]
})
export class NorthCacheContentComponent implements OnInit {
  private northConnectorService = inject(NorthConnectorService);
  private modalService = inject(ModalService);

  readonly northConnector = input.required<NorthConnectorDTO<NorthSettings>>();
  readonly cacheType = input.required<'cache' | 'error' | 'archive'>();
  readonly cacheUpdated = output();
  cacheContentFiles: Array<{ metadataFilename: string; metadata: CacheMetadata }> = [];
  readonly page = signal(0);
  readonly selectedFiles = signal<Array<{ metadataFilename: string; metadata: CacheMetadata }>>([]);
  readonly isActionRunning = signal(false);

  ngOnInit() {
    this.refreshCacheFiles();
  }

  removeCacheContent(files: Array<string> = this.getCheckedFiles()) {
    this.isActionRunning.set(true);
    this.northConnectorService.removeCacheContent(this.northConnector().id, this.cacheType(), files).subscribe(() => {
      this.isActionRunning.set(false);
      this.cacheUpdated.emit();
    });
  }

  moveCacheContent(destinationFolder: 'cache' | 'error' | 'archive', files: Array<string> = this.getCheckedFiles()) {
    this.isActionRunning.set(true);
    this.northConnectorService.moveCacheContent(this.northConnector().id, this.cacheType(), destinationFolder, files).subscribe(() => {
      this.isActionRunning.set(false);
      this.cacheUpdated.emit();
    });
  }

  refreshCacheFiles() {
    this.northConnectorService
      .searchCacheContent(this.northConnector().id, { start: undefined, end: undefined, nameContains: undefined }, this.cacheType())
      .subscribe(cacheFiles => {
        this.cacheContentFiles = cacheFiles;
      });
  }

  onItemAction(event: {
    type: 'remove' | 'error' | 'archive' | 'retry' | 'view';
    file: { metadataFilename: string; metadata: CacheMetadata };
  }) {
    switch (event.type) {
      case 'remove':
        this.removeCacheContent([event.file.metadataFilename]);
        break;
      case 'archive':
        this.moveCacheContent('archive', [event.file.metadataFilename]);
        break;
      case 'error':
        this.moveCacheContent('error', [event.file.metadataFilename]);
        break;
      case 'retry':
        this.moveCacheContent('cache', [event.file.metadataFilename]);
        break;
      case 'view':
        this.northConnectorService
          .getCacheFileContent(this.northConnector()!.id, this.cacheType(), event.file.metadata.contentFile)
          .subscribe(async response => {
            if (!response.body) return;
            const content = await response.body.text();

            const modalRef = this.modalService.open(FileContentModalComponent, { size: 'xl' });
            const component: FileContentModalComponent = modalRef.componentInstance;
            component.prepareForCreation(event.file, content);
          });
        break;
    }
  }

  private getCheckedFiles(): Array<string> {
    return this.selectedFiles().map(file => file.metadataFilename);
  }
}
