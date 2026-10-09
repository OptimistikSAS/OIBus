import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

import { TranslateDirective } from '@ngx-translate/core';

import { EngineService } from '../services/engine.service';

@Component({
  selector: 'oib-about',
  imports: [TranslateDirective],
  templateUrl: './about.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './about.component.scss'
})
export class AboutComponent {
  readonly oibusInfo = toSignal(inject(EngineService).getInfo());
}
