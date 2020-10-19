var keydownArray = [];
var keyupArray = [];
var keyCount = 0;

var usernameField, passwordField;

const LOGIN_LINK = 'http://localhost:3001/user/login';

// For charts
const chartTypes = ['standard', 'filtered'];
const types = ['hold', 'flight', 'dd', 'full'];

const responseKeys = {
  standard: ['use', 'threshold', 'sd', 'inRangePercent.full', 'inRange.full'],
  filtered: ['use', 'threshold', 'sd', 'inRangePercent.full', 'inRange.full'],
  mahalanobis: ['use', 'threshold', '', 'distance.full', 'inRange.full'],
  fullStandard: ['use', 'threshold', '', 'normedDistance.full', 'inRange.full'],
  fullFiltered: ['use', 'threshold', '', 'normedDistance.full', 'inRange.full'],
};

const charts = chartTypes.reduce((a, v) => ({
  ...a,
  [v]: types.reduce((acc, val) => ({...acc, [val]: undefined}), {}),
}), {});

// Define controls present in HTML here
const controls = {
  standard: {
    slider: {
      threshold: undefined, 
      sd: undefined,
    },
    checkbox: undefined,
    label: {
      threshold: undefined,
      sd: undefined,
      checkbox: undefined,
    },
  },
  filtered: {
    slider: {
      threshold: undefined, 
      sd: undefined,
    },
    checkbox: undefined,
    label: {
      threshold: undefined,
      sd: undefined,
      checkbox: undefined,
    },
  },
  mahalanobis: {
    slider: {
      threshold: undefined,
    },
    checkbox: undefined,
    label: {
      threshold: undefined,
      checkbox: undefined,
    },
  },
  fullStandard: {
    slider: {
      threshold: undefined,
    },
    checkbox: undefined,
    label: {
      threshold: undefined,
      checkbox: undefined,
    },
  },
  fullFiltered: {
    slider: {
      threshold: undefined,
    },
    checkbox: undefined,
    label: {
      threshold: undefined,
      checkbox: undefined,
    },
  },
};

Object.byString = function(o, s) {
  if (s === '') return null;
  s = s.replace(/\[(\w+)\]/g, '.$1'); // convert indexes to properties
  s = s.replace(/^\./, '');           // strip a leading dot
  var a = s.split('.');
  for (var i = 0, n = a.length; i < n; ++i) {
      var k = a[i];
      if (k in o) {
          o = o[k];
      } else {
          return;
      }
  }
  return o;
}

function clearData() {
  passwordField.value = '';
  keydownArray = [];
  keyupArray = [];
  keyCount = 0;
}

function keydownEvent(e) {
  var details = keyEvent(e);
  if (!details) return;

  if (['Backspace'].includes(details.code) || ['Backspace'].includes(details.code)) {
    return clearData();
  }

  keydownArray.push(details);
  keyupArray.push({ ...details, time: null });
  keyCount++;
}

function keyupEvent(e) {
  var details = keyEvent(e);
  if (!details) return;
  if (!details.time) details.time = Date.now();

  if (['Backspace'].includes(details.code) || ['Backspace'].includes(details.code)) {
    return clearData();
  }

  var reqdUpKeystroke = keyupArray
    .find(element => element.code === details.code && !element.time);

  if (reqdUpKeystroke)
    reqdUpKeystroke.time = details.time;

  if (details.code === 'Enter') sendToServer();
}



function sendToServer() {
  var data = {
    username: usernameField.value,
    password: passwordField.value,
    keydown: keydownArray,
    keyup: keyupArray,

    controls: getRequestData(),
  };

  clearData();

  fetch(LOGIN_LINK, {
    method: 'POST',
    mode: 'cors',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  }).then(async (res) => {
    if(res.ok) {
      let response = await res.json();

      const table = document.getElementById('dataTable');

      Object.keys(controls).map((detector, detectorIndex) => {
        const data = response.result[detector];
        const keys = responseKeys[detector];

        Array.from(table.getElementsByTagName('tr')).map((row, i) => {
          const index = i - 1;
          if (i === 0) return;
          if (i === keys.length + 1) {
            row.getElementsByTagName('th')[1].innerHTML = response.result.accepted;
            return;
          }

          const cells = row.getElementsByTagName('td');
          const value = Object.byString(data, keys[index]) ?? '-';
          const cellValue = (typeof value == 'number') ? value.toFixed(2) : value;
          
          cells[detectorIndex].innerHTML = cellValue;
        });
      });

      types.map((type) => {
        populateChart(charts.standard[type], response.db[type], response.attempt[type]);
        populateChart(charts.filtered[type], response.filteredDb[type], response.attempt[type]);
      });
    } else {
      let response = await res.json();

      halfmoon.initStickyAlert({
        content: `${response.msg}`,
        title: "Login failed",
        alertType: "alert-danger",
        fillType: "filled-lm"
      });
    }
  });
}

