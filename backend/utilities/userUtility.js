const { logger } = require('./loggers');

const User = require('../models/User');

module.exports.processKeystrokeData = ({ password, keydown, keyup }) => {
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
  };

  const linearTimeArray = [];
  const linearStringArray = [];

  for (let i = 0; i < keydown.length; i += 1) {
    const { code: downCode, key: downKey, time: downTime } = keydown[i];
    const { code: upCode, key: upKey, time: upTime } = keyup[i];
    const holdTime = upTime - downTime;

    if (downKey !== upKey || downCode !== upCode) {
      logger.error(`Found a mismatch ${downKey} & ${upKey}`);
      logger.error(`Keydown: ${keydown}\nKeyup: ${keyup}`);
    }

    linearStringArray.push(`H:${downKey}`);
    linearTimeArray.push(holdTime);

    data.hold.keys.push(downKey);
    data.hold.times.push(holdTime);

    if (i < keydown.length - 1) {
      const { key: nextDownKey, time: nextDownTime } = keydown[i + 1];
      const keyString = `${downKey}:${nextDownKey}`;
      const flightTime = nextDownTime - upTime;
      const ddTime = nextDownTime - downTime;

      linearStringArray.push(`F:${keyString}`);
      linearTimeArray.push(flightTime);

      linearStringArray.push(`DD:${keyString}`);
      linearTimeArray.push(ddTime);

      data.flight.keys.push(keyString);
      data.flight.times.push(flightTime);

      data.dd.keys.push(keyString);
      data.dd.times.push(ddTime);
    }
  }

  return {
    data, linearStringArray, linearTimeArray,
  };
};

module.exports.findUser = (username) => User.findOne({ username }).exec();

module.exports.signUpNewUser = ({
  username, password, keystrokeData, keystrokeDataTimestamps,
}) => User.create({
  username,
  password,
  keystrokeData,
  keystrokeDataTimestamps,
});

module.exports.addDataToUser = async ({
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
