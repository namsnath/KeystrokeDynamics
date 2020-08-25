var keydownArray = [];
var keyupArray = [];
var keyCount = 0;

var usernameField, passwordField;
var stdThreshSlider, filThreshSlider, mahThreshSlider;
var stdThreshLabel, filThreshLabel, mahThreshLabel;
var stdSdSlider, filSdSlider;
var stdSdLabel, filSdLabel;
var stdCheckbox, filCheckbox, mahCheckbox;

const charts = {
  standard: {},
  filtered: {},
};

const types = ['hold', 'flight', 'dd', 'full'];

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
    standardThreshold: Number(stdThreshSlider.value),
    filteredThreshold: Number(filThreshSlider.value),
    mahalanobisDistanceThreshold: Number(mahThreshSlider.value),
    useStandard: stdCheckbox.checked,
    useFiltered: filCheckbox.checked,
    useMahalanobis: mahCheckbox.checked,
    standardSdThreshold: Number(stdSdSlider.value),
    filteredSdThreshold: Number(filSdSlider.value),
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
  types.map((type) => {
    const scaleConfig = {
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
    };

    const initialData = {
      labels: [],
      datasets: [
        {
          label: 'db',
          data: [],
          backgroundColor: '#d81e5b66',
        },
        {
          label: 'user',
          data: [],
          backgroundColor: '#28666e66',
        }
      ],
    };

    const legendConfig = {
      display: false,
    }

    const stdCanvas = document.getElementById(`standard_${type}`);
    charts.standard[type] = new Chart(stdCanvas, {
      type: 'line',
      data: initialData,
      options: {
        title: {
          display: true,
          // text: `Standard ${type}`,
        },
        scales: scaleConfig,
        legend: legendConfig,

      maintainAspectRatio: false,
      }
    });

    const filCanvas = document.getElementById(`filtered_${type}`);
    charts.filtered[type] = new Chart(filCanvas, {
      type: 'line',
      data: initialData,
      options: {
        title: {
          display: true,
          // text: `Filtered ${type}`,
        },
        scales: scaleConfig,
        legend: legendConfig,

      maintainAspectRatio: false,
      }
    });
    return type;
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

window.onload = function () {
  Chart.defaults.global.elements.point.radius = 0;
  Chart.defaults.global.elements.point.hitRadius = 3;
  initialiseCharts();

  passwordField = document.getElementById('passwordField');
  usernameField = document.getElementById('usernameField');
  passwordField.value = '';

  stdThreshSlider = document.getElementById('standardThresholdSlider');
  stdThreshLabel = document.getElementById('standardThresholdLabel');
  stdThreshLabel.innerHTML = stdThreshSlider.value;
  stdThreshSlider.oninput =function() {
    stdThreshLabel.innerHTML = stdThreshSlider.value;
  }

  stdSdSlider = document.getElementById('standardSdSlider');
  stdSdLabel = document.getElementById('standardSdLabel');
  stdSdLabel.innerHTML = stdSdSlider.value;
  stdSdSlider.oninput =function() {
    stdSdLabel.innerHTML = stdSdSlider.value;
  }

  filThreshSlider = document.getElementById('filteredThresholdSlider');
  filThreshLabel = document.getElementById('filteredThresholdLabel');
  filThreshLabel.innerHTML = filThreshSlider.value;
  filThreshSlider.oninput =function() {
    filThreshLabel.innerHTML = filThreshSlider.value;
  }

  filSdSlider = document.getElementById('filteredSdSlider');
  filSdLabel = document.getElementById('filteredSdLabel');
  filSdLabel.innerHTML = filSdSlider.value;
  filSdSlider.oninput =function() {
    filSdLabel.innerHTML = filSdSlider.value;
  }

  mahThreshSlider = document.getElementById('mahalanobisThresholdSlider');
  mahThreshLabel = document.getElementById('mahalanobisThresholdLabel');
  mahThreshLabel.innerHTML = mahThreshSlider.value;
  mahThreshSlider.oninput =function() {
    mahThreshLabel.innerHTML = mahThreshSlider.value;
  }


  stdCheckbox = document.getElementById('standardCheckbox');
  filCheckbox = document.getElementById('filteredCheckbox');
  mahCheckbox = document.getElementById('mahalanobisCheckbox');

  passwordField.addEventListener('keydown', this.keydownEvent);
  passwordField.addEventListener('keyup', this.keyupEvent);
}
