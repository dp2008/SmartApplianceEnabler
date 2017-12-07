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

import {Component, OnInit, ViewChild} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {ControlFactory} from './control-factory';
import {Switch} from './switch';
import {ModbusSwitch} from './modbus-switch';
import {HttpSwitch} from './http-switch';
import {StartingCurrentSwitch} from './starting-current-switch';
import {NgForm} from '@angular/forms';
import {ControlErrorMessages} from './control-error-messages';
import {ErrorMessageHandler} from '../shared/error-message-handler';
import {TranslateService} from '@ngx-translate/core';
import {ErrorMessages} from '../shared/error-messages';
import {InputValidatorPatterns} from '../shared/input-validator-patterns';
import {AlwaysOnSwitch} from './always-on-switch';
import {AppliancesReloadService} from '../appliance/appliances-reload-service';
import {ControlDefaults} from './control-defaults';
import {ControlService} from './control-service';
import {Control} from './control';

@Component({
  selector: 'app-appliance-switch',
  templateUrl: './control.component.html',
  styles: []
})
export class ControlComponent implements OnInit {
  @ViewChild('controlForm') controlForm: NgForm;
  applianceId: string;
  controlDefaults: ControlDefaults;
  control = ControlFactory.createEmptyControl();
  errors: { [key: string]: string } = {};
  errorMessages: ErrorMessages;
  TYPE_ALWAYS_ON_SWITCH = AlwaysOnSwitch.TYPE;
  TYPE_SWITCH = Switch.TYPE;
  TYPE_MODBUS_SWITCH = ModbusSwitch.TYPE;
  TYPE_HTTP_SWITCH = HttpSwitch.TYPE;
  VALIDATOR_PATTERN_INTEGER = InputValidatorPatterns.INTEGER;
  VALIDATOR_PATTERN_URL = InputValidatorPatterns.URL;

  constructor(private controlService: ControlService,
              private appliancesReloadService: AppliancesReloadService,
              private route: ActivatedRoute,
              private translate: TranslateService) {
    this.errorMessages =  new ControlErrorMessages(this.translate);
  }

  ngOnInit() {
    this.route.paramMap.subscribe(() => this.applianceId = this.route.snapshot.paramMap.get('id'));
    this.route.data.subscribe((data: {control: Control, controlDefaults: ControlDefaults}) => {
      this.control = data.control;
      this.controlDefaults = data.controlDefaults;
      this.controlForm.form.markAsPristine();
    });
    this.controlForm.statusChanges.subscribe(() =>
      this.errors = ErrorMessageHandler.applyErrorMessages4TemplateDrivenForm(this.controlForm, this.errorMessages));
  }

  typeChanged(newType: string) {
    if (newType === this.TYPE_ALWAYS_ON_SWITCH && this.control.alwaysOnSwitch == null) {
      this.control.alwaysOnSwitch = new AlwaysOnSwitch();
    } else if (newType === this.TYPE_SWITCH && this.control.switch_ == null) {
      this.control.switch_ = new Switch();
    } else if (newType === this.TYPE_MODBUS_SWITCH && this.control.modbusSwitch == null) {
      this.control.modbusSwitch = new ModbusSwitch();
    } else if (newType === this.TYPE_HTTP_SWITCH && this.control.httpSwitch == null) {
      this.control.httpSwitch = new HttpSwitch();
    }
  }

  startingCurrentDetectionChanged(startingCurrentDetection: boolean) {
    if (startingCurrentDetection) {
      this.control.startingCurrentSwitch = new StartingCurrentSwitch();
    }
  }

  isStartingCurrentDetectedDisabled(): boolean {
    if (this.controlForm.form.contains('controlType')) {
      return  this.controlForm.form.controls.controlType.value === this.TYPE_ALWAYS_ON_SWITCH;
    }
    return false;
  }

  submitForm() {
    this.controlService.updateControl(this.control, this.applianceId).subscribe(() => this.appliancesReloadService.reload());
    this.controlForm.form.markAsPristine();
  }
}
