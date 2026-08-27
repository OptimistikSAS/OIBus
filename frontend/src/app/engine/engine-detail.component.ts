import { Component, DestroyRef, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { EngineService } from '../services/engine.service';
import { EngineMetrics } from '../../../../backend/shared/model/engine.model';
import { AsyncPipe } from '@angular/common';
import { ScanModeListComponent } from './scan-mode-list/scan-mode-list.component';
import { IpFilterListComponent } from './ip-filter-list/ip-filter-list.component';
import { NotificationService } from '../shared/notification.service';
import { ConfirmationService } from '../shared/confirmation.service';
import { BehaviorSubject, firstValueFrom, switchMap } from 'rxjs';
import { ObservableState } from '../shared/save-button/save-button.component';
import { BoxComponent, BoxTitleDirective } from '../shared/box/box.component';
import { EngineMetricsComponent } from './engine-metrics/engine-metrics.component';
import { WindowService } from '../shared/window.service';
import { RouterLink } from '@angular/router';
import { CertificateListComponent } from './certificate-list/certificate-list.component';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TransformerListComponent } from './transformer-list/transformer-list.component';
import { ModalService } from '../shared/modal.service';
import { EditEngineNameModalComponent } from './edit-engine-name-modal/edit-engine-name-modal.component';
import { EditEngineWebServerModalComponent } from './edit-engine-web-server-modal/edit-engine-web-server-modal.component';
import { EditEngineProxyModalComponent } from './edit-engine-proxy-modal/edit-engine-proxy-modal.component';
import { EditEngineLoggerModalComponent } from './edit-engine-logger-modal/edit-engine-logger-modal.component';
import { AuthTokenDuration } from '../../../../backend/shared/model/engine.model';
import { ConfigTransferService } from '../services/config-transfer.service';
import { ImportConfigModalComponent } from './config-transfer/import-config-modal/import-config-modal.component';

@Component({
  selector: 'oib-engine-detail',
  imports: [
    TranslateDirective,
    ScanModeListComponent,
    CertificateListComponent,
    IpFilterListComponent,
    AsyncPipe,
    BoxComponent,
    BoxTitleDirective,
    EngineMetricsComponent,
    RouterLink,
    NgbTooltip,
    TranslatePipe,
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
  private modalService = inject(ModalService);
  private configTransferService = inject(ConfigTransferService);
  private destroyRef = inject(DestroyRef);

  private readonly refresh$ = new BehaviorSubject<void>(undefined);

  readonly engineSettings = toSignal(this.refresh$.pipe(switchMap(() => this.engineService.getEngineSettings())));
  metrics = signal<EngineMetrics | null>(null);
  restarting = new ObservableState();
  exporting = new ObservableState();

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

  openNameModal() {
    const modal = this.modalService.open(EditEngineNameModalComponent);
    modal.componentInstance.initialize(this.engineSettings()!);
    modal.result.subscribe(() => this.refresh$.next());
  }

  authTokenDurationLabelKey(duration: AuthTokenDuration): string {
    return `engine.web-server-settings.auth-token-duration-options.${duration}`;
  }

  openWebServerModal() {
    const modal = this.modalService.open(EditEngineWebServerModalComponent);
    modal.componentInstance.initialize(this.engineSettings()!);
    modal.result.subscribe(() => this.refresh$.next());
  }

  openProxyModal() {
    const modal = this.modalService.open(EditEngineProxyModalComponent);
    modal.componentInstance.initialize(this.engineSettings()!);
    modal.result.subscribe(() => this.refresh$.next());
  }

  openLoggerModal() {
    const modal = this.modalService.open(EditEngineLoggerModalComponent, { size: 'lg' });
    modal.componentInstance.initialize(this.engineSettings()!);
    modal.result.subscribe(() => this.refresh$.next());
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

  exportConfig() {
    this.configTransferService
      .export()
      .pipe(this.exporting.pendingUntilFinalization())
      .subscribe({
        error: (message: string) => this.notificationService.errorMessage(message)
      });
  }

  openImportConfigModal() {
    const modalRef = this.modalService.open(ImportConfigModalComponent, {
      size: 'lg',
      beforeDismiss: async () => {
        const component: ImportConfigModalComponent = modalRef.componentInstance;
        const canDismissResult = component.canDismiss();
        const canDismiss = typeof canDismissResult === 'boolean' ? canDismissResult : await firstValueFrom(canDismissResult);
        if (canDismiss && component.result()) {
          // A successful import was already showing when the user dismissed via Escape or the
          // backdrop instead of clicking "Close and reload": `modalRef.result` below only reloads
          // on an explicit close(), and a dismissal never reaches it (see ModalService), so without
          // this the backend would have already wiped and recreated the configuration while the SPA
          // keeps displaying stale pre-import data until the user thinks to refresh manually.
          this.windowService.reload();
        }
        return canDismiss;
      }
    });
    modalRef.result.subscribe(() => {
      // the import wipes and recreates most of the local configuration; a full reload is the
      // safest way to refresh every affected part of the app (scan modes, certificates, ip
      // filters, transformers, connectors, ...) rather than granularly refreshing each of them
      this.windowService.reload();
    });
  }
}
