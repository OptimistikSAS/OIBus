import { Component, ComponentRef, InputSignal, OnInit, output, viewChild, ViewContainerRef } from '@angular/core';
import { OIBusContent } from '../../../../../../../backend/shared/model/engine.model';
import { ItemTestTableResultComponent } from './item-test-table-result/item-test-table-result.component';
import { ItemTestCodeblockResultComponent } from './item-test-codeblock-result/item-test-codeblock-result.component';
import { LoadingSpinnerComponent } from '../../../../shared/loading-spinner/loading-spinner.component';
import { TranslatePipe } from '@ngx-translate/core';

export type ContentDisplayMode = 'table' | 'any' | 'json';

type ComponentInputs<T> = {
  [P in keyof T as T[P] extends InputSignal<any> ? P : never]: T[P] extends InputSignal<infer A> ? A : never;
};

@Component({
  selector: 'oib-item-test-result',
  templateUrl: './item-test-result.component.html',
  styleUrl: './item-test-result.component.scss',
  imports: [LoadingSpinnerComponent, TranslatePipe]
})
export class ItemTestResultComponent implements OnInit {
  // Internal data
  result: OIBusContent | null = null;
  message: { type: `${'item' | 'display-result'}-error` | 'info'; value: string } | null = null;
  isLoading = false;

  // Component management
  readonly resultView = viewChild.required('resultView', { read: ViewContainerRef });
  readonly resultComponents = {
    table: {
      ref: {} as ComponentRef<ItemTestTableResultComponent>,
      class: ItemTestTableResultComponent,
      inputs: {} as ComponentInputs<ItemTestTableResultComponent>
    },
    codeblock: {
      ref: {} as ComponentRef<ItemTestCodeblockResultComponent>,
      class: ItemTestCodeblockResultComponent,
      inputs: {} as ComponentInputs<ItemTestCodeblockResultComponent>
    }
  };
  activeComponentIdentifier!: keyof typeof this.resultComponents;

  // External data
  readonly currentDisplayMode = output<ContentDisplayMode | null>();
  private _currentDisplayMode: ContentDisplayMode | null = null;

  readonly availableDisplayModes = output<Array<ContentDisplayMode>>();
  private _availableDisplayModes: Array<ContentDisplayMode> = [];

  readonly displayModeIcons: Record<ContentDisplayMode, string> = { table: 'fa-table', any: 'fa-file-text', json: 'fa-code' };

  ngOnInit(): void {
    // Instantiate component refs
    for (const [_, component] of Object.entries(this.resultComponents)) {
      component.ref = this.resultView().createComponent<any>(component.class);
      this.resultView().detach();
    }
  }

  displayResult(result: OIBusContent | undefined = undefined) {
    this.message = null;
    this.isLoading = false;
    if (result) {
      this.result = result;
    }

    if (!this.result) {
      return;
    }

    // Set the default display mode
    if (!this._currentDisplayMode) {
      this.updateAvailableDisplayModes(this.result);
      this.changeDisplayMode(this._availableDisplayModes[0]);
    }

    switch (this._currentDisplayMode) {
      case 'table':
        this.changeActiveComponent('table', { content: { ...this.result } });
        break;

      case 'json':
        this.changeActiveComponent('codeblock', { content: { ...this.result }, contentType: 'json' });
        break;

      case 'any':
        this.changeActiveComponent('codeblock', { content: { ...this.result }, contentType: 'plaintext' });
        break;
    }
  }

  displayError(message: string, type: `${'item' | 'display-result'}-error` = 'item-error') {
    this.removeActiveComponent();
    this.isLoading = false;

    if (type === 'item-error') {
      this.result = null;
      this.changeAvailableDisplayModes([]);
      this.changeDisplayMode(null);
    }

    this.message = { value: message, type };
  }

  displayInfo(message: string) {
    this.removeActiveComponent();
    this.result = null;
    this.isLoading = false;
    this.changeAvailableDisplayModes([]);
    this.changeDisplayMode(null);
    this.message = { value: message, type: 'info' };
  }

  displayLoading() {
    this.removeActiveComponent();
    this.result = null;
    this.message = null;
    this.isLoading = true;
  }

  changeDisplayMode(newMode: ContentDisplayMode | null) {
    this._currentDisplayMode = newMode;
    this.currentDisplayMode.emit(newMode);
  }

  get currentDisplayModeIcon() {
    if (this._currentDisplayMode) {
      return this.displayModeIcons[this._currentDisplayMode];
    }

    return '';
  }

  private updateAvailableDisplayModes(content: OIBusContent) {
    const available = new Set<ContentDisplayMode>();

    for (const component of Object.values(this.resultComponents)) {
      const supportedModes = component.ref.instance.getSupportedDisplayModes(content);
      if (supportedModes) {
        supportedModes.forEach(available.add, available);
      }
    }

    this.changeAvailableDisplayModes([...available]);
  }

  private changeAvailableDisplayModes(modes: Array<ContentDisplayMode>) {
    this._availableDisplayModes = modes;
    this.availableDisplayModes.emit(modes);
  }

  private removeActiveComponent() {
    if (this.resultView().length) {
      this.resultComponents[this.activeComponentIdentifier].ref.instance.cleanup();
      this.resultView().detach();
    }
  }

  private changeActiveComponent<
    TIdentifier extends keyof typeof this.resultComponents,
    TInstance extends (typeof this.resultComponents)[TIdentifier]
  >(identifier: TIdentifier, inputs: TInstance['inputs']) {
    try {
      this.removeActiveComponent();

      // Set input values
      for (const [key, value] of Object.entries(inputs)) {
        this.resultComponents[identifier].ref.setInput(key, value);
      }

      // Detect changes triggered by the previous input changes
      this.resultComponents[identifier].ref.changeDetectorRef.detectChanges();

      // Catch specific errors from components
      if (this.resultComponents[identifier].ref.instance.errorMessage) {
        this.displayError(this.resultComponents[identifier].ref.instance.errorMessage, 'display-result-error');
        return;
      }

      // Add to the DOM
      this.resultView().insert(this.resultComponents[identifier].ref.hostView);
      this.activeComponentIdentifier = identifier;
    } catch (error: any) {
      // Catch general or unexpected errors
      this.displayError(error.message, 'display-result-error');
    }
  }
}
