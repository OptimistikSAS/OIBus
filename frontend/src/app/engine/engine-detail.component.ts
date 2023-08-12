import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { EngineService } from '../services/engine.service';
import { EngineMetrics, EngineSettingsDTO } from '../../../../shared/model/engine.model';
import { AsyncPipe, NgForOf, NgIf } from '@angular/common';
import { ScanModeListComponent } from './scan-mode-list/scan-mode-list.component';
import { ExternalSourceListComponent } from './external-source-list/external-source-list.component';
import { IpFilterListComponent } from './ip-filter-list/ip-filter-list.component';
import { NotificationService } from '../shared/notification.service';
import { ConfirmationService } from '../shared/confirmation.service';
import { switchMap } from 'rxjs';
import { ObservableState } from '../shared/save-button/save-button.component';
import { BoxComponent } from '../shared/box/box.component';
import { EngineMetricsComponent } from './engine-metrics/engine-metrics.component';
import { WindowService } from '../shared/window.service';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'oib-engine-detail',
  standalone: true,
  imports: [
    NgIf,
    TranslateModule,
    ScanModeListComponent,
    ExternalSourceListComponent,
    IpFilterListComponent,
    AsyncPipe,
    NgForOf,
    BoxComponent,
    EngineMetricsComponent,
    RouterLink
  ],
  templateUrl: './engine-detail.component.html',
  styleUrls: ['./engine-detail.component.scss']
})
export class EngineDetailComponent implements OnInit, OnDestroy {
  engineSettings: EngineSettingsDTO | null = null;
  connectorStream: EventSource | null = null;
  metrics: EngineMetrics | null = null;

  restarting = new ObservableState();
  shuttingDown = new ObservableState();

  constructor(
    private engineService: EngineService,
    private windowService: WindowService,
    private notificationService: NotificationService,
    private confirmationService: ConfirmationService,
    private cd: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.engineService.getEngineSettings().subscribe(settings => {
      this.engineSettings = settings;
    });

    const token = this.windowService.getStorageItem('oibus-token');
    this.connectorStream = new EventSource(`/sse/engine?token=${token}`, { withCredentials: true });
    this.connectorStream.onmessage = (event: MessageEvent) => {
      if (event && event.data) {
        this.metrics = JSON.parse(event.data);
        this.cd.detectChanges();
      }
    };
  }

  shutdown() {
    this.confirmationService
      .confirm({
        messageKey: 'engine.confirm-shutdown'
      })
      .pipe(
        switchMap(() => {
          return this.engineService.shutdown().pipe(this.shuttingDown.pendingUntilFinalization());
        })
      )
      .subscribe(() => {
        this.notificationService.success('engine.shutdown-complete');
      });
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

  ngOnDestroy() {
    this.connectorStream?.close();
  }
}
