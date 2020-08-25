var keydownArray = [];
var keyupArray = [];
var keyCount = 0;

var usernameField, passwordField;

// For charts
const chartTypes = ['standard', 'filtered'];
const types = ['hold', 'flight', 'dd', 'full'];

// For controls
const detectors = ['standard', 'filtered', 'mahalanobis'];
const controlTypes = ['checkbox', 'slider'];
const sliderTypes = ['threshold', 'sd'];
const labelTypes = ['checkbox', 'threshold', 'sd'];

const charts = chartTypes.reduce((a, v) => ({
  ...a,
  [v]: types.reduce((acc, val) => ({...acc, [val]: undefined}), {}),
}), {});
console.log(charts);

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
};

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
    useStandard: controls.standard.checkbox.checked,
    useFiltered: controls.filtered.checkbox.checked,
    useMahalanobis: controls.mahalanobis.checkbox.checked,
    standardThreshold: Number(controls.standard.slider.threshold.value),
    filteredThreshold: Number(controls.filtered.slider.threshold.value),
    mahalanobisDistanceThreshold: Number(controls.mahalanobis.slider.threshold.value),
    standardSdThreshold: Number(controls.standard.slider.sd.value),
    filteredSdThreshold: Number(controls.filtered.slider.sd.value),
  };

  clearData();

  fetch('http://localhost:3001/user/login', {
    method: 'POST',
    mode: 'cors',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  }).then(async (res) => {
    if(res.ok) {
      let response = await res.json();

      const stdKeys = ['useStandard', 'standardThreshold', 'standardSDMultiplier', 'standardScore', 'standardAccepted'];
      const filKeys = ['useFiltered', 'filteredThreshold', 'filteredSDMultiplier', 'filteredScore', 'filteredAccepted'];
      const mahKeys = ['useMahalanobis', 'mahalanobisThreshold', '', 'mahalanobisDistance', 'mahalanobisAccepted'];

      const table = document.getElementById('dataTable');
      Array.from(table.getElementsByTagName('tr')).map((row, i) => {
        if (i === 0) return;
        if (i === stdKeys.length + 1) {
          row.getElementsByTagName('th')[1].innerHTML = response.accepted;
          return;
        }
        const cells = row.getElementsByTagName('td');
        cells[0].innerHTML = response[stdKeys[i - 1]];
        cells[1].innerHTML = response[filKeys[i - 1]];

        if (i != 3) {
          cells[2].innerHTML = response[mahKeys[i - 1]];
        }
      });

      types.map((type) => {
        // Standard
        populateChartWithResponse(
          charts.standard[type],
          'DB',
          'db',
          response.db[type],
        );
        populateChartWithResponse(
          charts.standard[type],
          '',
          'user',
          response.attempt[type],
        );

        // Filtered
        populateChartWithResponse(
          charts.filtered[type],
          'DB',
          'db',
          response.filteredDb[type],
        );
        populateChartWithResponse(
          charts.filtered[type],
          '',
          'user',
          response.attempt[type],
        );
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
        {
          label: 'user',
          data: [],
          backgroundColor: '#28666e66',
        },
        {
          label: 'db',
          data: [],
          backgroundColor: '#d81e5b66',
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
  detectors.map((detector) => {
    if (!(detector in controls)) return;
    
    controlTypes.map((controlType) => {
      if(!(controlType in controls[detector])) return;

      if (controlType === 'checkbox') {
        const controlId = `${detector}_${controlType}`;
        const labelId = `${detector}_${controlType}_label`;
        controls[detector][controlType] = document.getElementById(controlId);
        controls[detector].label[controlType] = document.getElementById(labelId);
        return;
      } 

      if (controlType === 'slider') {
        sliderTypes.map((sliderType) => {
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

window.onload = function () {
  initialiseCharts();
  initialiseControls();

  passwordField = document.getElementById('passwordField');
  usernameField = document.getElementById('usernameField');
  passwordField.value = '';

  passwordField.addEventListener('keydown', this.keydownEvent);
  passwordField.addEventListener('keyup', this.keyupEvent);
}
