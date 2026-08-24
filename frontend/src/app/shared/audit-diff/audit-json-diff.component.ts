import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterRenderEffect, inject, input, viewChild } from '@angular/core';
import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { basicSetup } from 'codemirror';
import { json } from '@codemirror/lang-json';
import { unifiedMergeView } from '@codemirror/merge';

function toPrettyJson(state: Record<string, unknown> | null): string {
  return JSON.stringify(state ?? {}, null, 2);
}

/**
 * Displays a git-style unified diff between the previous and new state of an audited entity.
 * `previousState` is `null` for a CREATE action (renders fully green), `newState` is `null` for
 * a DELETE action (renders fully red).
 */
@Component({
  selector: 'oib-audit-json-diff',
  templateUrl: './audit-json-diff.component.html',
  styleUrl: './audit-json-diff.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AuditJsonDiffComponent {
  readonly previousState = input.required<Record<string, unknown> | null>();
  readonly newState = input.required<Record<string, unknown> | null>();

  private readonly editorContainer = viewChild.required<ElementRef<HTMLDivElement>>('editor');
  private editorView: EditorView | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.editorView?.destroy());

    afterRenderEffect(() => {
      const container = this.editorContainer().nativeElement;
      const originalText = toPrettyJson(this.previousState());
      const newText = toPrettyJson(this.newState());

      this.editorView?.destroy();
      this.editorView = new EditorView({
        state: EditorState.create({
          doc: newText,
          extensions: [
            basicSetup,
            EditorView.editable.of(false),
            json(),
            unifiedMergeView({ original: originalText, mergeControls: false, gutter: true })
          ]
        }),
        parent: container
      });
    });
  }
}
