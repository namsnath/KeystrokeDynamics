const express = require('express');
const _ = require('lodash');
const { logger } = require('../utilities/loggers');
const {
  processKeystrokeData,
  findUser,
  signUpNewUser,
  updateUser,
  createSignupDataFromProcessedData,
  addAttemptToKeystrokeData,
  computeDataTendencies,
  processAttempt,
} = require('../utilities/userUtility');

const router = express.Router();

router.use(express.json({ extended: false }));
router.use(express.urlencoded({ extended: false }));

router.post('/validateKeystroke', (req, res) => {
  const processedKeystrokeData = processKeystrokeData(req.body);
  res.json(processedKeystrokeData);
});

router.get('/find/:username', async (req, res) => {
  res.json(await findUser(req.params.username));
});

router.get('/tendencies/:username', async (req, res) => {
  const user = await findUser(req.params.username);
  return res.json({
    db: (await findUser(req.params.username)).keystrokeData,
    calc: computeDataTendencies(user.keystrokeData),
  });
});

router.post('/signup', async (req, res) => {
  const {
    passwords, keydown, keyup, username,
  } = req.body;
  const attemptCount = passwords.length;

  const processedAttempts = Array(attemptCount)
    .fill()
    .map((v, i) => processKeystrokeData(
      { keydown: keydown[i], keyup: keyup[i] },
    ));

  const passwordsEqual = processedAttempts
    .every((v) => _.isEqual(v.full.keys, processedAttempts[0].full.keys));

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
    return res.json({
      success: true,
      username: newUserData.username,
    });
  } catch (error) {
    logger.error(error);
    logger.debug(req.body);
    return res.status(500).json({ success: false, msg: 'Error signing up', error });
  }
});

router.post('/login', async (req, res) => {
  const {
    password,
    keydown,
    keyup,
    username,
    controls,
  } = req.body;

  const processedAttempt = processKeystrokeData({ keydown, keyup });

  const userInDb = await findUser(username);

  if (!userInDb) { // If the user does not exist in the Database
    return res.status(403).json({ success: false, msg: 'User does not exist in DB' });
  }

  const credentialsValid = password === userInDb.password
  && _.isEqual(processedAttempt.hold.keys, userInDb.keystrokeData.hold.keys)
  && _.isEqual(processedAttempt.flight.keys, userInDb.keystrokeData.flight.keys)
  && _.isEqual(processedAttempt.dd.keys, userInDb.keystrokeData.dd.keys)
  && _.isEqual(processedAttempt.full.keys, userInDb.keystrokeData.full.keys);

  if (!credentialsValid) {
    return res.status(403).json({ success: false, msg: 'Invalid Credentials' });
  }

  const result = processAttempt({
    userKeystrokeData: userInDb.keystrokeData,
    attemptKeystrokeData: processedAttempt,
    controls,
  });

  if (result.accepted) {
    const newUserData = addAttemptToKeystrokeData({
      userData: userInDb,
      attemptKeystrokeData: processedAttempt,
    });
    newUserData.__v += 1;

    await updateUser({
      username,
      updateData: newUserData,
    });
  }

  return res.json({
    result,
    db: {
      hold: userInDb.keystrokeData.hold.means,
      flight: userInDb.keystrokeData.flight.means,
      dd: userInDb.keystrokeData.dd.means,
      full: userInDb.keystrokeData.full.means,
    },
    filteredDb: {
      hold: userInDb.keystrokeData.hold.filteredMeans,
      flight: userInDb.keystrokeData.flight.filteredMeans,
      dd: userInDb.keystrokeData.dd.filteredMeans,
      full: userInDb.keystrokeData.full.filteredMeans,
    },
    attempt: {
      hold: processedAttempt.hold.times,
      flight: processedAttempt.flight.times,
      dd: processedAttempt.dd.times,
      full: processedAttempt.full.times,
    },
  });
});

module.exports = router;
