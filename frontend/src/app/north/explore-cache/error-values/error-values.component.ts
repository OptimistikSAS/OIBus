import { Component, Input, OnInit, ViewChild, inject } from '@angular/core';
import { TranslateDirective } from '@ngx-translate/core';
import { formDirectives } from '../../../shared/form-directives';
import { NorthConnectorService } from '../../../services/north-connector.service';

import { NorthCacheFiles, NorthConnectorDTO } from '../../../../../../backend/shared/model/north-connector.model';
import { PaginationComponent } from '../../../shared/pagination/pagination.component';
import { BoxComponent, BoxTitleDirective } from '../../../shared/box/box.component';
import { FileTableComponent, FileTableData } from '../file-table/file-table.component';
import { emptyPage } from '../../../shared/test-utils';
import { NorthSettings } from '../../../../../../backend/shared/model/north-settings.model';

@Component({
  selector: 'oib-error-values',
  templateUrl: './error-values.component.html',
  styleUrl: './error-values.component.scss',
  imports: [...formDirectives, TranslateDirective, PaginationComponent, BoxComponent, BoxTitleDirective, FileTableComponent]
})
export class ErrorValuesComponent implements OnInit {
  private northConnectorService = inject(NorthConnectorService);

  @Input() northConnector: NorthConnectorDTO<NorthSettings> | null = null;
  errorValues: Array<NorthCacheFiles> = [];
  @ViewChild('fileTable') fileTable!: FileTableComponent;
  fileTablePages = emptyPage<FileTableData>();

  ngOnInit() {
    this.northConnectorService.getCacheErrorValues(this.northConnector!.id).subscribe(errorValues => {
      this.errorValues = errorValues;
      this.refreshErrorValues();
    });
  }

  retryErrorValues() {
    const files = this.errorValues.filter(file => this.fileTable.checkboxByFiles.get(file.filename)).map(file => file.filename);
    this.northConnectorService.retryCacheErrorValues(this.northConnector!.id, files).subscribe(() => {
      this.refreshErrorValues();
    });
  }

  removeErrorValues() {
    const files = this.errorValues.filter(file => this.fileTable.checkboxByFiles.get(file.filename)).map(file => file.filename);
    this.northConnectorService.removeCacheErrorValues(this.northConnector!.id, files).subscribe(() => {
      this.refreshErrorValues();
    });
  }

  refreshErrorValues() {
    this.northConnectorService.getCacheErrorValues(this.northConnector!.id).subscribe(errorValues => {
      this.errorValues = errorValues;
      if (this.fileTable) {
        this.fileTable.refreshTable(errorValues);
        this.fileTablePages = this.fileTable.pages;
      }
    });
  }
}
