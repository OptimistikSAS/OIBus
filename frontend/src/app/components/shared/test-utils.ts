import { Provider } from '@angular/core';
import { NgbConfig } from '@ng-bootstrap/ng-bootstrap';

const NO_ANIMATION_NGB_CONFIG: NgbConfig = { animation: false };

export const noAnimation: Provider = { provide: NgbConfig, useValue: NO_ANIMATION_NGB_CONFIG };
