import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';

import { TranslateDirective } from '@ngx-translate/core';

import { EngineService } from '../services/engine.service';

@Component({
  selector: 'oib-about',
  imports: [ReactiveFormsModule, TranslateDirective],
  templateUrl: './about.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './about.component.scss'
})
export class AboutComponent {
  readonly oibusInfo = toSignal(inject(EngineService).getInfo());
}
