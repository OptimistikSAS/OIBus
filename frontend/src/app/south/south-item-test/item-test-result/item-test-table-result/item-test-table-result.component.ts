import { Component, effect, input } from '@angular/core';
import { OIBusContent, OIBusTimeValue } from '../../../../../../../backend/shared/model/engine.model';
import { ContentDisplayMode } from '../item-test-result.component';
import { createPageFromArray, Page } from '../../../../../../../backend/shared/model/types';
import { emptyPage } from '../../../../shared/test-utils';
import { PaginationComponent } from '../../../../shared/pagination/pagination.component';
import { TranslatePipe } from '@ngx-translate/core';
import { BaseItemTestResult } from '../item-test-result.interface';
import Papa from 'papaparse';

const PAGE_SIZE = 10;

@Component({
  selector: 'oib-item-test-table-result',
  imports: [PaginationComponent, TranslatePipe],
  templateUrl: './item-test-table-result.component.html',
  styleUrl: './item-test-table-result.component.scss'
})
export class ItemTestTableResultComponent implements BaseItemTestResult {
  content = input.required<OIBusContent>();
  errorMessage: string | null = null;

  tableView: Page<OIBusTimeValue> = emptyPage();
  tableType: 'time-values' | 'generic' = 'generic';
  genericTableView: Page<Array<string>> = emptyPage();

  headers: Array<string> | null = null;

  constructor() {
    effect(() => this.content() && this.resetPage());
  }

  convertDataToString(data: OIBusTimeValue['data']) {
    const { value, ...rest } = data;
    return {
      value,
      other: JSON.stringify(rest, null, 2)
    };
  }

  resetPage() {
    try {
      this.tableType = this.content().type === 'time-values' ? 'time-values' : 'generic';
      this.changePage(0);
    } catch (error: any) {
      this.errorMessage = error.message;
    }
  }

  changePage(pageNumber: number) {
    const content = this.content();

    switch (content.type) {
      case 'time-values':
        this.tableView = createPageFromArray(content.content, PAGE_SIZE, pageNumber);
        break;
      case 'any':
        const contentString = content.content;
        if (!contentString) {
          this.genericTableView = emptyPage();
          break;
        }

        const rows = Papa.parse<Array<string>>(contentString).data;
        this.headers = rows.shift()!;
        this.genericTableView = createPageFromArray(rows, PAGE_SIZE, pageNumber);
        break;
    }
  }

  getSupportedDisplayModes(content: OIBusContent): Array<ContentDisplayMode> | null {
    switch (content.type) {
      case 'time-values':
        return ['table'];
      case 'any':
        if (content.filePath.endsWith('.csv') && content.content) {
          return ['table'];
        }

        return null;
      default:
        return null;
    }
  }

  cleanup(): void {
    this.tableView = emptyPage();
    this.genericTableView = emptyPage();
  }
}
