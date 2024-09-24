import { Component, inject } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { SaveButtonComponent } from '../save-button/save-button.component';
import { TranslateModule } from '@ngx-translate/core';
import { SouthConnectorCommandDTO, SouthConnectorDTO } from '../../../../../shared/model/south-connector.model';

import { FormComponent } from '../form/form.component';
import { SouthConnectorService } from '../../services/south-connector.service';
import { NorthConnectorCommandDTO, NorthConnectorDTO } from '../../../../../shared/model/north-connector.model';
import { NorthConnectorService } from '../../services/north-connector.service';
import { HistoryQueryService } from '../../services/history-query.service';

@Component({
  selector: 'oib-test-connection-result-modal',
  templateUrl: './test-connection-result-modal.component.html',
  styleUrl: './test-connection-result-modal.component.scss',
  imports: [TranslateModule, SaveButtonComponent, FormComponent],
  standalone: true
})
export class TestConnectionResultModalComponent {
  private modal = inject(NgbActiveModal);
  private southConnectorService = inject(SouthConnectorService);
  private northConnectorService = inject(NorthConnectorService);
  protected historyQueryService = inject(HistoryQueryService);

  type: 'north' | 'south' | null = null;
  loading = false;
  success = false;
  error: string | null = null;
  connector: SouthConnectorDTO | NorthConnectorDTO | null = null;

  /**
   * Prepares the component for creation.
   */
  runTest(
    type: 'south' | 'north',
    connector: SouthConnectorDTO | NorthConnectorDTO | null,
    command: SouthConnectorCommandDTO | NorthConnectorCommandDTO
  ) {
    this.type = type;
    this.loading = true;
    this.connector = connector;
    let obs;
    if (type === 'south') {
      obs = this.southConnectorService.testConnection(this.connector?.id || 'create', command as SouthConnectorCommandDTO);
    } else {
      obs = this.northConnectorService.testConnection(this.connector?.id || 'create', command as NorthConnectorCommandDTO);
    }
    obs.subscribe({
      error: httpError => {
        this.error = httpError.error.message;
        this.loading = false;
      },
      next: () => {
        this.success = true;
        this.loading = false;
      }
    });
  }

  /**
   * Prepares the component for history query testing.
   */
  runHistoryQueryTest(
    type: 'south' | 'north',
    command: SouthConnectorCommandDTO | NorthConnectorCommandDTO,
    historyQueryId: string | null,
    fromConnectorId: string | null = null
  ) {
    this.type = type;
    this.loading = true;
    let obs;
    if (type === 'south') {
      obs = this.historyQueryService.testSouthConnection(historyQueryId || 'create', command as SouthConnectorCommandDTO, fromConnectorId);
    } else {
      obs = this.historyQueryService.testNorthConnection(historyQueryId || 'create', command as NorthConnectorCommandDTO, fromConnectorId);
    }
    obs.subscribe({
      error: httpError => {
        this.error = httpError.error.message;
        this.loading = false;
      },
      next: () => {
        this.success = true;
        this.loading = false;
      }
    });
  }

  cancel() {
    this.modal.dismiss();
  }
}
