import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective } from '@ngx-translate/core';
import { finalize, Observable } from 'rxjs';

import { OIBusNorthType } from '@oibus/shared/connector/north-manifest.model';
import { NorthSettings } from '@oibus/shared/connector/north-settings.model';
import { OIBusSouthType } from '@oibus/shared/connector/south-manifest.model';
import { SouthSettings } from '@oibus/shared/connector/south-settings.model';
import { OIBusConnectionTestResult } from '@oibus/shared/domain/engine.model';
import { ServerIdentity } from '@oibus/shared/domain/server-identity.model';

import { HistoryQueryService } from '../../services/history-query.service';
import { NorthConnectorService } from '../../services/north-connector.service';
import { SouthConnectorService } from '../../services/south-connector.service';
import { extractErrorMessage } from '../extract-error-message';
import { ServerIdentityComponent } from '../server-trust/server-identity/server-identity.component';

/** How the identity a server presents is trusted from the test connection modal */
export interface ServerTrustOptions {
  /** The identity trusted before, shown when the server presents another one */
  trusted: ServerIdentity | null;
  /** Saves the trust (a saved connector), or keeps it in the form of the connector */
  trust: (identity: ServerIdentity) => Observable<unknown>;
}

@Component({
  selector: 'oib-test-connection-result-modal',
  templateUrl: './test-connection-result-modal.component.html',
  styleUrl: './test-connection-result-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateDirective, ServerIdentityComponent]
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
  /** How the identity a server presents is trusted from this modal, and the identity trusted before; null when it cannot be */
  readonly serverTrust = signal<ServerTrustOptions | null>(null);
  readonly trusting = signal(false);
  private test: (() => Observable<OIBusConnectionTestResult>) | null = null;

  /**
   * Lets the user trust the identity the server presents (before running the test): saved right away for a saved
   * connector, or kept in its form. The test runs again once trusted.
   */
  allowServerTrust(options: ServerTrustOptions) {
    this.serverTrust.set(options);
  }

  /**
   * Prepares the component for connector testing.
   */
  runTest(
    type: 'south' | 'north',
    connectorId: string | null,
    settingsToTest: SouthSettings | NorthSettings,
    connectorType: OIBusSouthType | OIBusNorthType
  ) {
    this.run(type, () =>
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
    this.run(type, () =>
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

  private run(type: 'south' | 'north', test: () => Observable<OIBusConnectionTestResult>) {
    this.type.set(type);
    this.test = test;
    this.loading.set(true);
    this.error.set(null);
    this.success.set(false);
    this.testResult.set(null);
    test().subscribe({
      error: (httpError: HttpErrorResponse) => {
        this.error.set(extractErrorMessage(httpError));
        this.loading.set(false);
      },
      next: result => {
        this.testResult.set(result);
        this.success.set(true);
        this.loading.set(false);
      }
    });
  }

  /** Trusts the identity the server presented, then tests the connection again */
  trustServerIdentity(identity: ServerIdentity) {
    const serverTrust = this.serverTrust()!;
    this.trusting.set(true);
    serverTrust
      .trust(identity)
      .pipe(finalize(() => this.trusting.set(false)))
      .subscribe(() => {
        this.serverTrust.set({ ...serverTrust, trusted: identity });
        this.run(this.type()!, this.test!);
      });
  }

  cancel() {
    this.modal.dismiss();
  }
}
