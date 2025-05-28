import { NgbTypeahead } from '@ng-bootstrap/ng-bootstrap';
import { OpenTypeaheadOnFocusDirective } from './open-typeahead-on-focus.directive';
import { NonEditableTypeaheadDirective } from './non-editable-typeahead.directive';

/**
 * This array contains all the typeahead directives that are used in the application.
 * As they must be used together, it is easier to import them all at once (and be sure we don't forget one).
 * ESLint makes sure that they can't be imported individually.
 */
export const OI_TYPEAHEAD_DIRECTIVES = [NgbTypeahead, OpenTypeaheadOnFocusDirective, NonEditableTypeaheadDirective];