function initialiseCharts() {
  Chart.defaults.global.elements.point.radius = 0;
  Chart.defaults.global.elements.point.hitRadius = 3;

  const config = {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        // Red
        {
          label: 'user',
          data: [],
          backgroundColor: '#ff4d4f10',
          borderColor: '#ff4d4f',
          borderWidth: 2,
        },
        // Blue
        {
          label: 'db',
          data: [],
          backgroundColor: '#1890ff10',
          borderColor: '#1890ff',
          borderWidth: 2,
        },
      ],
    },
    options: {
      title: { display: false, },
      scales: {
        xAxes: [{
          gridLines: {
            display: false,
          },
        }],
        yAxes: [{
          gridLines: {
            display: false,
          },
          ticks: {
            display: false,
          },
        }],
      },
      legend: { display: false, },
      maintainAspectRatio: false,
    }
  }

  chartTypes.map((chartType) => {
    types.map((type) => {
      const canvas = document.getElementById(`${chartType}_${type}`);
      charts[chartType][type] = new Chart(canvas, config);
    });
  });
}

function populateChart(chart, dbData, userData) {
  populateChartWithResponse(chart, 'DB', 'db', dbData);
  populateChartWithResponse(chart, '', 'user', userData);
}

function populateChartWithResponse(chart, label="", datasetLabel, data) {
  if (label) {
    chart.data.labels = Array(data.length).fill("");
  }

  chart.data.datasets.forEach((dataset) => {
    if(dataset.label === datasetLabel)
      dataset.data = data;
  });
  chart.update();
}

function initialiseControls() {
  Object.keys(controls).map((detector) => {
    if (!(detector in controls)) return;
    
    Object.keys(controls[detector]).map((controlType) => {
      if(!(controlType in controls[detector])) return;

      if (controlType === 'checkbox') {
        const controlId = `${detector}_${controlType}`;
        const labelId = `${detector}_${controlType}_label`;
        controls[detector][controlType] = document.getElementById(controlId);
        controls[detector].label[controlType] = document.getElementById(labelId);
        return;
      } 

      if (controlType === 'slider') {
        Object.keys(controls[detector][controlType]).map((sliderType) => {
          if(!(sliderType in controls[detector][controlType])) return;

          const controlId = `${detector}_${controlType}_${sliderType}`;
          const labelId = `${controlId}_label`;

          const slider = document.getElementById(controlId);
          const label = document.getElementById(labelId);

          label.innerHTML = slider.value;
          slider.oninput = () => { label.innerHTML = slider.value };

          controls[detector][controlType][sliderType] = slider;
          controls[detector].label[sliderType] = label;
        });
        return;
      }
    });
  });
}

function getRequestData() {
  const data = {};

  Object.keys(controls).map((detector) => {
    data[detector] = {};
    
    Object.keys(controls[detector]).map((controlType) => {
      if (controlType === 'label') return;

      if (controlType === 'checkbox') {
        data[detector].use = controls[detector][controlType].checked;
        return;
      } 

      if (controlType === 'slider') {
        Object.keys(controls[detector][controlType]).map((sliderType) => {
          data[detector][sliderType] = Number(
            controls[detector][controlType][sliderType].value
          );
        });
        return;
      }
    });
  });

  return data;
}

window.onload = function () {
  initialiseCharts();
  initialiseControls();

  passwordField = document.getElementById('passwordField');
  usernameField = document.getElementById('usernameField');
  passwordField.value = '';

  passwordField.addEventListener('keydown', this.keydownEvent);
  passwordField.addEventListener('keyup', this.keyupEvent);
}
