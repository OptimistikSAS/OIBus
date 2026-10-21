import { Signal } from '@angular/core';
import { AbstractControl } from '@angular/forms';

import { compareSettings, countChanges, SettingSummary } from '../../shared/form/oibus-settings-summary/settings-summary';
import { WizardSteps } from '../../shared/modal-steps/wizard-steps';

/** The steps of the south and history item modals, in order: the settings come first, to be tested right away */
export const ITEM_MODAL_STEPS = ['settings', 'general', 'review'] as const;
export type ItemModalStep = (typeof ITEM_MODAL_STEPS)[number];

/** An item as summed up in the Review step: its general settings, and the settings of its connector type */
export interface ItemSummary {
  general: Array<SettingSummary>;
  settings: Array<SettingSummary>;
}

/** How many settings of an item changed since it was saved */
export function countItemChanges(summary: ItemSummary, saved: ItemSummary): number {
  return countChanges(compareSettings(summary.general, saved.general)) + countChanges(compareSettings(summary.settings, saved.settings));
}

/** The navigation between the steps of the item modals */
export class ItemModalSteps extends WizardSteps<ItemModalStep> {
  /**
   * @param controlsOf the controls edited in a step
   * @param formEvents changes on every change of the form, so that the invalid steps are kept up to date
   */
  constructor(controlsOf: (step: ItemModalStep) => Array<AbstractControl>, formEvents: Signal<unknown>) {
    super(ITEM_MODAL_STEPS, controlsOf, formEvents);
  }
}
