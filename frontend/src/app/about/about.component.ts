import { ClipboardModule } from '@angular/cdk/clipboard';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

import { TranslateDirective, TranslateService } from '@ngx-translate/core';

import { EngineService } from '../services/engine.service';
import { LoadingSpinnerComponent } from '../shared/loading-spinner/loading-spinner.component';
import { NotificationService } from '../shared/notification.service';

@Component({
  selector: 'oib-about',
  imports: [TranslateDirective, ClipboardModule, LoadingSpinnerComponent],
  templateUrl: './about.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './about.component.scss'
})
export class AboutComponent {
  private readonly translateService = inject(TranslateService);
  private readonly notificationService = inject(NotificationService);

  readonly oibusInfo = toSignal(inject(EngineService).getInfo());
  readonly copyrightYear = new Date().getFullYear();

  /** The flags OIBus was launched with that change its behavior, null when there is none */
  readonly launchOptions = computed(() => {
    const info = this.oibusInfo();
    const options = [info?.ignoreIpFilters && '--ignoreIpFilters', info?.ignoreRemoteUpdate && '--ignoreRemoteUpdate'].filter(Boolean);
    return options.length ? options.join(' ') : null;
  });

  /** What describes this OIBus and the machine it runs on, one line per information, to paste in a support request */
  readonly systemInfo = computed(() => {
    const info = this.oibusInfo();
    if (!info) {
      return '';
    }
    const lines: Array<[string, string]> = [
      ['about.name', info.oibusName],
      ['about.id', info.oibusId],
      ['about.version', info.version],
      ['about.launcher-version', info.launcherVersion],
      ['about.hostname', info.hostname],
      ['about.operating-system', info.operatingSystem],
      ['about.architecture', info.architecture],
      ['about.process-id', info.processId],
      ['about.executable', info.binaryDirectory],
      ['about.data-folder', info.dataDirectory]
    ];
    const launchOptions = this.launchOptions();
    if (launchOptions) {
      lines.push(['about.launch-options', launchOptions]);
    }
    return lines.map(([label, value]) => `${this.translateService.instant(label)}: ${value}`).join('\n');
  });

  onClipboardCopy(result: boolean) {
    if (result) {
      this.notificationService.success('about.copy-info-success');
    } else {
      this.notificationService.error('about.copy-info-error');
    }
  }
}
