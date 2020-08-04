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
  const {
    passwords, keydown, keyup, username,
  } = req.body;
  const attemptCount = passwords.length;

  const processedAttempts = Array(attemptCount)
    .fill()
    .map((v, i) => processKeystrokeData(
      { password: passwords[i], keydown: keydown[i], keyup: keyup[i] },
    ));

  const passwordsEqual = processedAttempts
    .every((v) => _.isEqual(v.linearStringArray, processedAttempts[0].linearStringArray));

  const userInDb = await findUser(username);

  if (!passwordsEqual) { // If the entered passwords don't match
    return res.status(403).json({ success: false, msg: 'Passwords don\'t match' });
  }

  if (userInDb) { // If the user already exists in the Database
    return res.status(403).json({ success: false, msg: 'User already exists in DB' });
  }

  const signupData = createSignupDataFromProcessedData(username, passwords, processedAttempts);

  try {
    const newUserData = await signUpNewUser(signupData);
    logger.info(`Signed up ${username}`);
    return res.json(newUserData);
  } catch (error) {
    return res.status(500).json({ success: false, msg: 'Error signing up', error });
  }
});

module.exports = router;
