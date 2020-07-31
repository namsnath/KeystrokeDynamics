var keydownArray = [];
var keyupArray = [];
var keyCount = 0;

var usernameField, passwordField;

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
  };

  clearData();

  fetch('http://localhost:3001/user/validateKeystroke', {
    method: 'POST',
    mode: 'cors',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
}

window.onload = function () {
  passwordField = document.getElementById('passwordField');
  usernameField = document.getElementById('usernameField');
  passwordField.value = '';

  passwordField.addEventListener('keydown', this.keydownEvent);
  passwordField.addEventListener('keyup', this.keyupEvent);
}