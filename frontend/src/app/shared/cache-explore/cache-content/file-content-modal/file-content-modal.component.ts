import { ChangeDetectionStrategy, Component, inject, viewChild } from '@angular/core';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective } from '@ngx-translate/core';

import { FileCacheContent } from '@oibus/shared/domain/engine.model';

import { FileSizePipe } from '../../../file-size.pipe';
import { OibCodeBlockComponent } from '../../../form/oib-code-block/oib-code-block.component';

@Component({
  selector: 'oib-file-content-modal',
  imports: [TranslateDirective, OibCodeBlockComponent, FileSizePipe],
  templateUrl: './file-content-modal.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './file-content-modal.component.scss'
})
export class FileContentModalComponent {
  private modal = inject(NgbActiveModal);

  readonly codeBlock = viewChild.required<OibCodeBlockComponent>('codeBlock');
  filename = '';
  fileCacheContent: FileCacheContent | null = null;

  prepare(filename: string, fileCacheContent: FileCacheContent) {
    this.filename = filename;
    this.fileCacheContent = fileCacheContent;

    this.codeBlock().changeLanguage(this.fileCacheContent.truncated ? 'raw' : this.fileCacheContent.contentType);
    this.codeBlock().writeValue(this.fileCacheContent.content);
  }

  dismiss() {
    this.modal.dismiss();
  }
}
