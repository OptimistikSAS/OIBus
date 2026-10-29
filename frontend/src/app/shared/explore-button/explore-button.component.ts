import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { TranslateDirective } from '@ngx-translate/core';

/**
 * The entry of a south connector page to its data source: exploring it, and with discovery, keeping items in sync with it
 * too. The page shows this button only for a connector that explores its data source.
 */
@Component({
  selector: 'oib-explore-button',
  templateUrl: './explore-button.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateDirective]
})
export class ExploreButtonComponent {
  /** Whether the connector has discovery, hence items synchronisations next to the exploration */
  readonly sync = input(false);
  readonly explore = output();
}
