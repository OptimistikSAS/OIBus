import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective } from '@ngx-translate/core';

import { OIBusCommandDTO } from '@oibus/shared/oia/command.model';

import { BooleanEnumPipe } from '../../../shared/boolean-enum.pipe';
import { DatetimePipe } from '../../../shared/datetime.pipe';
import { OibusCommandTypeEnumPipe } from '../../../shared/oibus-command-type-enum.pipe';

@Component({
  selector: 'oib-oia-command-details-modal',
  templateUrl: './oia-command-details-modal.component.html',
  styleUrl: './oia-command-details-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [TranslateDirective, OibusCommandTypeEnumPipe, DatetimePipe, JsonPipe, BooleanEnumPipe]
})
export class OiaCommandDetailsModalComponent {
  private activeModal = inject(NgbActiveModal);

  command = signal<OIBusCommandDTO | null>(null);

  prepare(command: OIBusCommandDTO) {
    this.command.set(command);
  }

  close() {
    this.activeModal.dismiss();
  }
}
