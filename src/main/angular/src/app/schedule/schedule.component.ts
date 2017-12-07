/*
Copyright (C) 2017 Axel Müller <axel.mueller@avanux.de>

This program is free software; you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation; either version 2 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License along
with this program; if not, write to the Free Software Foundation, Inc.,
51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.
*/

import {AfterViewChecked, AfterViewInit, Component, OnInit} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {Schedule} from './schedule';
import {FormArray, FormBuilder, FormControlName, FormGroup, Validators} from '@angular/forms';
import {ConsecutiveDaysTimeframe} from './consecutive-days-timeframe';
import {DayTimeframe} from './day-timeframe';
import {ErrorMessages} from '../shared/error-messages';
import {TranslateService} from '@ngx-translate/core';
import {ScheduleErrorMessages} from './schedule-error-messages';
import {ErrorMessageHandler} from '../shared/error-message-handler';
import {ScheduleFactory} from './schedule-factory';
import {ScheduleService} from './schedule-service';
import {InputValidatorPatterns} from '../shared/input-validator-patterns';

declare const $: any;

/**
 * The time set by clock picker is displayed in input field but not set in the form model.
 * Since there is no direct access to the native element from the form control we have to add a hook to
 * propagate time changes on the native element to the form control.
 * Inspired by https://stackoverflow.com/questions/39642547/is-it-possible-to-get-native-element-for-formcontrol
 */
const originFormControlNameNgOnChanges = FormControlName.prototype.ngOnChanges;
FormControlName.prototype.ngOnChanges = function () {
  const result = originFormControlNameNgOnChanges.apply(this, arguments);
  this.control.nativeElement = this.valueAccessor._elementRef.nativeElement;

  const classAttribute: string = this.valueAccessor._elementRef.nativeElement.attributes.getNamedItem('class');
  if (classAttribute != null) {
    const classAttributeValues = classAttribute['nodeValue'];
    if (classAttributeValues.indexOf('clockpicker') > -1) {
      $(this.valueAccessor._elementRef.nativeElement).on('change', (event) => {
        this._control.setValue(event.target.value);
        this.control.markAsDirty();
      });
    }
  }
  return result;
};

@Component({
  selector: 'app-schedules',
  templateUrl: './schedule.component.html',
  styles: []
})
export class SchedulesComponent implements OnInit, AfterViewInit, AfterViewChecked {
  schedulesForm: FormGroup;
  applianceId: string;
  initializeOnceAfterViewChecked = false;
  DAY_TIMEFRAME = DayTimeframe.TYPE;
  CONSECUTIVE_DAYS_TIMEFRAME = ConsecutiveDaysTimeframe.TYPE;
  errors: { [key: string]: string } = {};
  errorMessages: ErrorMessages;

  constructor(private fb: FormBuilder,
              private scheduleService: ScheduleService,
              private route: ActivatedRoute,
              private translate: TranslateService) {
    this.errorMessages =  new ScheduleErrorMessages(this.translate);
  }

  ngOnInit() {
    this.initForm();
    this.route.paramMap.subscribe(() => this.applianceId = this.route.snapshot.paramMap.get('id'));
    this.route.data.subscribe((data: {schedules: Schedule[]}) => {
      this.initForm();
      const schedulesControl = <FormArray>this.schedulesForm.controls['schedules'];
      data.schedules.forEach(schedule => {
        const scheduleFormGroup = this.buildSchedule(schedule);
        schedulesControl.push(scheduleFormGroup);
      });
      this.initializeOnceAfterViewChecked = true;
    });
  }

  ngAfterViewInit() {
  }

  ngAfterViewChecked() {
    console.log('ngAfterViewChecked initializeOnceAfterViewChecked=' + this.initializeOnceAfterViewChecked);
    if (this.initializeOnceAfterViewChecked) {
      this.initializeOnceAfterViewChecked = false;
      this.initializeClockPicker();
      this.initializeDropdown();
    }
  }

  initializeDropdown() {
    $('.ui.dropdown').dropdown();
  }

  initializeClockPicker() {
    $('.clockpicker').clockpicker({ autoclose: true });
  }

  initForm() {
    this.schedulesForm = this.fb.group({schedules: new FormArray([])});
    this.schedulesForm.statusChanges.subscribe(() =>
      this.errors = ErrorMessageHandler.applyErrorMessages4ReactiveForm(this.schedulesForm,
        this.errorMessages, true, 'schedules.#.'));
  }

