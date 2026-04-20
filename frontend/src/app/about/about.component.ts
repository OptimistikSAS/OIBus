import { Component, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { TranslateDirective } from '@ngx-translate/core';
import { EngineService } from '../services/engine.service';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'oib-about',
  imports: [ReactiveFormsModule, TranslateDirective],
  templateUrl: './about.component.html',
  styleUrl: './about.component.scss'
})
export class AboutComponent {
  readonly oibusInfo = toSignal(inject(EngineService).getInfo());
}
