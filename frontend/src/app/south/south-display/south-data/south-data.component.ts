import { ChangeDetectorRef, Component, Input, OnDestroy, OnInit } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { SouthConnectorDTO } from '../../../../../../shared/model/south-connector.model';
import { ConnectorMetrics } from '../../../../../../shared/model/engine.model';
import { NgIf } from '@angular/common';
import { WindowService } from '../../../shared/window.service';
import { DatetimePipe } from '../../../shared/datetime.pipe';
import { DurationPipe } from '../../../shared/duration.pipe';

@Component({
  selector: 'oib-south-data',
  templateUrl: './south-data.component.html',
  styleUrls: ['./south-data.component.scss'],
  imports: [TranslateModule, NgIf, DatetimePipe, DurationPipe],
  standalone: true
})
export class SouthDataComponent implements OnInit, OnDestroy {
  @Input() southConnector!: SouthConnectorDTO;

  connectorMetrics: ConnectorMetrics | null = null;
  connectorStream: EventSource | null = null;

  constructor(private windowService: WindowService, private cd: ChangeDetectorRef) {}

  ngOnInit(): void {
    const token = this.windowService.getStorageItem('oibus-token');

    this.connectorStream = new EventSource(`/sse/south/${this.southConnector!.id}?token=${token}`, { withCredentials: true });
    this.connectorStream.onmessage = (event: MessageEvent) => {
      if (event && event.data) {
        this.connectorMetrics = JSON.parse(event.data);
        this.cd.detectChanges();
      }
    };
  }

  ngOnDestroy() {
    this.connectorStream?.close();
  }
}
