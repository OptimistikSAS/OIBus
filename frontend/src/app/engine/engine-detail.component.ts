import { Component, OnInit } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { RouterLink } from '@angular/router';
import { EngineService } from '../services/engine.service';
import { EngineSettingsDTO } from '../../../../shared/model/engine.model';
import { AsyncPipe, NgForOf, NgIf } from '@angular/common';
import { ScanModeListComponent } from './scan-mode-list/scan-mode-list.component';
import { ExternalSourceListComponent } from './external-source-list/external-source-list.component';
import { IpFilterListComponent } from './ip-filter-list/ip-filter-list.component';
import { NotificationService } from '../shared/notification.service';
import { ConfirmationService } from '../shared/confirmation.service';
import { switchMap } from 'rxjs';
import { EnabledEnumPipe } from '../shared/enabled-enum.pipe';
import { ObservableState } from '../shared/save-button/save-button.component';
import { BoxComponent } from '../shared/box/box.component';
import { EngineMetricsComponent } from './engine-metrics/engine-metrics.component';

@Component({
  selector: 'oib-engine-detail',
  standalone: true,
  imports: [
    NgIf,
    TranslateModule,
    RouterLink,
    ScanModeListComponent,
    ExternalSourceListComponent,
    IpFilterListComponent,
    EnabledEnumPipe,
    NgForOf,
    AsyncPipe,
    BoxComponent,
    EngineMetricsComponent
  ],
  templateUrl: './engine-detail.component.html',
  styleUrls: ['./engine-detail.component.scss']
})
export class EngineDetailComponent implements OnInit {
  engineSettings: EngineSettingsDTO | null = null;

  restarting = new ObservableState();
  shuttingDown = new ObservableState();

  constructor(
    private engineService: EngineService,
    private notificationService: NotificationService,
    private confirmationService: ConfirmationService
  ) {}

  ngOnInit() {
    this.engineService.getEngineSettings().subscribe(settings => {
      this.engineSettings = settings;
    });
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
}
