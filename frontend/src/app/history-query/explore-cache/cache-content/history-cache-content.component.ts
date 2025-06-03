import { Component, inject, input, OnInit, output, signal } from '@angular/core';
import { TranslateDirective } from '@ngx-translate/core';
import { BoxComponent, BoxTitleDirective } from '../../../shared/box/box.component';
import { FileTableComponent } from '../../../shared/file-table/file-table.component';
import { FileContentModalComponent } from '../../../shared/file-content-modal/file-content-modal.component';
import { ModalService } from '../../../shared/modal.service';
import { NorthSettings } from '../../../../../../backend/shared/model/north-settings.model';
import { CacheMetadata } from '../../../../../../backend/shared/model/engine.model';
import { HistoryQueryDTO } from '../../../../../../backend/shared/model/history-query.model';
import { SouthItemSettings, SouthSettings } from '../../../../../../backend/shared/model/south-settings.model';
import { HistoryQueryService } from '../../../services/history-query.service';

@Component({
  selector: 'oib-history-cache-content',
  templateUrl: './history-cache-content.component.html',
  styleUrl: './history-cache-content.component.scss',
  imports: [TranslateDirective, BoxComponent, BoxTitleDirective, FileTableComponent]
})
export class HistoryCacheContentComponent implements OnInit {
  private historyQueryService = inject(HistoryQueryService);
  private modalService = inject(ModalService);

  readonly historyQuery = input.required<HistoryQueryDTO<SouthSettings, NorthSettings, SouthItemSettings>>();
  readonly cacheType = input.required<'cache' | 'error' | 'archive'>();
  readonly cacheUpdated = output();
  cacheContentFiles: Array<{ metadataFilename: string; metadata: CacheMetadata }> = [];
  readonly page = signal(0);
  readonly selectedFiles = signal<Array<{ metadataFilename: string; metadata: CacheMetadata }>>([]);

  ngOnInit() {
    this.refreshCacheFiles();
  }

  removeCacheContent(files: Array<string> = this.getCheckedFiles()) {
    this.historyQueryService.removeCacheContent(this.historyQuery()!.id, this.cacheType(), files).subscribe(() => {
      this.cacheUpdated.emit();
    });
  }

  moveCacheContent(destinationFolder: 'cache' | 'error' | 'archive', files: Array<string> = this.getCheckedFiles()) {
    this.historyQueryService.moveCacheContent(this.historyQuery()!.id, this.cacheType(), destinationFolder, files).subscribe(() => {
      this.cacheUpdated.emit();
    });
  }

  refreshCacheFiles() {
    this.historyQueryService
      .searchCacheContent(this.historyQuery().id, { start: null, end: null, nameContains: '' }, this.cacheType())
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
        this.historyQueryService
          .getCacheFileContent(this.historyQuery()!.id, this.cacheType(), event.file.metadata.contentFile)
          .subscribe(async response => {
            if (!response.body) return;
            const content = await response.body.text();

            const modalRef = this.modalService.open(FileContentModalComponent, { size: 'xl', backdrop: 'static' });
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
