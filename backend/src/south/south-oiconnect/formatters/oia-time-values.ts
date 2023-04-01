import { Instant } from '../../../../../shared/model/types';
import { DateTime } from 'luxon';

interface OIATimeValues {
  type: string;
  data?: {
    id: string;
    dataType: string;
    reference: string;
    description: string;
  };
  unit?: {
    id: string;
    label: string;
  };
  values: Array<number>;
  timestamps: Array<Instant>;
}
/**
 * check data from OIAnalytics API for result of
 * For now, only 'time-values' type is accepted
 * Expected data are : [
 *   {
 *     type: 'time-values',
 *     unit: { id: '2', label: '%' },
 *     data: {
 *       dataType: 'RAW_TIME_DATA',
 *       id: 'D4',
 *       reference: 'DCS_CONC_O2_MCT',
 *       description: 'Concentration O2 fermentation'
 *     },
 *     timestamps: ['2022-01-01T00:00:00Z', '2022-01-01T00:10:00Z'],
 *     values: [63.6414804414747,  87.2277880675425]
 *   },
 *   {
 *     type: 'time-values',
 *     unit: { id: '180', label: 'pH' },
 *     data: {
 *       dataType: 'RAW_TIME_DATA',
 *       id: 'D5',
 *       reference: 'DCS_PH_MCT',
 *       description: 'pH fermentation'
 *     },
 *     timestamps: ['2022-01-01T00:00:00Z', '2022-01-01T00:10:00Z'],
 *     values: [7.51604342731906,  7.5292481205665]
 *   }
 * ]
 * @param {Object} resultElement - the data resulting of an OIAnalytics time series API call
 * @return {void}
 */
const checkDataFormat = (resultElement: OIATimeValues) => {
  if (!resultElement.data?.reference) {
    throw Error('Bad data: expect data.reference field');
  }
  if (!resultElement.unit?.label) {
    throw Error('Bad data: expect unit.label field');
  }
  if (!Array.isArray(resultElement.values)) {
    throw Error('Bad data: expect values to be an array');
  }
  if (!Array.isArray(resultElement.timestamps)) {
    throw Error('Bad data: expect timestamps to be an array');
  }
};

/**
 * Parse data from OIAnalytics time values API
 * Return the formatted results flattened for easier access
 * (into csv files for example) and the latestDateRetrieved in ISO String format
 */
const format = (httpResult: Array<OIATimeValues>): { httpResults: Array<any>; latestDateRetrieved: Instant } => {
  if (!Array.isArray(httpResult)) {
    throw Error('Bad data: expect OIAnalytics time values to be an array');
  }
  const formattedData: Array<any> = [];
  let latestDateRetrieved = DateTime.fromMillis(0).toUTC().toISO();
  httpResult.forEach(element => {
    checkDataFormat(element);
    element.values.forEach((currentValue: any, index: number) => {
      formattedData.push({
        pointId: element.data!.reference,
        unit: element.unit!.label,
        timestamp: element.timestamps[index],
        value: currentValue
      });
      if (DateTime.fromISO(element.timestamps[index]).toUTC().toISO() > latestDateRetrieved) {
        latestDateRetrieved = DateTime.fromISO(element.timestamps[index]).toUTC().toISO();
      }
    });
  });
  return { httpResults: formattedData, latestDateRetrieved };
};

export default format;
