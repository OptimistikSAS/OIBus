import { Component, Input, OnInit, inject, viewChild } from '@angular/core';
import { TranslateDirective } from '@ngx-translate/core';
import { formDirectives } from '../../../shared/form-directives';
import { NorthConnectorService } from '../../../services/north-connector.service';
import { NorthConnectorDTO, NorthCacheFiles } from '../../../../../../backend/shared/model/north-connector.model';
import { PaginationComponent } from '../../../shared/pagination/pagination.component';
import { BoxComponent, BoxTitleDirective } from '../../../shared/box/box.component';
import { emptyPage } from '../../../shared/test-utils';
import { NorthSettings } from '../../../../../../backend/shared/model/north-settings.model';
import { FileTableComponent, FileTableData } from '../file-table/file-table.component';

@Component({
  selector: 'oib-cache-values',
  templateUrl: './cache-values.component.html',
  styleUrl: './cache-values.component.scss',
  imports: [...formDirectives, TranslateDirective, PaginationComponent, BoxComponent, BoxTitleDirective, FileTableComponent]
})
export class CacheValuesComponent implements OnInit {
  private northConnectorService = inject(NorthConnectorService);

  @Input() northConnector: NorthConnectorDTO<NorthSettings> | null = null;
  cacheValues: Array<NorthCacheFiles> = [];
  readonly valueTable = viewChild.required<FileTableComponent>('valueTable');
  valueTablePages = emptyPage<FileTableData>();

  ngOnInit() {
    this.northConnectorService.getCacheValues(this.northConnector!.id).subscribe(cacheFiles => {
      this.cacheValues = cacheFiles;
      this.refreshCacheValues();
    });
  }

  removeCacheValues() {
    const files = this.cacheValues.filter(file => this.valueTable().checkboxByFiles.get(file.filename)).map(file => file.filename);
    this.northConnectorService.removeCacheValues(this.northConnector!.id, files).subscribe(() => {
      this.refreshCacheValues();
    });
  }

  refreshCacheValues() {
    this.northConnectorService.getCacheValues(this.northConnector!.id).subscribe(cacheFiles => {
      this.cacheValues = cacheFiles;
      const valueTable = this.valueTable();
      if (valueTable) {
        valueTable.refreshTable(cacheFiles);
        this.valueTablePages = valueTable.pages;
      }
    });
  }
}
