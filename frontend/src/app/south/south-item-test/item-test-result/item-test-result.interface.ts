import { InputSignal } from '@angular/core';
import { OIBusContent } from '../../../../../../backend/shared/model/engine.model';
import { ContentDisplayMode } from './item-test-result.component';

export interface BaseItemTestResult {
  /** The data that will be displayed */
  content: InputSignal<OIBusContent>;

  /** In case there is any error while displaying the data */
  errorMessage: string | null;

  /**
   * Returns an array of supported display modes based on the content.
   * Null is returned If no display modes are supported.
   */
  getSupportedDisplayModes(content: OIBusContent): Array<ContentDisplayMode> | null;

  /**
   * This function runs when the view is removed from the DOM.
   * It's implementation should free up any custom views or internal data.
   */
  cleanup(): void;
}
