import { Signal, signal } from '@angular/core';

/*
 * CodeMirror is big (about 570 kB): it is loaded on demand, only when an editor is displayed, and never imported statically
 * (enforced by ESLint), otherwise every page using an editor somewhere, even in a modal, would load it. The types can be
 * imported statically (`import type`), as they are erased at build time.
 */

export type CodeMirror = typeof import('./code-mirror');
export type CodeMirrorLanguages = typeof import('./code-mirror-languages');
export type CodeMirrorMerge = typeof import('@codemirror/merge');

/** Loads modules once, and keeps them to give them synchronously afterwards */
export interface ModulesLoader<T> {
  (): Promise<T>;
  /** The modules, null until they are loaded */
  readonly loaded: T | null;
}

function cache<T>(load: () => Promise<T>): ModulesLoader<T> {
  let loading: Promise<T> | null = null;
  let loaded: T | null = null;
  const loader = () => (loading ??= load().then(modules => (loaded = modules)));
  return Object.defineProperty(loader, 'loaded', { get: () => loaded }) as ModulesLoader<T>;
}

/** The core: the editor, its basic setup and the JSON language */
export const loadCodeMirror = cache((): Promise<CodeMirror> => import('./code-mirror'));
/** The other languages of the code editor: JavaScript/TypeScript and SQL */
export const loadCodeMirrorLanguages = cache((): Promise<CodeMirrorLanguages> => import('./code-mirror-languages'));
/** The merge views, to display a diff */
export const loadCodeMirrorMerge = cache((): Promise<CodeMirrorMerge> => import('@codemirror/merge'));

type LoadedModules<T extends Array<ModulesLoader<unknown>>> = { [K in keyof T]: T[K] extends ModulesLoader<infer M> ? M : never };

/**
 * Loads modules on demand into a signal, null until they are all loaded: a component creates its editor in an effect reading
 * it, once the modules are there. Modules already loaded are given right away, so the editor is created in the first render.
 */
export function loadOnDemand<T extends Array<ModulesLoader<unknown>>>(...loaders: T): Signal<LoadedModules<T> | null> {
  const alreadyLoaded = loaders.map(loader => loader.loaded);
  if (alreadyLoaded.every(modules => modules !== null)) {
    return signal(alreadyLoaded as LoadedModules<T>).asReadonly();
  }
  const loaded = signal<LoadedModules<T> | null>(null);
  Promise.all(loaders.map(loader => loader())).then(modules => loaded.set(modules as LoadedModules<T>));
  return loaded.asReadonly();
}

/**
 * Loads the code editor in the background, when the browser is idle, so that it is already there when an editor is displayed.
 * The merge views are left on demand: they are only used to display an audit diff.
 */
export function prefetchCodeMirror(): void {
  const prefetch = () => Promise.all([loadCodeMirror(), loadCodeMirrorLanguages()]).catch(() => {});
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(prefetch, { timeout: 5000 });
  } else {
    setTimeout(prefetch, 2000);
  }
}
