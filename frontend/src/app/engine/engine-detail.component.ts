import { Component, DestroyRef, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateDirective, TranslateModule } from '@ngx-translate/core';
import { EngineService } from '../services/engine.service';
import { EngineMetrics } from '../../../../backend/shared/model/engine.model';
import { AsyncPipe } from '@angular/common';
import { ScanModeListComponent } from './scan-mode-list/scan-mode-list.component';
import { IpFilterListComponent } from './ip-filter-list/ip-filter-list.component';
import { NotificationService } from '../shared/notification.service';
import { ConfirmationService } from '../shared/confirmation.service';
import { switchMap } from 'rxjs';
import { ObservableState } from '../shared/save-button/save-button.component';
import { BoxComponent } from '../shared/box/box.component';
import { EngineMetricsComponent } from './engine-metrics/engine-metrics.component';
import { WindowService } from '../shared/window.service';
import { RouterLink } from '@angular/router';
import { CertificateListComponent } from './certificate-list/certificate-list.component';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TransformerListComponent } from './transformer-list/transformer-list.component';

@Component({
  selector: 'oib-engine-detail',
  imports: [
    TranslateDirective,
    ScanModeListComponent,
    CertificateListComponent,
    IpFilterListComponent,
    AsyncPipe,
    BoxComponent,
    EngineMetricsComponent,
    RouterLink,
    NgbTooltip,
    TranslateModule,
    TransformerListComponent
  ],
  templateUrl: './engine-detail.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './engine-detail.component.scss'
})
export class EngineDetailComponent {
  private engineService = inject(EngineService);
  private windowService = inject(WindowService);
  private notificationService = inject(NotificationService);
  private confirmationService = inject(ConfirmationService);
  private destroyRef = inject(DestroyRef);

  readonly engineSettings = toSignal(this.engineService.getEngineSettings());
  metrics = signal<EngineMetrics | null>(null);
  restarting = new ObservableState();

  constructor() {
    const token = this.windowService.getStorageItem('oibus-token');
    const stream = new EventSource(`/sse/engine?token=${token}`, { withCredentials: true });
    stream.onmessage = (event: MessageEvent) => {
      if (event && event.data) {
        this.metrics.set(JSON.parse(event.data));
      }
    };
    this.destroyRef.onDestroy(() => stream.close());
  }

  restart() {
    this.confirmationService
      .confirm({
        messageKey: 'engine.confirm-restart'
      })
      .pipe(
        switchMap(() => {
          return this.engineService.restart().pipe(this.restarting.pendingUntilFinalization());
        })
      )
      .subscribe(() => {
        this.notificationService.success('engine.restart-complete');
      });
  }
}
