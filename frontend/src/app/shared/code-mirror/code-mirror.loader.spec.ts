import { afterEach, describe, expect, test, vi } from 'vitest';

import { loadCodeMirror, loadCodeMirrorLanguages, loadCodeMirrorMerge, loadOnDemand, prefetchCodeMirror } from './code-mirror.loader';

// the loaders keep the modules for the whole application: the tests below depend on their order
describe('code mirror loader', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  test('should load the modules once and give them right away afterwards', async () => {
    expect(loadCodeMirror.loaded).toBeNull();
    expect(loadCodeMirror()).toBe(loadCodeMirror());

    const first = loadOnDemand(loadCodeMirror, loadCodeMirrorMerge);
    expect(first()).toBeNull();
    await vi.waitFor(() => expect(first()).not.toBeNull());
    const [core, merge] = first()!;
    expect(core.EditorView).toBeDefined();
    expect(merge.MergeView).toBeDefined();

    const second = loadOnDemand(loadCodeMirror, loadCodeMirrorMerge);
    expect(second()).toEqual([core, merge]);
  });

  test('should prefetch the editor when the browser is idle', async () => {
    const requestIdleCallback = vi.fn((callback: () => void) => callback());
    vi.stubGlobal('requestIdleCallback', requestIdleCallback);

    prefetchCodeMirror();

    expect(requestIdleCallback).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(loadCodeMirrorLanguages.loaded).not.toBeNull());
  });

  test('should prefetch the editor after a delay when the browser cannot tell when it is idle', () => {
    vi.stubGlobal('requestIdleCallback', undefined);
    vi.useFakeTimers();

    prefetchCodeMirror();

    expect(vi.getTimerCount()).toBe(1);
    vi.runAllTimers();
    expect(vi.getTimerCount()).toBe(0);
  });
});
