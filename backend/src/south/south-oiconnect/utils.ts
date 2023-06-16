import https from 'node:https';
import http from 'node:http';

import oiaTimeValues from './formatters/oia-time-values';
import slims from './formatters/slims';
import { Instant } from '../../../../shared/model/types';
import { DateTime } from 'luxon';
import { OibusItemDTO } from '../../../../shared/model/south-connector.model';

const parsers = new Map<string, (item: OibusItemDTO, httpResults: any) => { formattedResult: Array<any>; maxInstant: Instant }>();
parsers.set('raw', (item: OibusItemDTO, httpResults: Array<any>) => ({
  formattedResult: httpResults as Array<any>,
  maxInstant: DateTime.now().toUTC().toISO()!
}));
parsers.set('oianalytics-time-values', oiaTimeValues);
parsers.set('slims', slims);

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

const formatQueryParams = (startTime: any, endTime: any, queryParams: Array<any>): string => {
  if (queryParams.length === 0) {
    return '';
  }
  let queryParamsString = '?';
  queryParams.forEach((queryParam, index) => {
    let value;
    switch (queryParam.queryParamValue) {
      case '@StartTime':
        value = startTime;
        break;
      case '@EndTime':
        value = endTime;
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

export { parsers, httpGetWithBody, formatQueryParams };
