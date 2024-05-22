import { Component } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FormBuilder, Validators } from '@angular/forms';
import { ObservableState, SaveButtonComponent } from '../../shared/save-button/save-button.component';
import { TranslateModule } from '@ngx-translate/core';
import { formDirectives } from '../../shared/form-directives';
import { SouthConnectorDTO } from '../../../../../shared/model/south-connector.model';
import { NgForOf, NgIf } from '@angular/common';
import { OIBusSubscription } from '../../../../../shared/model/subscription.model';

@Component({
  selector: 'oib-create-north-subscription-modal',
  templateUrl: './create-north-subscription-modal.component.html',
  styleUrl: './create-north-subscription-modal.component.scss',
  imports: [...formDirectives, TranslateModule, SaveButtonComponent, NgForOf, NgIf],
  standalone: true
})
export class CreateNorthSubscriptionModalComponent {
  state = new ObservableState();
  southConnectors: Array<SouthConnectorDTO> = [];
  form = this.fb.group({
    southConnector: [null as SouthConnectorDTO | null, Validators.required]
  });

  constructor(
    private modal: NgbActiveModal,
    private fb: FormBuilder
  ) {}

  /**
   * Prepares the component for creation.
   */
  prepareForCreation(connectors: Array<SouthConnectorDTO>) {
    this.southConnectors = connectors;
  }

  cancel() {
    this.modal.dismiss();
  }

  save() {
    if (!this.form.valid) {
      return;
    }

    const formValue = this.form.value;
    const command: OIBusSubscription = {
      type: 'south',
      subscription: formValue.southConnector!
    };
    this.modal.close(command);
  }
}
