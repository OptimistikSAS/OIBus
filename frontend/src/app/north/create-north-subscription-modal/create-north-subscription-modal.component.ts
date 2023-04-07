import { Component } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FormBuilder, Validators } from '@angular/forms';
import { ObservableState, SaveButtonComponent } from '../../shared/save-button/save-button.component';
import { TranslateModule } from '@ngx-translate/core';
import { formDirectives } from '../../shared/form-directives';
import { SouthConnectorDTO } from '../../../../../shared/model/south-connector.model';
import { NorthConnectorService } from '../../services/north-connector.service';
import { NgForOf } from '@angular/common';

@Component({
  selector: 'oib-create-north-subscription-modal',
  templateUrl: './create-north-subscription-modal.component.html',
  styleUrls: ['./create-north-subscription-modal.component.scss'],
  imports: [...formDirectives, TranslateModule, SaveButtonComponent, NgForOf],
  standalone: true
})
export class CreateNorthSubscriptionModalComponent {
  state = new ObservableState();
  southConnectors: Array<SouthConnectorDTO> = [];
  northId = '';
  form = this.fb.group({
    southConnector: [null as SouthConnectorDTO | null, Validators.required]
  });

  constructor(private modal: NgbActiveModal, private fb: FormBuilder, private northConnectorService: NorthConnectorService) {}

  /**
   * Prepares the component for creation.
   */
  prepareForCreation(northId: string, connectors: Array<SouthConnectorDTO>) {
    this.southConnectors = connectors;
    this.northId = northId;
  }

  cancel() {
    this.modal.dismiss();
  }

  save() {
    if (!this.form.valid) {
      return;
    }

    const formValue = this.form.value;
    this.northConnectorService.createNorthConnectorSubscription(this.northId, formValue.southConnector!.id).subscribe(() => {
      this.modal.close(formValue.southConnector);
    });
  }
}
