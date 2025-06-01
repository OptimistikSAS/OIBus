import { Component, inject } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ObservableState, SaveButtonComponent } from '../../../shared/save-button/save-button.component';
import { TranslateDirective } from '@ngx-translate/core';
import { SouthConnectorLightDTO } from '../../../../../../backend/shared/model/south-connector.model';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../../../shared/form/form-validation-directives';

@Component({
  selector: 'oib-create-north-subscription-modal',
  templateUrl: './create-north-subscription-modal.component.html',
  styleUrl: './create-north-subscription-modal.component.scss',
  imports: [ReactiveFormsModule, TranslateDirective, SaveButtonComponent, OI_FORM_VALIDATION_DIRECTIVES]
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
