import { Provider } from '@angular/core';

import { NgbConfig } from '@ng-bootstrap/ng-bootstrap';

const NO_ANIMATION_NGB_CONFIG: NgbConfig = { animation: false };

export const noAnimation: Provider = { provide: NgbConfig, useValue: NO_ANIMATION_NGB_CONFIG };

export function byIdComparisonFn(o1: { id: string } | null, o2: { id: string } | null): boolean {
  return (!o1 && !o2) || (o1 != null && o2 != null && o1.id === o2.id);
}
