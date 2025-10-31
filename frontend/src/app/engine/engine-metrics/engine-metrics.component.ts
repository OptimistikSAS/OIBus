import { Component, NgZone, inject, input } from '@angular/core';
import { TranslateDirective, TranslateModule } from '@ngx-translate/core';
import { EngineMetrics } from '../../../../../backend/shared/model/engine.model';
import { PercentPipe } from '@angular/common';
import { DatetimePipe } from '../../shared/datetime.pipe';
import { DurationPipe } from '../../shared/duration.pipe';
import { NotificationService } from '../../shared/notification.service';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { EngineService } from '../../services/engine.service';
import { FileSizePipe } from '../../shared/file-size.pipe';
import { Router } from '@angular/router';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'oib-engine-metrics',
  imports: [
    TranslateDirective,
    BoxComponent,
    BoxTitleDirective,
    PercentPipe,
    FileSizePipe,
    DatetimePipe,
    DurationPipe,
    NgbTooltip,
    TranslateModule
  ],
  templateUrl: './engine-metrics.component.html',
  styleUrl: './engine-metrics.component.scss'
})
export class EngineMetricsComponent {
  private zone = inject(NgZone);
  private engineService = inject(EngineService);
  private notificationService = inject(NotificationService);
  private router = inject(Router);

  readonly displayButton = input(false);
  readonly metrics = input.required<EngineMetrics>();

  resetMetrics() {
    this.zone.run(() => {
      this.engineService.resetEngineMetrics().subscribe(() => {
        this.notificationService.success('engine.monitoring.metrics-reset');
      });
    });
  }

  navigateToDisplay() {
    this.zone.run(() => {
      this.router.navigate(['/engine']);
    });
  }
}
