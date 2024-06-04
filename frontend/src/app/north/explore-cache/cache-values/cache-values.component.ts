import { Component, Input, OnInit, ViewChild } from '@angular/core';
import { SaveButtonComponent } from '../../../shared/save-button/save-button.component';
import { TranslateModule } from '@ngx-translate/core';
import { formDirectives } from '../../../shared/form-directives';
import { NorthConnectorService } from '../../../services/north-connector.service';

import { NorthConnectorDTO, NorthValueFiles } from '../../../../../../shared/model/north-connector.model';
import { RouterLink } from '@angular/router';
import { DatetimePipe } from '../../../shared/datetime.pipe';
import { PaginationComponent } from '../../../shared/pagination/pagination.component';
import { FileSizePipe } from '../../../shared/file-size.pipe';
import { BoxComponent, BoxTitleDirective } from '../../../shared/box/box.component';
import { emptyPage } from '../../../shared/test-utils';
import { ValueTableComponent, ValueTableData } from '../value-table/value-table.component';

@Component({
  selector: 'oib-cache-values',
  templateUrl: './cache-values.component.html',
  styleUrl: './cache-values.component.scss',
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
    ValueTableComponent
  ],
  standalone: true
})
export class CacheValuesComponent implements OnInit {
  @Input() northConnector: NorthConnectorDTO | null = null;
  cacheValues: Array<NorthValueFiles> = [];
  @ViewChild('valueTable') valueTable!: ValueTableComponent;
  valueTablePages = emptyPage<ValueTableData>();

  constructor(private northConnectorService: NorthConnectorService) {}

  ngOnInit() {
    this.northConnectorService.getCacheValues(this.northConnector!.id).subscribe(cacheFiles => {
      this.cacheValues = cacheFiles;
      this.refreshCacheValues();
    });
  }

  removeCacheValues() {
    const files = this.cacheValues.filter(file => this.valueTable.checkboxByFiles.get(file.filename)).map(file => file.filename);
    this.northConnectorService.removeCacheValues(this.northConnector!.id, files).subscribe(() => {
      this.refreshCacheValues();
    });
  }

  refreshCacheValues() {
    this.northConnectorService.getCacheValues(this.northConnector!.id).subscribe(cacheFiles => {
      this.cacheValues = cacheFiles;
      if (this.valueTable) {
        this.valueTable.refreshTable(cacheFiles);
        this.valueTablePages = this.valueTable.pages;
      }
    });
  }
}
