// 16 - Shift
// 17 - Ctrl
// 18 - Alt
// 8 - Backspace
function checkUnwantedKey(keycode) {
  return [16, 17, 18].includes(keycode);
}

function keyEvent(e) {
  // Ignore keypresses for unwanted keys
  if (checkUnwantedKey(e.keyCode)) {
    return null;
  }

  // Ignore keypresses with additional modifiers
  if(e.altKey || e.ctrlKey) {
    return null;
  }

  return {
    key: e.key,
    code: e.code,
    shiftKey: e.shiftKey,
    time: Date.now(),
  };
}