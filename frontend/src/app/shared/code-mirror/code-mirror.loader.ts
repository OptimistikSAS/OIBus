import { Signal, signal } from '@angular/core';

/*
 * CodeMirror is big (about 570 kB): it is loaded on demand, only when an editor is displayed, and never imported statically
 * (enforced by ESLint), otherwise every page using an editor somewhere, even in a modal, would load it. The types can be
 * imported statically (`import type`), as they are erased at build time.
 */

export type CodeMirror = typeof import('./code-mirror');
export type CodeMirrorLanguages = typeof import('./code-mirror-languages');
export type CodeMirrorMerge = typeof import('@codemirror/merge');

/** The core: the editor, its basic setup and the JSON language */
export const loadCodeMirror = (): Promise<CodeMirror> => import('./code-mirror');
/** The other languages of the code editor: JavaScript/TypeScript and SQL */
export const loadCodeMirrorLanguages = (): Promise<CodeMirrorLanguages> => import('./code-mirror-languages');
/** The merge views, to display a diff */
export const loadCodeMirrorMerge = (): Promise<CodeMirrorMerge> => import('@codemirror/merge');

/**
 * Loads modules on demand into a signal, null until they are loaded: a component creates its editor in an effect reading
 * it, once the modules are there.
 */
export function loadOnDemand<T>(load: () => Promise<T>): Signal<T | null> {
  const loaded = signal<T | null>(null);
  load().then(modules => loaded.set(modules));
  return loaded.asReadonly();
}
