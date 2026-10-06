import { PercentPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, NgZone } from '@angular/core';
import { Router } from '@angular/router';

import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';

import { EngineMetrics } from '@oibus/shared/domain/engine.model';

import { EngineService } from '../../services/engine.service';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { DatetimePipe } from '../../shared/datetime.pipe';
import { DurationPipe } from '../../shared/duration.pipe';
import { FileSizePipe } from '../../shared/file-size.pipe';
import { NotificationService } from '../../shared/notification.service';

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
    TranslatePipe
  ],
  templateUrl: './engine-metrics.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
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
