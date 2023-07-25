import { Component } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FormBuilder, Validators } from '@angular/forms';
import { ObservableState, SaveButtonComponent } from '../../shared/save-button/save-button.component';
import { TranslateModule } from '@ngx-translate/core';
import { formDirectives } from '../../shared/form-directives';
import { SouthConnectorDTO } from '../../../../../shared/model/south-connector.model';
import { NorthConnectorService } from '../../services/north-connector.service';
import { NgForOf, NgIf } from '@angular/common';
import { ExternalSourceDTO } from '../../../../../shared/model/external-sources.model';
import { tap } from 'rxjs';
import { NotificationService } from '../../shared/notification.service';

@Component({
  selector: 'oib-create-north-subscription-modal',
  templateUrl: './create-north-subscription-modal.component.html',
  styleUrls: ['./create-north-subscription-modal.component.scss'],
  imports: [...formDirectives, TranslateModule, SaveButtonComponent, NgForOf, NgIf],
  standalone: true
})
export class CreateNorthSubscriptionModalComponent {
  state = new ObservableState();
  southConnectors: Array<SouthConnectorDTO> = [];
  externalSources: Array<ExternalSourceDTO> = [];
  northId = '';
  form = this.fb.group({
    type: ['south' as 'south' | 'external-source', Validators.required],
    southConnector: [null as SouthConnectorDTO | null, Validators.required],
    externalSource: [null as ExternalSourceDTO | null, Validators.required]
  });

  constructor(
    private modal: NgbActiveModal,
    private fb: FormBuilder,
    private notificationService: NotificationService,
    private northConnectorService: NorthConnectorService
  ) {
    this.form.controls.externalSource.disable();
    this.form.controls.type.valueChanges.subscribe(value => {
      if (value === 'south') {
        this.form.controls.southConnector.enable();
        this.form.controls.externalSource.disable();
      } else {
        this.form.controls.southConnector.disable();
        this.form.controls.externalSource.enable();
      }
    });
  }

  /**
   * Prepares the component for creation.
   */
  prepareForCreation(northId: string, connectors: Array<SouthConnectorDTO>, externalSources: Array<ExternalSourceDTO>) {
    this.northId = northId;
    this.southConnectors = connectors;
    this.externalSources = externalSources;
    if (this.southConnectors.length === 0) {
      this.form.controls.southConnector.disable();
      this.form.patchValue({ type: 'external-source' });
    }
    if (this.externalSources.length === 0) {
      this.form.controls.externalSource.disable();
      this.form.patchValue({ type: 'south' });
    }
  }

  cancel() {
    this.modal.dismiss();
  }

  save() {
    if (!this.form.valid) {
      return;
    }

    const formValue = this.form.value;
    if (formValue.type === 'south') {
      this.northConnectorService
        .createNorthConnectorSubscription(this.northId, formValue.southConnector!.id)
        .pipe(
          tap(southConnector =>
            this.notificationService.success(`north.subscriptions.south.created`, {
              name: formValue.southConnector!.name
            })
          )
        )
        .subscribe(() => {
          this.modal.close();
        });
    } else {
      this.northConnectorService
        .createNorthConnectorExternalSubscription(this.northId, formValue.externalSource!.id)
        .pipe(
          tap(southConnector =>
            this.notificationService.success(`north.subscriptions.external-source.created`, {
              name: formValue.externalSource!.reference
            })
          )
        )
        .subscribe(() => {
          this.modal.close();
        });
    }
  }
}
