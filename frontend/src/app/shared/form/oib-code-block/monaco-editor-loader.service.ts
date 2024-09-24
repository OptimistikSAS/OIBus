import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class MonacoEditorLoaderService {
  /**
   * As the library is loaded asynchronously via AMD, the method returns a promise
   * that resolves when the loading is done (which takes some time the first time, but is immediate after that).
   */
  loadMonacoEditor(): Promise<void> {
    return new Promise((resolve: () => void) => {
      if (typeof (window as any).monaco === 'object') {
        resolve();
        return;
      }
      const onAmdLoader: any = () => {
        // Load monaco
        (window as any).require.config({ paths: { vs: 'vendor/monaco-editor/vs' } });

        (window as any).require(['vs/editor/editor.main'], () => {
          resolve();
        });
      };

      // Load AMD loader if necessary
      if (!(window as any).require) {
        const loaderScript: HTMLScriptElement = document.createElement('script');
        loaderScript.type = 'text/javascript';
        loaderScript.src = 'vendor/monaco-editor/vs/loader.js';
        loaderScript.addEventListener('load', onAmdLoader);
        document.body.appendChild(loaderScript);
      } else {
        onAmdLoader();
      }
    });
  }
}
