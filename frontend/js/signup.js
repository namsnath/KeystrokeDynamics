var keydownArray = [];
var keyupArray = [];
var keyCount = [];

var passwordFields = [], usernameField;

function clearData() {
  keydownArray = [];
  keyupArray = [];
  keyCount = [];
  for (let i = 0; i < 3; i++) {
    passwordFields[i].value = '';
    keydownArray.push([]);
    keyupArray.push([]);
    keyCount.push(0);
  }
}

function clearField(index) {
  passwordFields[index].value = '';
  keydownArray[index] = [];
  keyupArray[index] = [];
  keyCount[index] = 0;
}

function handleEnterTap(index) {
  if (index == 0) {
    
  } else if (index == 1) {

  } else if (index == 2) {

  }
}

function keydownEvent(e) {
  let field = e.target.id;
  let index = field.substr(field.length - 1);

  let details = keyEvent(e);
  if (!details) return;

  if (['Backspace'].includes(details.code) || ['Backspace'].includes(details.code)) {
    return clearField(index);
  }

  if (['Tab', 'NumpadEnter'].includes(details.code) || ['Tab'].includes(details.key)) {
    details = {
      ...details, code: 'Enter', key: 'Enter'
    };
  }

  keydownArray[index].push(details);
  keyupArray[index].push({ ...details, time: null });
  keyCount[index]++;
}

function keyupEvent(e) {
  let field = e.target.id;
  let index = field.substr(field.length - 1);

  let details = keyEvent(e);
  if (!details) return;
  if (!details.time) details.time = Date.now();

  if (['Backspace'].includes(details.code) || ['Backspace'].includes(details.code)) {
    return clearField(index);
  }

  if (['Tab', 'NumpadEnter'].includes(details.code) || ['Tab'].includes(details.key)) {
    details = {
      ...details, code: 'Enter', key: 'Enter'
    };
    console.log(details);
  }

  let reqdUpKeystroke = keyupArray[index]
    .find(element => element.code === details.code && !element.time);

  if (reqdUpKeystroke)
    reqdUpKeystroke.time = details.time;

  if (details.code === 'Enter') {
    if (index == 2) 
      sendToServer();
  }
}

function sendToServer() {
  let data = {
    username: usernameField.value,
    passwords: passwordFields.map(v => v.value),
    keydown: keydownArray,
    keyup: keyupArray,
  };

  clearData();

  fetch('http://localhost:3001/user/signup', {
    method: 'POST',
    mode: 'cors',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
}

window.onload = function () {
  for (let i = 0; i < 3; i++) {
    passwordFields[i] = document.getElementById(`passwordField${i}`);
    passwordFields[i].value = '';
    keydownArray.push([]);
    keyupArray.push([]);
    keyCount.push(0);

    passwordFields[i].addEventListener('keydown', this.keydownEvent);
    passwordFields[i].addEventListener('keyup', this.keyupEvent);
  }
  usernameField = document.getElementById('usernameField');
}
