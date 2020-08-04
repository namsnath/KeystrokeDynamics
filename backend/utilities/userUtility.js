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
  types.map((type) => {
    keystrokeData[type].means = keystrokeData[type].means.map(
      (v, i) => ss.mean(keystrokeData[type].times.map((timeArr) => timeArr[i])),
    );
    keystrokeData[type].sd = keystrokeData[type].sd.map(
      (v, i) => ss.standardDeviation(keystrokeData[type].times.map(
        (timeArr) => timeArr[i],
      )),
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
      hold: {
        keys: [],
        times: [],
        means: [],
        sd: [],
      },
      flight: {
        keys: [],
        times: [],
        means: [],
        sd: [],
      },
      dd: {
        keys: [],
        times: [],
        means: [],
        sd: [],
      },
      full: {
        keys: [],
        times: [],
        means: [],
        sd: [],
      },
    },
  };

  signupData = processedData.reduce((acc, v, i) => {
    if (i === 0) {
      acc.keystrokeData.hold.keys = v.hold.keys;
      acc.keystrokeData.hold.means = Array(v.hold.keys.length).fill(0);
      acc.keystrokeData.hold.sd = Array(v.hold.keys.length).fill(0);

      acc.keystrokeData.flight.keys = v.flight.keys;
      acc.keystrokeData.flight.means = Array(v.flight.keys.length).fill(0);
      acc.keystrokeData.flight.sd = Array(v.flight.keys.length).fill(0);

      acc.keystrokeData.dd.keys = v.dd.keys;
      acc.keystrokeData.dd.means = Array(v.dd.keys.length).fill(0);
      acc.keystrokeData.dd.sd = Array(v.dd.keys.length).fill(0);

      acc.keystrokeData.full.keys = v.full.keys;
      acc.keystrokeData.full.means = Array(v.full.keys.length).fill(0);
      acc.keystrokeData.full.sd = Array(v.full.keys.length).fill(0);
    }

    acc.keystrokeData.hold.times.push(v.hold.times);
    acc.keystrokeData.flight.times.push(v.flight.times);
    acc.keystrokeData.dd.times.push(v.dd.times);
    acc.keystrokeData.full.times.push(v.full.times);

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
