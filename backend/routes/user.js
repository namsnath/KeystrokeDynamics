const express = require('express');
const _ = require('lodash');
const { logger } = require('../utilities/loggers');
const {
  processKeystrokeData,
  findUser,
  signUpNewUser,
  updateUser,
  createSignupDataFromProcessedData,
  calculateAttemptScores,
  verifyAttempt,
  addAttemptToKeystrokeData,
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
    return res.json(newUserData);
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
    standardSdThreshold,
    stdAccThresh,
    filteredSdThreshold,
    filteredAccThresh,
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

  const scores = calculateAttemptScores({
    userKeystrokeData: userInDb.keystrokeData,
    attemptKeystrokeData: processedAttempt,
    standardSdThreshold,
    filteredSdThreshold,
  });

  const result = verifyAttempt({
    scores,
    useStandard: true,
    useFiltered: false,
    standardThreshold: stdAccThresh,
    filteredThreshold: filteredAccThresh,
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
    ...result,
    db: {
      hold: userInDb.keystrokeData.hold.times,
      flight: userInDb.keystrokeData.flight.times,
      dd: userInDb.keystrokeData.dd.times,
      full: userInDb.keystrokeData.full.times,
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
