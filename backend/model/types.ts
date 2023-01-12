export type Instant = string;

export const Timezones = [
  "Etc/UTC",
  "Etc/GMT+12",
  "Pacific/Midway",
  "Pacific/Honolulu",
  "Pacific/Marquesas",
  "America/Anchorage",
  "Pacific/Pitcairn",
  "America/Los_Angeles",
  "America/Tijuana",
  "America/Chihuahua",
  "America/Denver",
  "America/Phoenix",
  "America/Chicago",
  "America/Guatemala",
  "America/Mexico_City",
  "America/Regina",
  "America/Bogota",
  "America/Indiana/Indianapolis",
  "America/New_York",
  "America/Caracas",
  "America/Guyana",
  "America/Halifax",
  "America/La_Paz",
  "America/Manaus",
  "America/Santiago",
  "America/St_Johns",
  "America/Argentina/Buenos_Aires",
  "America/Godthab",
  "America/Montevideo",
  "America/Sao_Paulo",
  "Atlantic/South_Georgia",
  "Atlantic/Azores",
  "Atlantic/Cape_Verde",
  "Africa/Casablanca",
  "Africa/Monrovia",
  "Europe/London",
  "Africa/Algiers",
  "Africa/Windhoek",
  "Europe/Belgrade",
  "Europe/Berlin",
  "Europe/Brussels",
  "Europe/Warsaw",
  "Africa/Cairo",
  "Africa/Harare",
  "Asia/Amman",
  "Asia/Beirut",
  "Asia/Jerusalem",
  "Europe/Athens",
  "Europe/Helsinki",
  "Europe/Minsk",
  "Europe/Paris",
  "Africa/Nairobi",
  "Asia/Baghdad",
  "Asia/Kuwait",
  "Europe/Moscow",
  "Asia/Tehran",
  "Asia/Baku",
  "Asia/Muscat",
  "Asia/Tbilisi",
  "Asia/Yerevan",
  "Asia/Kabul",
  "Asia/Karachi",
  "Asia/Tashkent",
  "Asia/Yekaterinburg",
  "Asia/Colombo",
  "Asia/Kolkata",
  "Asia/Kathmandu",
  "Asia/Dhaka",
  "Asia/Novosibirsk",
  "Asia/Rangoon",
  "Asia/Bangkok",
  "Asia/Krasnoyarsk",
  "Asia/Hong_Kong",
  "Asia/Irkutsk",
  "Asia/Kuala_Lumpur",
  "Asia/Taipei",
  "Australia/Perth",
  "Asia/Seoul",
  "Asia/Tokyo",
  "Asia/Yakutsk",
  "Australia/Adelaide",
  "Australia/Darwin",
  "Asia/Vladivostok",
  "Australia/Brisbane",
  "Australia/Hobart",
  "Australia/Sydney",
  "Pacific/Guam",
  "Australia/Lord_Howe",
  "Asia/Magadan",
  "Pacific/Norfolk",
  "Pacific/Auckland",
  "Pacific/Fiji",
  "Pacific/Tongatapu",
];

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

export function createPageFromArray<T>(
  allElements: Array<T>,
  pageSize: number,
  pageNumber: number
): Page<T> {
  return {
    content: allElements.slice(
      pageNumber * pageSize,
      (pageNumber + 1) * pageSize
    ),
    number: pageNumber,
    size: pageSize,
    totalElements: allElements.length,
    totalPages: Math.ceil(allElements.length / pageSize),
  };
}

export interface Interval {
  start: Instant;
  end: Instant;
}
