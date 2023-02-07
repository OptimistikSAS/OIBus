export type Instant = string;
export type LocalDate = string;
export type LocalTime = string;
export type LocalDateTime = string;
export type Timezone = string;

export const DEFAULT_TZ: Timezone = 'Europe/Paris';

export const LANGUAGES = ['fr', 'en'];
export type Language = typeof LANGUAGES[number];

export interface Page<T> {
  /**
   * The content of the page
   */
  content: Array<T>;
  /**
   * The total number of elements
   */
  totalElements: number;

  /**
   * The size of the page, i.e. the max size of the array of elements
   */
  size: number;

  /**
   * The number of the page, starting at 0
   */
  number: number;

  /**
   * The total number of pages (which can be 0)
   */
  totalPages: number;
}

export function createPageFromArray<T>(allElements: Array<T>, pageSize: number, pageNumber: number): Page<T> {
  return {
    content: allElements.slice(pageNumber * pageSize, (pageNumber + 1) * pageSize),
    number: pageNumber,
    size: pageSize,
    totalElements: allElements.length,
    totalPages: Math.ceil(allElements.length / pageSize)
  };
}

export interface Interval {
  start: Instant;
  end: Instant;
}
