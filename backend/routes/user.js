const express = require('express');
const _ = require('lodash');
const { logger } = require('../utilities/loggers');
const { processKeystrokeData, findUser } = require('../utilities/userUtility');

const router = express.Router();

router.use(express.json({ extended: false }));
router.use(express.urlencoded({ extended: false }));

router.post('/validateKeystroke', (req, res) => {
  const processedKeystrokeData = processKeystrokeData(req.body);
  res.json(processedKeystrokeData);
});

router.post('/signup', async (req, res) => {
  const attemptCount = req.body.password.length;
  const {
    password, keydown, keyup, username,
  } = req.body;

  const processedAttempts = Array(attemptCount)
    .fill()
    .map((v, i) => processKeystrokeData(
      { password: password[i], keydown: keydown[i], keyup: keyup[i] },
    ));

  const passwordsEqual = processedAttempts
    .every((v) => _.isEqual(v.linearStringArray, processedAttempts[0].linearStringArray));

  const userInDb = await findUser(username);

  if (!passwordsEqual) { // If the entered passwords don't match
    return res.status(403).json({ success: false, msg: 'Passwords don\'t match' });
  }

  if (userInDb.length > 0) { // If the user already exists in the Database
    return res.status(403).json({ success: false, msg: 'User already exists in DB' });
  }

  const keystrokeData = {
    hold: {
      keys: [],
      times: [],
    },
    flight: {
      keys: [],
      times: [],
    },
    dd: {
      keys: [],
      times: [],
    },
  };

  keystrokeData.hold.keys = processedAttempts.hold.keys;
  keystrokeData.flight.keys = processedAttempts.flight.keys;
  keystrokeData.dd.keys = processedAttempts.dd.keys;

  // Proceed with adding data to the db
  return res.json(processedAttempts);
});

module.exports = router;
