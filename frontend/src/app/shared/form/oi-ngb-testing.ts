import { Provider } from '@angular/core';
import { NgbConfig } from '@ng-bootstrap/ng-bootstrap';
import { provideNgbConfig } from './oi-ngb';

const NO_ANIMATION_NGB_CONFIG: NgbConfig = { animation: false };

/**
 * Providers to use in tests when we need ng-bootstrap.
 * It's the same as using `provideNgbConfig()`, but disables the animations.
 */
export function provideNgbConfigTesting(): Array<Provider> {
  return [provideNgbConfig(), { provide: NgbConfig, useValue: NO_ANIMATION_NGB_CONFIG }];
}
