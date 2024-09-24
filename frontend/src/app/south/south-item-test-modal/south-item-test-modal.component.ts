import { Component, ViewChild, AfterViewInit } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { OibCodeBlockComponent } from '../../shared/form/oib-code-block/oib-code-block.component';
import { MonacoEditorLoaderService } from '../../shared/form/oib-code-block/monaco-editor-loader.service';
import { OIBusContent } from '../../../../../shared/model/engine.model';
import { SouthConnectorItemDTO } from '../../../../../shared/model/south-connector.model';
import { TranslateModule } from '@ngx-translate/core';
import { LoadingSpinnerComponent } from '../../shared/loading-spinner/loading-spinner.component';

@Component({
  selector: 'oib-south-item-test-modal',
  templateUrl: './south-item-test-modal.component.html',
  styleUrl: './south-item-test-modal.component.scss',
  imports: [OibCodeBlockComponent, TranslateModule, LoadingSpinnerComponent],
  standalone: true
})
export class SouthItemTestModalComponent implements AfterViewInit {
  @ViewChild('monacoEditor') codeBlock: OibCodeBlockComponent = new OibCodeBlockComponent(new MonacoEditorLoaderService());
  result: OIBusContent | null = null;
  item: SouthConnectorItemDTO | null = null;
  contentType = 'plaintext';

  constructor(private modal: NgbActiveModal) {}

  prepare(result: OIBusContent, item: SouthConnectorItemDTO) {
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