  buildSchedule(schedule: Schedule): FormGroup {
    const timeframeType = schedule != null ? schedule.timeframeType : this.DAY_TIMEFRAME;
    const scheduleFormGroup = this.fb.group({
      enabled: this.fb.control(schedule != null ? schedule.enabled : true),
      timeframeType: this.fb.control(timeframeType),
      dayTimeframe: timeframeType === this.DAY_TIMEFRAME ? this.buildDayTimeframe(schedule) : null,
      consecutiveDaysTimeframe: timeframeType === this.CONSECUTIVE_DAYS_TIMEFRAME ? this.buildConsecutiveDaysTimeframe(schedule) : null
    });
    scheduleFormGroup.get('timeframeType').valueChanges.forEach(
      (newTimeframeType) => {
        console.log('timeframeType changed to ' + newTimeframeType);
        if (newTimeframeType === this.DAY_TIMEFRAME) {
          scheduleFormGroup.removeControl('consecutiveDaysTimeframe');
          scheduleFormGroup.setControl(
            'dayTimeframe', this.buildDayTimeframe(schedule)
          );
        } else if (newTimeframeType === this.CONSECUTIVE_DAYS_TIMEFRAME) {
          scheduleFormGroup.removeControl('dayTimeframe');
          scheduleFormGroup.setControl(
            'consecutiveDaysTimeframe', this.buildConsecutiveDaysTimeframe(schedule)
          );
        }
        this.initializeOnceAfterViewChecked = true;
      }
    );
    return scheduleFormGroup;
  }

  buildDayTimeframe(schedule: Schedule): FormGroup {
    return this.fb.group({
      daysOfWeekValues: this.fb.control(
        this.hasDayTimeframe(schedule) ? schedule.dayTimeframe.daysOfWeekValues : []),
      startTime: this.fb.control(
        this.hasDayTimeframe(schedule) ? schedule.dayTimeframe.startTime : null,
        [Validators.required, Validators.pattern(InputValidatorPatterns.TIME_OF_DAY_24H)]),
      endTime: this.fb.control(
        this.hasDayTimeframe(schedule) ? schedule.dayTimeframe.endTime : null,
        [Validators.required, Validators.pattern(InputValidatorPatterns.TIME_OF_DAY_24H)]),
      minRunningTime: this.fb.control(
        this.hasDayTimeframe(schedule) ? schedule.minRunningTimeHHMM : null,
        [Validators.required, Validators.pattern(InputValidatorPatterns.TIME_OF_DAY_24H)]),
      maxRunningTime: this.fb.control(
        this.hasDayTimeframe(schedule) ? schedule.maxRunningTimeHHMM : null,
        Validators.pattern(InputValidatorPatterns.TIME_OF_DAY_24H)),
    });
  }

  hasDayTimeframe(schedule: Schedule): boolean {
    return schedule != null && schedule.dayTimeframe != null;
  }

  buildConsecutiveDaysTimeframe(schedule: Schedule): FormGroup {
    return this.fb.group({
      startDayOfWeek: this.fb.control(
        this.hasConsecutiveDaysTimeframe(schedule) ? schedule.consecutiveDaysTimeframe.startDayOfWeek : null,
        Validators.required),
      startTime: this.fb.control(
        this.hasConsecutiveDaysTimeframe(schedule) ? schedule.consecutiveDaysTimeframe.startTime : null,
        [Validators.required, Validators.pattern(InputValidatorPatterns.TIME_OF_DAY_24H)]),
      endDayOfWeek: this.fb.control(
        this.hasConsecutiveDaysTimeframe(schedule) ? schedule.consecutiveDaysTimeframe.endDayOfWeek : null,
        Validators.required),
      endTime: this.fb.control(
        this.hasConsecutiveDaysTimeframe(schedule) ? schedule.consecutiveDaysTimeframe.endTime : null,
        [Validators.required, Validators.pattern(InputValidatorPatterns.TIME_OF_DAY_24H)]),
      minRunningTime: this.fb.control(
        this.hasConsecutiveDaysTimeframe(schedule) ? schedule.minRunningTimeHHMM : null,
        [Validators.required, Validators.pattern(InputValidatorPatterns.TIME_OF_DAY_24H)]),
      maxRunningTime: this.fb.control(
        this.hasConsecutiveDaysTimeframe(schedule) ? schedule.maxRunningTimeHHMM : null,
        Validators.pattern(InputValidatorPatterns.TIME_OF_DAY_24H))
    });
  }

  hasConsecutiveDaysTimeframe(schedule: Schedule): boolean {
    return schedule != null && schedule.consecutiveDaysTimeframe != null;
  }

  getIndexedErrorMessage(key: string, index: number): string {
    const indexedKey = key + '.' + index.toString();
    return this.errors[indexedKey];
  }

  addSchedule() {
    const schedulesControl = <FormArray>this.schedulesForm.controls['schedules'];
    schedulesControl.push(this.buildSchedule(null));
    this.initializeOnceAfterViewChecked = true;
  }

  removeSchedule(index: number) {
    console.log('Remove ' + index);
    const schedulesControl = <FormArray>this.schedulesForm.controls['schedules'];
    schedulesControl.removeAt(index);
    this.schedulesForm.markAsDirty();
  }

  submitForm() {
    const schedules = ScheduleFactory.fromForm(this.schedulesForm.value);
    this.scheduleService.setSchedules(this.applianceId, schedules);
    this.schedulesForm.markAsPristine();
  }
}
