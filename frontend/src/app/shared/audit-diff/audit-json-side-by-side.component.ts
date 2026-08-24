import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterRenderEffect, inject, input, viewChild } from '@angular/core';
import { EditorView } from '@codemirror/view';
import { basicSetup } from 'codemirror';
import { json } from '@codemirror/lang-json';
import { MergeView } from '@codemirror/merge';

function toPrettyJson(state: Record<string, unknown> | null): string {
  return JSON.stringify(state ?? {}, null, 2);
}

/**
 * Displays the previous and new state of an audited entity as two full JSON panes side by side,
 * with differences between them highlighted.
 */
@Component({
  selector: 'oib-audit-json-side-by-side',
  templateUrl: './audit-json-side-by-side.component.html',
  styleUrl: './audit-json-side-by-side.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AuditJsonSideBySideComponent {
  readonly previousState = input.required<Record<string, unknown> | null>();
  readonly newState = input.required<Record<string, unknown> | null>();

  private readonly editorContainer = viewChild.required<ElementRef<HTMLDivElement>>('editor');
  private mergeView: MergeView | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.mergeView?.destroy());

    afterRenderEffect(() => {
      const container = this.editorContainer().nativeElement;
      const originalText = toPrettyJson(this.previousState());
      const newText = toPrettyJson(this.newState());

      this.mergeView?.destroy();
      this.mergeView = new MergeView({
        a: { doc: originalText, extensions: [basicSetup, EditorView.editable.of(false), json()] },
        b: { doc: newText, extensions: [basicSetup, EditorView.editable.of(false), json()] },
        gutter: true,
        parent: container
      });
    });
  }
}
