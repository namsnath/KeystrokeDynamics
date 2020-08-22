const ss = require('simple-statistics');
const { logger } = require('./loggers');

const User = require('../models/User');

const processKeystrokeData = ({ keydown, keyup }) => {
  const data = {
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
    full: {
      keys: [],
      times: [],
    },
  };

  for (let i = 0; i < keydown.length; i += 1) {
    const { code: downCode, key: downKey, time: downTime } = keydown[i];
    const { code: upCode, key: upKey, time: upTime } = keyup[i];
    const holdTime = upTime - downTime;

    if (downKey !== upKey || downCode !== upCode) {
      logger.error(`Found a mismatch ${downKey} & ${upKey}`);
      logger.error(`Keydown: ${keydown}\nKeyup: ${keyup}`);
    }

    data.full.keys.push(`H:${downKey}`);
    data.full.times.push(holdTime);

    data.hold.keys.push(downKey);
    data.hold.times.push(holdTime);

    if (i < keydown.length - 1) {
      const { key: nextDownKey, time: nextDownTime } = keydown[i + 1];
      const keyString = `${downKey}:${nextDownKey}`;
      const flightTime = nextDownTime - upTime;
      const ddTime = nextDownTime - downTime;

      data.full.keys.push(`F:${keyString}`);
      data.full.times.push(flightTime);

      data.full.keys.push(`DD:${keyString}`);
      data.full.times.push(ddTime);

      data.flight.keys.push(keyString);
      data.flight.times.push(flightTime);

      data.dd.keys.push(keyString);
      data.dd.times.push(ddTime);
    }
  }

  return data;
};

const computeDataTendencies = (keystrokeData) => {
  const types = ['hold', 'flight', 'dd', 'full'];
  // Mean and SD of full data
  types.map((type) => {
    // keystrokeData[type].means.map for each mean (for each key)
    // i is the column (key)
    // timeArr is each row (attempt/entry)
    keystrokeData[type].means = keystrokeData[type].means.map(
      (v, i) => ss.mean(keystrokeData[type].times.map((timeArr) => timeArr[i])),
    );
    keystrokeData[type].sd = keystrokeData[type].sd.map(
      (v, i) => ss.standardDeviation(keystrokeData[type].times.map(
        (timeArr) => timeArr[i],
      )),
    );

    // const filtered = { means: [], sd: [] };
    // filtered.means = Array(keystrokeData[type].means.length).fill(0);
    // filtered.sd = Array(keystrokeData[type].sd.length).fill(0);

    keystrokeData[type].filteredMeans = keystrokeData[type].filteredMeans.map(
      (v, i) => ss.mean(
        keystrokeData[type].times
          // Get the appropriate times
          .map((timeArr) => timeArr[i])
          // Filter by distance between time and mean
          .filter(
            (val) => euclidean(val, keystrokeData[type].means[i]) < 3 * keystrokeData[type].sd[i],
          ),
      ),
    );

    keystrokeData[type].filteredSd = keystrokeData[type].filteredSd.map(
      (v, i) => ss.standardDeviation(
        keystrokeData[type].times
          // Get the appropriate times
          .map((timeArr) => timeArr[i])
          // Filter by distance between time and mean
          .filter(
            (val) => euclidean(val, keystrokeData[type].means[i]) < 3 * keystrokeData[type].sd[i],
          ),
      ),
    );

    return type;
  });

  return keystrokeData;
};

const createSignupDataFromProcessedData = (username, passwords, processedData) => {
  let signupData = {
    username,
    password: passwords[0],
    keystrokeDataTimestamps: [],
    keystrokeData: {
      hold: {},
      flight: {},
      dd: {},
      full: {},
      },
  };

  signupData = processedData.reduce((acc, v, i) => {
    const types = ['hold', 'flight', 'dd', 'full'];

    types.map((type) => {
    if (i === 0) {
        // Keys of the processed data is checked for equality
        // So the first one is used for the dataset
        acc.keystrokeData[type].keys = v[type].keys;

        // Length of the processedData array is the number of attempts
        // Times is an array of arrays of each attempt
        acc.keystrokeData[type].times = Array(v.length).fill(0);

        acc.keystrokeData[type].means = Array(v[type].keys.length).fill(0);
        acc.keystrokeData[type].sd = Array(v[type].keys.length).fill(0);
        acc.keystrokeData[type].filteredMeans = Array(v[type].keys.length).fill(0);
        acc.keystrokeData[type].filteredSd = Array(v[type].keys.length).fill(0);
    }
      acc.keystrokeData[type].times[i] = v[type].times;

      return type;
    });

    acc.keystrokeDataTimestamps.push(Date.now());

    return acc;
  }, signupData);

  signupData.keystrokeData = computeDataTendencies(signupData.keystrokeData);

  return signupData;
};

const findUser = (username) => User.findOne({ username }).exec();

const signUpNewUser = ({
  username, password, keystrokeData, keystrokeDataTimestamps,
}) => User.create({
  username,
  password,
  keystrokeData,
  keystrokeDataTimestamps,
});

const addDataToUser = async ({
  username, password, data, linearStringArray, linearTimeArray,
}) => {
  // TODO: Add check for matching string arrays
  const userData = await User.findOne({ username }).exec();

  // TODO: Replace with a check to match passwords
  if (!userData.password) {
    userData.password = password;
  }

  if (!userData.keystrokeData) {
    userData.keystrokeData = data;
  } else if (userData.keystrokeData.hold.keys === data.hold.keys) {
    userData.keystrokeData.hold.times.push(data.hold.times);
  }

  userData.keystrokeDataTimestamps.push(Date.now());
};

module.exports = {
  processKeystrokeData,
  createSignupDataFromProcessedData,
  findUser,
  signUpNewUser,
  addDataToUser,
};
