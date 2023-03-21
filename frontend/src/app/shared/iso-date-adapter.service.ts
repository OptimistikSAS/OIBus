import { Injectable } from '@angular/core';
import { NgbDateAdapter, NgbDateStruct } from '@ng-bootstrap/ng-bootstrap';
import { DateTime } from 'luxon';
import { LocalDate } from '../../../../shared/model/types';

/**
 * Takes an NgbDateStruct and transforms it to an ISO date string (yyyy-MM-dd). If the given date is falsy,
 * returns null.
 */
function dateToIso(date: NgbDateStruct | null): LocalDate | null {
  return date ? DateTime.utc(date.year, date.month, date.day).toISODate() : null;
}

/**
 * Takes an ISO date string (yyyy-MM-dd) and transforms it into an NgbDateStruct. If the given value is falsy,
 * returns null.
 */
function isoToDate(value: LocalDate | null): NgbDateStruct | null {
  if (value) {
    const date = DateTime.fromISO(value, { zone: 'utc' });
    if (!date.isValid) {
      return null;
    }
    return {
      year: date.year,
      month: date.month,
      day: date.day
    };
  }
  return null;
}

/**
 * Adapter for the ng-bootstrap date picker that allows an ISO string as the value of the datepicker
 */
@Injectable()
export class IsoDateAdapterService extends NgbDateAdapter<string> {
  fromModel(value: LocalDate | null): NgbDateStruct | null {
    return isoToDate(value);
  }

  toModel(date: NgbDateStruct | null): LocalDate | null {
    return dateToIso(date);
  }
}
