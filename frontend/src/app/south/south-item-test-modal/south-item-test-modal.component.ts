import { AfterViewInit, Component, inject, ViewChild } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { OibCodeBlockComponent } from '../../shared/form/oib-code-block/oib-code-block.component';
import { OIBusContent } from '../../../../../backend/shared/model/engine.model';
import { SouthConnectorItemCommandDTO, SouthConnectorItemDTO } from '../../../../../backend/shared/model/south-connector.model';
import { TranslateModule } from '@ngx-translate/core';
import { LoadingSpinnerComponent } from '../../shared/loading-spinner/loading-spinner.component';
import { SouthItemSettings } from '../../../../../backend/shared/model/south-settings.model';

@Component({
  selector: 'oib-south-item-test-modal',
  templateUrl: './south-item-test-modal.component.html',
  styleUrl: './south-item-test-modal.component.scss',
  imports: [OibCodeBlockComponent, TranslateModule, LoadingSpinnerComponent],
  standalone: true
})
export class SouthItemTestModalComponent implements AfterViewInit {
  private modal = inject(NgbActiveModal);

  @ViewChild('monacoEditor') codeBlock!: OibCodeBlockComponent;
  result: OIBusContent | null = null;
  item: SouthConnectorItemDTO<SouthItemSettings> | SouthConnectorItemCommandDTO<SouthItemSettings> | null = null;
  contentType = 'plaintext';

  prepare(result: OIBusContent, item: SouthConnectorItemDTO<SouthItemSettings> | SouthConnectorItemCommandDTO<SouthItemSettings>) {
    this.item = item;
    this.result = result;
    switch (this.result.type) {
      case 'time-values':
        this.contentType = 'json';
        break;
      case 'raw':
        this.contentType = 'plaintext';
        break;
    }
  }

  ngAfterViewInit() {
    if (!this.result) return;
    switch (this.result.type) {
      case 'time-values':
        this.codeBlock.writeValue(JSON.stringify(this.result.content));
        break;
      case 'raw':
        this.codeBlock.writeValue(this.result.content ?? this.result.filePath);
        break;
    }
  }

  close() {
    this.modal.close();
  }
}
