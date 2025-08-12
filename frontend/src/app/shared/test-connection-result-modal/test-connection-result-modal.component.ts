import { Component, inject } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective } from '@ngx-translate/core';
import { SouthConnectorService } from '../../services/south-connector.service';
import { NorthConnectorService } from '../../services/north-connector.service';
import { HistoryQueryService } from '../../services/history-query.service';
import { SouthSettings } from '../../../../../backend/shared/model/south-settings.model';
import { NorthSettings } from '../../../../../backend/shared/model/north-settings.model';
import { OIBusSouthType } from '../../../../../backend/shared/model/south-connector.model';
import { OIBusNorthType } from '../../../../../backend/shared/model/north-connector.model';

@Component({
  selector: 'oib-test-connection-result-modal',
  templateUrl: './test-connection-result-modal.component.html',
  styleUrl: './test-connection-result-modal.component.scss',
  imports: [TranslateDirective]
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

  /**
   * Prepares the component for connector testing.
   */
  runTest(
    type: 'south' | 'north',
    connectorId: string | null,
    settingsToTest: SouthSettings | NorthSettings,
    connectorType: OIBusSouthType | OIBusNorthType
  ) {
    this.type = type;
    this.loading = true;
    let obs;
    if (type === 'south') {
      obs = this.southConnectorService.testConnection(
        connectorId || 'create',
        settingsToTest as SouthSettings,
        connectorType as OIBusSouthType
      );
    } else {
      obs = this.northConnectorService.testConnection(
        connectorId || 'create',
        settingsToTest as NorthSettings,
        connectorType as OIBusNorthType
      );
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
    historyQueryId: string | null,
    settingsToTest: SouthSettings | NorthSettings,
    connectorType: OIBusSouthType | OIBusNorthType,
    fromConnectorId: string | null = null
  ) {
    this.type = type;
    this.loading = true;
    let obs;
    if (type === 'south') {
      obs = this.historyQueryService.testSouthConnection(
        historyQueryId || 'create',
        settingsToTest as SouthSettings,
        connectorType as OIBusSouthType,
        fromConnectorId
      );
    } else {
      obs = this.historyQueryService.testNorthConnection(
        historyQueryId || 'create',
        settingsToTest as NorthSettings,
        connectorType as OIBusNorthType,
        fromConnectorId
      );
    }
    obs.subscribe({
      error: (httpError: any) => {
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
