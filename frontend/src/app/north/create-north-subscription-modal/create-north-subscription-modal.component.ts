import { Component, inject } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { ObservableState, SaveButtonComponent } from '../../shared/save-button/save-button.component';
import { TranslateModule } from '@ngx-translate/core';
import { formDirectives } from '../../shared/form-directives';
import { SouthConnectorLightDTO } from '../../../../../backend/shared/model/south-connector.model';

@Component({
  selector: 'oib-create-north-subscription-modal',
  templateUrl: './create-north-subscription-modal.component.html',
  styleUrl: './create-north-subscription-modal.component.scss',
  imports: [...formDirectives, TranslateModule, SaveButtonComponent],
  standalone: true
})
export class CreateNorthSubscriptionModalComponent {
  private modal = inject(NgbActiveModal);

  state = new ObservableState();
  southConnectors: Array<SouthConnectorLightDTO> = [];
  form = inject(NonNullableFormBuilder).group({
    southConnector: [null as SouthConnectorLightDTO | null, Validators.required]
  });

  /**
   * Prepares the component for creation.
   */
  prepareForCreation(connectors: Array<SouthConnectorLightDTO>) {
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
    this.modal.close(formValue.southConnector);
  }
}
