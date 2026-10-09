import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective } from '@ngx-translate/core';
import { Observable } from 'rxjs';

import { OIBusNorthType } from '@oibus/shared/connector/north-manifest.model';
import { NorthSettings } from '@oibus/shared/connector/north-settings.model';
import { OIBusSouthType } from '@oibus/shared/connector/south-manifest.model';
import { SouthSettings } from '@oibus/shared/connector/south-settings.model';
import { OIBusConnectionTestResult } from '@oibus/shared/domain/engine.model';

import { HistoryQueryService } from '../../services/history-query.service';
import { NorthConnectorService } from '../../services/north-connector.service';
import { SouthConnectorService } from '../../services/south-connector.service';

@Component({
  selector: 'oib-test-connection-result-modal',
  templateUrl: './test-connection-result-modal.component.html',
  styleUrl: './test-connection-result-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateDirective]
})
export class TestConnectionResultModalComponent {
  private readonly modal = inject(NgbActiveModal);
  private readonly southConnectorService = inject(SouthConnectorService);
  private readonly northConnectorService = inject(NorthConnectorService);
  private readonly historyQueryService = inject(HistoryQueryService);

  readonly type = signal<'north' | 'south' | null>(null);
  readonly loading = signal(false);
  readonly success = signal(false);
  readonly error = signal<string | null>(null);
  readonly testResult = signal<OIBusConnectionTestResult | null>(null);

  /**
   * Prepares the component for connector testing.
   */
  runTest(
    type: 'south' | 'north',
    connectorId: string | null,
    settingsToTest: SouthSettings | NorthSettings,
    connectorType: OIBusSouthType | OIBusNorthType
  ) {
    this.run(
      type,
      type === 'south'
        ? this.southConnectorService.testConnection(
            connectorId || 'create',
            settingsToTest as SouthSettings,
            connectorType as OIBusSouthType
          )
        : this.northConnectorService.testConnection(
            connectorId || 'create',
            settingsToTest as NorthSettings,
            connectorType as OIBusNorthType
          )
    );
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
    this.run(
      type,
      type === 'south'
        ? this.historyQueryService.testSouthConnection(
            historyQueryId || 'create',
            settingsToTest as SouthSettings,
            connectorType as OIBusSouthType,
            fromConnectorId
          )
        : this.historyQueryService.testNorthConnection(
            historyQueryId || 'create',
            settingsToTest as NorthSettings,
            connectorType as OIBusNorthType,
            fromConnectorId
          )
    );
  }

  private run(type: 'south' | 'north', test$: Observable<OIBusConnectionTestResult>) {
    this.type.set(type);
    this.loading.set(true);
    test$.subscribe({
      error: (httpError: HttpErrorResponse) => {
        this.error.set(httpError.error.message);
        this.loading.set(false);
      },
      next: result => {
        this.testResult.set(result);
        this.success.set(true);
        this.loading.set(false);
      }
    });
  }

  cancel() {
    this.modal.dismiss();
  }
}
