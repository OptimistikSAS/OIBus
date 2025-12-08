import { DateTimeType, Instant } from '../../../shared/model/types';
import { formatInstant } from '../../service/utils';

/**
 * Replace @StartTime and @EndTime variables in JSON body string
 * Supports both string replacement and date time field formatting
 */
export function replaceVariablesInJsonBody(
  body: string,
  startTime: Instant,
  endTime: Instant,
  dateTimeFields: Array<{
    useAsReference: boolean;
    type: DateTimeType;
    timezone?: string;
    format?: string;
    locale?: string;
  }>,
  bodyDateTimeConfig?: {
    type?: DateTimeType;
    timezone?: string;
    format?: string;
  }
): string {
  const referenceTimestampField = dateTimeFields.find(field => field.useAsReference);
  const formattedStartTime = bodyDateTimeConfig?.type
    ? formatInstant(startTime, {
        type: bodyDateTimeConfig.type,
        timezone: bodyDateTimeConfig.timezone,
        format: bodyDateTimeConfig.format,
        locale: 'en-En'
      })
    : referenceTimestampField
      ? formatInstant(startTime, {
          type: referenceTimestampField.type,
          timezone: referenceTimestampField.timezone,
          format: referenceTimestampField.format,
          locale: referenceTimestampField.locale
        })
      : startTime;
  const formattedEndTime = bodyDateTimeConfig?.type
    ? formatInstant(endTime, {
        type: bodyDateTimeConfig.type,
        timezone: bodyDateTimeConfig.timezone,
        format: bodyDateTimeConfig.format,
        locale: 'en-En'
      })
    : referenceTimestampField
      ? formatInstant(endTime, {
          type: referenceTimestampField.type,
          timezone: referenceTimestampField.timezone,
          format: referenceTimestampField.format,
          locale: referenceTimestampField.locale
        })
      : endTime;

  try {
    const parsed = JSON.parse(body);
    const replaced = replaceVariablesInObject(parsed, formattedStartTime, formattedEndTime);
    return JSON.stringify(replaced);
  } catch {
    let result = body;
    if (result.includes('@StartTime')) {
      result = result.replace(
        /@StartTime/g,
        typeof formattedStartTime === 'string' ? `"${formattedStartTime}"` : String(formattedStartTime)
      );
    }
    if (result.includes('@EndTime')) {
      result = result.replace(/@EndTime/g, typeof formattedEndTime === 'string' ? `"${formattedEndTime}"` : String(formattedEndTime));
    }
    return result;
  }
}

/**
 * Recursively replace @StartTime and @EndTime in an object
 */
function replaceVariablesInObject(obj: unknown, startTime: string | number, endTime: string | number): unknown {
  if (typeof obj === 'string') {
    let result = obj;
    if (result === '@StartTime') {
      return startTime;
    }
    if (result === '@EndTime') {
      return endTime;
    }
    if (result.includes('@StartTime')) {
      result = result.replace(/@StartTime/g, String(startTime));
    }
    if (result.includes('@EndTime')) {
      result = result.replace(/@EndTime/g, String(endTime));
    }
    return result;
  } else if (Array.isArray(obj)) {
    return obj.map(item => replaceVariablesInObject(item, startTime, endTime));
  } else if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = replaceVariablesInObject(value, startTime, endTime);
    }
    return result;
  }
  return obj;
}
