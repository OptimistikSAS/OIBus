import { debounceTime, distinctUntilChanged, map, Observable } from 'rxjs';

export const TYPEAHEAD_DEBOUNCE_TIME = 200;
/**
 * ng-bootstrap has a live announcer for the results of the typeahead.
 * It has a 100ms delay, and is not configurable.
 * We sometimes need to wait for this delay in tests to avoid the "1 task still pending" error.
 */
export const NGB_ARIA_LIVE_DELAY = 200;

/**
 * Creates a typeahead function (the one passed as input to the ngbTypeahead directive) based on an in-memory
 * array of elements.
 * The items match if their label contains the given text (ignoring case).
 * If there are more than max suggestions, the shorter ones are selected (because the other ones can be found by
 * typing more characters).
 * The returned suggestions are then sorted by their label.
 * @param listSupplier the function allowing to get the in-memory list (it's called every time, in case the in-memory
 * list must be filtered before being used as a source for the typeahead)
 * @param toLabelFunction the function used to get the label to search the text into
 * @param max: the max number of returned suggestions (default to 10)
 */
export function inMemoryTypeahead<T>(
  listSupplier: () => ReadonlyArray<T>,
  toLabelFunction: (item: T) => string,
  max = 10
): (text$: Observable<string>) => Observable<Array<T>> {
  return text$ =>
    text$.pipe(
      debounceTime(TYPEAHEAD_DEBOUNCE_TIME),
      distinctUntilChanged(),
      map(text => findSuggestions(text, listSupplier(), toLabelFunction, max))
    );
}

export function findSuggestions<T>(text: string, list: ReadonlyArray<T>, toLabelFunction: (item: T) => string, max = 10) {
  let filteredList = list.filter(item => toLabelFunction(item).toLowerCase().includes(text.toLowerCase()));
  if (filteredList.length > max) {
    filteredList.sort((item1, item2) => {
      const item1Label = toLabelFunction(item1);
      const item2Label = toLabelFunction(item2);
      return item1Label.length - item2Label.length;
    });
    filteredList = filteredList.slice(0, max);
  }
  filteredList.sort((item1, item2) => {
    const item1Label = toLabelFunction(item1);
    const item2Label = toLabelFunction(item2);
    return item1Label < item2Label ? -1 : item1Label > item2Label ? 1 : 0;
  });
  return filteredList.length <= max ? filteredList : filteredList.slice(0, max);
}
