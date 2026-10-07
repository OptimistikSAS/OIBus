import { Provider } from '@angular/core';

import { noAnimation } from '../test-utils';
import { provideNgbConfig } from './oi-ngb';

/**
 * Providers to use in tests when we need ng-bootstrap.
 * It's the same as using `provideNgbConfig()`, but disables the animations.
 */
export function provideNgbConfigTesting(): Array<Provider> {
  return [provideNgbConfig(), noAnimation];
}
