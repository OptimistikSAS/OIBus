import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { TranslateDirective } from '@ngx-translate/core';

import { ServerTrustStateDTO } from '@oibus/shared/api/server-identity.model';
import { PresentedServerIdentity } from '@oibus/shared/domain/server-identity.model';

import { DatetimePipe } from '../../datetime.pipe';
import { ServerIdentityComponent } from '../server-identity/server-identity.component';

/**
 * The trust of a connector in the identity of its server, on the page of the connector: the identity trusted, and the
 * identity the connector refused (pending), to review and trust.
 */
@Component({
  selector: 'oib-server-trust-panel',
  templateUrl: './server-trust-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateDirective, DatetimePipe, ServerIdentityComponent]
})
export class ServerTrustPanelComponent {
  readonly serverTrust = input.required<ServerTrustStateDTO>();
  /** The title of the panel, for a side of a history query */
  readonly titleKey = input('server-trust.panel.title');
  /** The messages of the identity refused, by status, for another client than a connector (the registration of OIBus) */
  readonly refusedKey = input('server-trust.panel.refused');
  readonly review = output<PresentedServerIdentity>();
}
