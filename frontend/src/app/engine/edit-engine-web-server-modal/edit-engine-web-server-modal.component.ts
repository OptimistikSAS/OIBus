import { Component, inject } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateDirective } from '@ngx-translate/core';
import { EngineService } from '../../services/engine.service';
import { NotificationService } from '../../shared/notification.service';
import { EngineSettingsDTO } from '../../../../../backend/shared/model/engine.model';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../../shared/form/form-validation-directives';
import { ModalService } from '../../shared/modal.service';
import { PortRedirectModalComponent } from '../../shared/port-redirect-modal/port-redirect-modal.component';

@Component({
  selector: 'oib-edit-engine-web-server-modal',
  templateUrl: './edit-engine-web-server-modal.component.html',
  styleUrl: './edit-engine-web-server-modal.component.scss',
  imports: [TranslateDirective, ReactiveFormsModule, OI_FORM_VALIDATION_DIRECTIVES]
})
export class EditEngineWebServerModalComponent {
  private modal = inject(NgbActiveModal);
  private engineService = inject(EngineService);
  private notificationService = inject(NotificationService);
  private modalService = inject(ModalService);

  form = inject(NonNullableFormBuilder).group({
    port: [null as number | null, Validators.required]
  });

  initialize(settings: EngineSettingsDTO) {
    this.form.patchValue({ port: settings.port });
  }

  save() {
    if (!this.form.valid) {
      return;
    }
    const { port } = this.form.getRawValue();
    this.engineService.updateEngineWebServer({ port: port! }).subscribe(result => {
      if (result.needsRedirect && result.newPort) {
        this.modal.close();
        const redirectModal = this.modalService.open(PortRedirectModalComponent, { backdrop: 'static', keyboard: false });
        redirectModal.componentInstance.initialize(result.newPort);
      } else {
        this.notificationService.success('engine.updated');
        this.modal.close();
      }
    });
  }

  cancel() {
    this.modal.dismiss();
  }
}
