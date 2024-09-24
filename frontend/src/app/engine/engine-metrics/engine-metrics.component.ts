import { Component, Input, NgZone, inject } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { EngineMetrics } from '../../../../../shared/model/engine.model';
import { PercentPipe } from '@angular/common';
import { DatetimePipe } from '../../shared/datetime.pipe';
import { DurationPipe } from '../../shared/duration.pipe';
import { NotificationService } from '../../shared/notification.service';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { EngineService } from '../../services/engine.service';
import { FileSizePipe } from '../../shared/file-size.pipe';
import { Router } from '@angular/router';

@Component({
  selector: 'oib-engine-metrics',
  standalone: true,
  imports: [TranslateModule, BoxComponent, BoxTitleDirective, PercentPipe, FileSizePipe, DatetimePipe, DurationPipe],
  templateUrl: './engine-metrics.component.html',
  styleUrl: './engine-metrics.component.scss'
})
export class EngineMetricsComponent {
  private zone = inject(NgZone);
  private engineService = inject(EngineService);
  private notificationService = inject(NotificationService);
  private router = inject(Router);

  @Input() displayButton = false;
  @Input({ required: true }) metrics!: EngineMetrics;

  resetMetrics() {
    this.zone.run(() => {
      this.engineService.resetMetrics().subscribe(() => {
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
