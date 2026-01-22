import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class MonacoEditorLoaderService {
  private loadingPromise: Promise<void> | null = null;

  /**
   * As the library is loaded asynchronously via AMD, the method returns a promise
   * that resolves when the loading is done (which takes some time the first time, but is immediate after that).
   */
  loadMonacoEditor(): Promise<void> {
    // 1. If already loaded, resolve immediately
    if (typeof (window as any).monaco === 'object') {
      return Promise.resolve();
    }

    // 2. If currently loading, return the existing promise (Fixes the crash)
    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    // 3. Start loading and store the promise
    this.loadingPromise = new Promise((resolve: () => void) => {
      const onAmdLoader: any = () => {
        // Configure and load the main editor module
        (window as any).require.config({ paths: { vs: 'vendor/monaco-editor/vs' } }); // Use relative path often safer
        (window as any).require(['vs/editor/editor.main'], () => {
          resolve();
        });
      };

      // Check if AMD loader is already present in the window
      if (!(window as any).require) {
        const loaderScript: HTMLScriptElement = document.createElement('script');
        loaderScript.type = 'text/javascript';
        loaderScript.src = 'vendor/monaco-editor/vs/loader.js';
        loaderScript.id = 'oibus-monaco-loader';
        loaderScript.addEventListener('load', onAmdLoader);
        document.body.appendChild(loaderScript);
      } else {
        onAmdLoader();
      }
    });

    return this.loadingPromise;
  }
}
