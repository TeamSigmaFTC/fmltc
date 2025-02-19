/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview The class for a dialog that starts training.
 * @author lizlooney@google.com (Liz Looney)
 */
'use strict';
goog.provide('fmltc.TrainMoreDialog');

goog.require('fmltc.Util');

/**
 * Class for a dialog that starts training.
 * @param {!fmltc.Util} util The utility instance
 * @constructor
 */
fmltc.TrainMoreDialog = function(
    util, totalTrainingMinutes, remainingTrainingMinutes,
    modelEntity, datasetEntities, onTrainingStarted) {
  /** @type {!fmltc.Util} */
  this.util = util;
  this.datasetEntities = datasetEntities;
  this.modelEntity = modelEntity;

  this.onTrainingStarted = onTrainingStarted;
  this.dialog = document.getElementById('trainMoreDialog');
  this.dismissButton = document.getElementById('tmDismissButton');
  this.maxRunningMinutesInput = document.getElementById('tmMaxRunningMinutesInput');
  this.totalTrainingMinutesSpan = document.getElementById('tmTotalTrainingMinutesSpan');
  this.remainingTrainingMinutesSpan = document.getElementById('tmRemainingTrainingMinutesSpan');
  this.numTrainingStepsInput = document.getElementById('tmNumTrainingStepsInput');
  this.datasetContainerDiv = document.getElementById('tmDatasetContainerDiv');
  this.descriptionInput = document.getElementById('tmDescriptionInput');
  this.startButton = document.getElementById('tmStartButton');
  this.inProgressDiv = document.getElementById('tmInProgressDiv');
  this.successDiv = document.getElementById('tmSuccessDiv');
  this.failedDiv = document.getElementById('tmFailedDiv');

  this.checkboxes = [];

  this.startTrainingInProgress = false;

  this.maxRunningMinutesInput.min = Math.min(20, remainingTrainingMinutes);
  this.maxRunningMinutesInput.max = remainingTrainingMinutes;
  this.maxRunningMinutesInput.value = Math.min(60, remainingTrainingMinutes);
  this.numTrainingStepsInput.min = 100;
  this.numTrainingStepsInput.max = 4000;
  this.numTrainingStepsInput.value = 2000;

  // Create checkboxes for the datasets. Check and disable the checkboxes that correspond to
  // datasets that are already part of this model.
  for (let i = 0; i < this.datasetEntities.length; i++) {
    const checkbox = document.createElement('input');
    this.checkboxes[i] = checkbox;
    checkbox.setAttribute('type', 'checkbox');
    checkbox.id = this.datasetEntities[i].dataset_uuid;
    if (this.isDatasetInModel(this.datasetEntities[i])) {
      checkbox.checked = true;
      checkbox.disabled = true;
    }
    this.datasetContainerDiv.appendChild(checkbox);
    const label = document.createElement('label');
    label.textContent = this.datasetEntities[i].description;
    label.setAttribute('for', checkbox.id);
    this.datasetContainerDiv.appendChild(label);
    this.datasetContainerDiv.appendChild(document.createElement('br'));
  }

  this.descriptionInput.value = '';

  this.updateStartButton();
  this.totalTrainingMinutesSpan.textContent = String(totalTrainingMinutes);
  this.remainingTrainingMinutesSpan.textContent = String(remainingTrainingMinutes);
  this.inProgressDiv.style.display = 'none';
  this.successDiv.style.display = 'none';
  this.failedDiv.style.display = 'none';

  this.dismissButton.onclick = this.dismissButton_onclick.bind(this);
  this.descriptionInput.oninput = this.descriptionInput_oninput.bind(this);
  this.startButton.onclick = this.startButton_onclick.bind(this);
  this.dialog.style.display = 'block';
};

fmltc.TrainMoreDialog.prototype.isDatasetInModel = function(datasetEntity) {
  for (let i = 0; i < this.modelEntity.dataset_uuids.length; i++) {
    if (this.modelEntity.dataset_uuids[i] == datasetEntity.dataset_uuid) {
      return true;
    }
  }
  return false;
};

fmltc.TrainMoreDialog.prototype.dismissButton_onclick = function() {
  // Clear event handlers.
  this.dismissButton.onclick = null;
  this.descriptionInput.oninput = null;
  this.startButton.onclick = null;

  // Hide the dialog.
  this.dialog.style.display = 'none';
};

fmltc.TrainMoreDialog.prototype.descriptionInput_oninput = function() {
  this.updateStartButton();
};

fmltc.TrainMoreDialog.prototype.updateStartButton = function() {
  this.startButton.disabled = (
      this.startTrainingInProgress ||
      this.descriptionInput.value.length == 0);
};

fmltc.TrainMoreDialog.prototype.startButton_onclick = function() {
  this.util.setWaitCursor();

  this.inProgressDiv.style.display = 'block';

  this.startTrainingInProgress = true;
  this.updateStartButton();

  // Collect the dataset_uuids that correspond to the the enabled and checked checkboxes.
  const datasetUuids = [];
  for (let i = 0; i < this.datasetEntities.length; i++) {
    if (!this.checkboxes[i].disabled && this.checkboxes[i].checked) {
      datasetUuids.push(this.datasetEntities[i].dataset_uuid);
    }
  }
  const datasetUuidsJson = JSON.stringify(datasetUuids);

  // Use the model_uuid for startingModel.
  const startingModel = this.modelEntity.model_uuid;

  const xhr = new XMLHttpRequest();
  const params =
      'description=' + encodeURIComponent(this.descriptionInput.value) +
      '&dataset_uuids=' + encodeURIComponent(datasetUuidsJson) +
      '&starting_model=' + encodeURIComponent(startingModel) +
      '&max_running_minutes=' + this.maxRunningMinutesInput.value +
      '&num_training_steps=' + this.numTrainingStepsInput.value +
      '&create_time_ms=' + Date.now();
  xhr.open('POST', '/startTrainingModel', true);
  xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
  xhr.onreadystatechange = this.xhr_startTrainingModel_onreadystatechange.bind(this, xhr, params);
  xhr.send(params);
};

fmltc.TrainMoreDialog.prototype.xhr_startTrainingModel_onreadystatechange = function(xhr, params) {
  if (xhr.readyState === 4) {
    xhr.onreadystatechange = null;

    if (xhr.status === 200) {
      console.log('Success! /startTrainingModel');
      const response = JSON.parse(xhr.responseText);
      const remainingTrainingMinutes = Math.floor(response.remaining_training_minutes);
      const modelEntity = response.model_entity;

      this.startTrainingInProgress = false;
      this.updateStartButton();
      this.inProgressDiv.style.display = 'none';
      this.successDiv.style.display = 'block';
      this.util.clearWaitCursor();

      this.onTrainingStarted(remainingTrainingMinutes, modelEntity);
      setTimeout(this.dismissButton_onclick.bind(this), 1000);

    } else {
      // TODO(lizlooney): handle error properly
      console.log('Failure! /startTrainingModel?' + params +
          ' xhr.status is ' + xhr.status + '. xhr.statusText is ' + xhr.statusText);
      this.startTrainingInProgress = false;
      this.updateStartButton();
      this.inProgressDiv.style.display = 'none';
      this.failedDiv.style.display = 'block';
    }
  }
};
