import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective } from '@ngx-translate/core';

import { FileCacheContent } from '@oibus/shared/domain/engine.model';

import { FileSizePipe } from '../../../file-size.pipe';
import { OibCodeBlockComponent } from '../../../form/oib-code-block/oib-code-block.component';

@Component({
  selector: 'oib-file-content-modal',
  imports: [TranslateDirective, OibCodeBlockComponent, FileSizePipe],
  templateUrl: './file-content-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './file-content-modal.component.scss'
})
export class FileContentModalComponent {
  private readonly modal = inject(NgbActiveModal);

  readonly codeBlock = viewChild.required<OibCodeBlockComponent>('codeBlock');
  readonly filename = signal('');
  readonly fileCacheContent = signal<FileCacheContent | null>(null);

  prepare(filename: string, fileCacheContent: FileCacheContent) {
    this.filename.set(filename);
    this.fileCacheContent.set(fileCacheContent);

    this.codeBlock().changeLanguage(fileCacheContent.truncated ? 'raw' : fileCacheContent.contentType);
    this.codeBlock().writeValue(fileCacheContent.content);
  }

  dismiss() {
    this.modal.dismiss();
  }
}
