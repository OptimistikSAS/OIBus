import { Component, OnInit, inject, input, signal } from '@angular/core';
import { TranslateDirective } from '@ngx-translate/core';
import { formDirectives } from '../../../shared/form-directives';
import { NorthConnectorService } from '../../../services/north-connector.service';

import { NorthCacheFiles, NorthConnectorDTO } from '../../../../../../backend/shared/model/north-connector.model';
import { PaginationComponent } from '../../../shared/pagination/pagination.component';
import { BoxComponent, BoxTitleDirective } from '../../../shared/box/box.component';
import { FileTableComponent, FileTableData } from '../file-table/file-table.component';
import { emptyPage } from '../../../shared/test-utils';
import { NorthItemSettings, NorthSettings } from '../../../../../../backend/shared/model/north-settings.model';

@Component({
  selector: 'oib-error-values',
  templateUrl: './error-values.component.html',
  styleUrl: './error-values.component.scss',
  imports: [...formDirectives, TranslateDirective, PaginationComponent, BoxComponent, BoxTitleDirective, FileTableComponent]
})
export class ErrorValuesComponent implements OnInit {
  private northConnectorService = inject(NorthConnectorService);

  readonly northConnector = input<NorthConnectorDTO<NorthSettings, NorthItemSettings> | null>(null);
  errorValues: Array<NorthCacheFiles> = [];
  fileTablePages = emptyPage<FileTableData>();
  readonly page = signal(0);
  readonly selectedFiles = signal<Array<FileTableData>>([]);

  ngOnInit() {
    this.northConnectorService.getCacheErrorValues(this.northConnector()!.id).subscribe(errorValues => {
      this.errorValues = errorValues;
      this.refreshErrorValues();
    });
  }

  retryErrorValues() {
    const files = this.selectedFiles().map(file => file.filename);
    this.northConnectorService.retryCacheErrorValues(this.northConnector()!.id, files).subscribe(() => {
      this.refreshErrorValues();
    });
  }

  removeErrorValues() {
    const files = this.selectedFiles().map(file => file.filename);
    this.northConnectorService.removeCacheErrorValues(this.northConnector()!.id, files).subscribe(() => {
      this.refreshErrorValues();
    });
  }

  refreshErrorValues() {
    this.northConnectorService.getCacheErrorValues(this.northConnector()!.id).subscribe(errorValues => {
      this.errorValues = errorValues;
    });
  }
}
