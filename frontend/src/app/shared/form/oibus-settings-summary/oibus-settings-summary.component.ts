import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { TranslateDirective } from '@ngx-translate/core';

import { compareSettings, SettingSummary, SettingView } from './settings-summary';

/**
 * Read-only view of settings summed up with `summarizeSettings()`. Given a previous version of them (e.g. as saved), it marks the
 * settings that changed and shows what they were; the settings with an error are flagged.
 */
@Component({
  selector: 'oib-oibus-settings-summary',
  templateUrl: './oibus-settings-summary.component.html',
  imports: [NgTemplateOutlet, TranslateDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OIBusSettingsSummaryComponent {
  readonly settings = input.required<Array<SettingSummary>>();
  /** The previous version of the settings, to show what changed: null when there is nothing to compare with */
  readonly previous = input<Array<SettingSummary> | null>(null);

  readonly views = computed(() => compareSettings(this.settings(), this.previous()));

  /** Types the views of the recursive list template, whose context is untyped */
  asViews(views: Array<SettingView>): Array<SettingView> {
    return views;
  }

  /** Types the setting of the value template, whose context is untyped */
  asSetting(setting: SettingSummary): SettingSummary {
    return setting;
  }
}
