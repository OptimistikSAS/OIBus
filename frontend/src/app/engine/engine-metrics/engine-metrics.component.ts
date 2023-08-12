import { Component, Input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { EngineMetrics } from '../../../../../shared/model/engine.model';
import { NgIf, PercentPipe } from '@angular/common';
import { DatetimePipe } from '../../shared/datetime.pipe';
import { DurationPipe } from '../../shared/duration.pipe';
import { NotificationService } from '../../shared/notification.service';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { EngineService } from '../../services/engine.service';
import { FileSizePipe } from '../../shared/file-size.pipe';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'oib-engine-metrics',
  standalone: true,
  imports: [TranslateModule, NgIf, BoxComponent, BoxTitleDirective, PercentPipe, FileSizePipe, RouterLink, DatetimePipe, DurationPipe],
  templateUrl: './engine-metrics.component.html',
  styleUrls: ['./engine-metrics.component.scss']
})
export class EngineMetricsComponent {
  @Input() displayButton = false;
  @Input({ required: true }) metrics!: EngineMetrics;

  constructor(private engineService: EngineService, private notificationService: NotificationService) {}

  resetMetrics() {
    this.engineService.resetMetrics().subscribe(() => {
      this.notificationService.success('engine.monitoring.metrics-reset');
    });
  }
}
