import { Component, Input, OnInit, ViewChild } from '@angular/core';
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
import { FileTableComponent, FileTableData } from '../file-table/file-table.component';
import { emptyPage } from '../../../shared/test-utils';

@Component({
  selector: 'oib-error-values',
  templateUrl: './error-values.component.html',
  styleUrl: './error-values.component.scss',
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
export class ErrorValuesComponent implements OnInit {
  @Input() northConnector: NorthConnectorDTO | null = null;
  errorValues: Array<NorthCacheFiles> = [];
  @ViewChild('fileTable') fileTable!: FileTableComponent;
  fileTablePages = emptyPage<FileTableData>();

  constructor(private northConnectorService: NorthConnectorService) {}

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
