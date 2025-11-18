import { InjectionToken } from '@angular/core';

export type OibusFormMode = 'create' | 'edit';

export const OIBUS_FORM_MODE = new InjectionToken<() => OibusFormMode>('OIBUS_FORM_MODE', {
  factory: () => () => 'create'
});
