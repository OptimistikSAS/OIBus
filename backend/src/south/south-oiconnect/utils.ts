import https from 'node:https';
import http from 'node:http';

import csv from 'papaparse';

import oiaTimeValues from './formatters/oia-time-values';
import slims from './formatters/slims';
import { Instant } from '../../../../shared/model/types';
import { DateTime } from 'luxon';

const parsers = new Map<string, (httpResults: any) => any>();
parsers.set('Raw', (httpResults: any) => ({ httpResults, latestDateRetrieved: new Date().toISOString() }));
parsers.set('OIAnalytics time values', oiaTimeValues);
parsers.set('SLIMS', slims);

/**
 * Some API such as SLIMS uses a body with GET. It's not standard and requires a specific implementation
 */
const httpGetWithBody = (body: string, options: any): Promise<void> =>
  new Promise((resolve, reject) => {
    const callback = (response: any) => {
      let str = '';
      response.on('data', (chunk: string) => {
        str += chunk;
      });
      response.on('end', () => {
        try {
          const parsedResult = JSON.parse(str);
          resolve(parsedResult);
        } catch (error) {
          reject(error);
        }
      });
    };

    const req = (options.protocol === 'https:' ? https : http).request(options, callback);
    req.on('error', e => {
      reject(e);
    });
    req.write(body);
    req.end();
  });

const formatQueryParams = (startTime: Instant, endTime: Instant, queryParams: Array<any>, variableDateFormat: 'ISO' | 'number'): string => {
  if (queryParams.length === 0) {
    return '';
  }
  let queryParamsString = '?';
  queryParams.forEach((queryParam, index) => {
    let value;
    switch (queryParam.queryParamValue) {
      case '@StartTime':
        value = variableDateFormat === 'ISO' ? DateTime.fromISO(startTime).toUTC().toISO() : DateTime.fromISO(startTime).toMillis();
        break;
      case '@EndTime':
        value = variableDateFormat === 'ISO' ? DateTime.fromISO(endTime).toUTC().toISO() : DateTime.fromISO(endTime).toMillis();
        break;
      default:
        value = queryParam.queryParamValue;
    }
    queryParamsString += `${encodeURIComponent(queryParam.queryParamKey)}=${encodeURIComponent(value)}`;
    if (index < queryParams.length - 1) {
      queryParamsString += '&';
    }
  });
  return queryParamsString;
};

/**
 * Generate CSV file from the values
 */
const generateCSV = (results: Array<any>, delimiter: string): string => {
  const options = {
    header: true,
    delimiter
  };
  return csv.unparse(results, options);
};

export { parsers, httpGetWithBody, formatQueryParams, generateCSV };
