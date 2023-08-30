import { Component } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { SaveButtonComponent } from '../../shared/save-button/save-button.component';
import { TranslateModule } from '@ngx-translate/core';
import { SouthConnectorCommandDTO, SouthConnectorDTO } from '../../../../../shared/model/south-connector.model';
import { NgForOf, NgIf } from '@angular/common';
import { FormComponent } from '../../shared/form/form.component';
import { SouthConnectorService } from '../../services/south-connector.service';
import { NorthConnectorCommandDTO, NorthConnectorDTO } from '../../../../../shared/model/north-connector.model';
import { NorthConnectorService } from '../../services/north-connector.service';

@Component({
  selector: 'oib-test-connection-result-modal',
  templateUrl: './test-connection-result-modal.component.html',
  styleUrls: ['./test-connection-result-modal.component.scss'],
  imports: [TranslateModule, SaveButtonComponent, NgForOf, NgIf, FormComponent],
  standalone: true
})
export class TestConnectionResultModalComponent {
  type: 'north' | 'south' | null = null;
  loading = false;
  success = false;
  error: string | null = null;
  connector: SouthConnectorDTO | NorthConnectorDTO | null = null;

  constructor(
    private modal: NgbActiveModal,
    private southConnectorService: SouthConnectorService,
    private northConnectorService: NorthConnectorService
  ) {}

  /**
   * Prepares the component for creation.
   */
  runTest(
    type: 'south' | 'north',
    connector: SouthConnectorDTO | NorthConnectorDTO | null,
    command: SouthConnectorCommandDTO | NorthConnectorCommandDTO
  ) {
    this.type = type;
    this.loading = true;
    this.connector = connector;
    let obs;
    if (type === 'south') {
      obs = this.southConnectorService.testConnection(this.connector?.id || 'create', command as SouthConnectorCommandDTO);
    } else {
      obs = this.northConnectorService.testConnection(this.connector?.id || 'create', command as NorthConnectorCommandDTO);
    }
    obs.subscribe({
      error: httpError => {
        this.error = httpError.error.message;
        this.loading = false;
      },
      next: () => {
        this.success = true;
        this.loading = false;
      }
    });
  }

  cancel() {
    this.modal.dismiss();
  }
}
