import { Component, OnInit } from '@angular/core';
import { ProxyListComponent } from './proxy-list/proxy-list.component';
import { TranslateModule } from '@ngx-translate/core';
import { RouterLink } from '@angular/router';
import { EngineService } from '../services/engine.service';
import { EngineSettingsDTO } from '../../../../shared/model/engine.model';
import { NgIf } from '@angular/common';
import { ScanModeListComponent } from './scan-mode-list/scan-mode-list.component';
import { ExternalSourceListComponent } from './external-source-list/external-source-list.component';
import { IpFilterListComponent } from './ip-filter-list/ip-filter-list.component';
import { NotificationService } from '../shared/notification.service';
import { ConfirmationService } from '../shared/confirmation.service';
import { switchMap } from 'rxjs';

@Component({
  selector: 'oib-engine',
  standalone: true,
  imports: [
    NgIf,
    TranslateModule,
    RouterLink,
    ProxyListComponent,
    ScanModeListComponent,
    ExternalSourceListComponent,
    IpFilterListComponent
  ],
  templateUrl: './engine.component.html',
  styleUrls: ['./engine.component.scss']
})
export class EngineComponent implements OnInit {
  engineSettings: EngineSettingsDTO | null = null;
  shuttingDown = false;
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
          this.shuttingDown = true;
          return this.engineService.shutdown();
        })
      )
      .subscribe(() => {
        this.shuttingDown = false;
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
          this.shuttingDown = true;
          return this.engineService.restart();
        })
      )
      .subscribe(() => {
        this.shuttingDown = false;
        this.notificationService.success('engine.restart-complete');
      });
  }
}
