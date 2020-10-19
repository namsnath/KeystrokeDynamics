const ss = require('simple-statistics');
const _ = require('lodash');
const math = require('mathjs');
const { logger } = require('./loggers');

const User = require('../models/User');

const SD_MULTIPLIER = 2.5;
const THRESHOLD_PERCENT = 65;
const MAHALANOBIS_THRESHOLD = 2;
const FULL_STANDARD_THRESHOLD = 1;
const FULL_FILTERED_THRESHOLD = 1;

const MAHALANOBIS_NORM_MULTIPLIER = 10000;
const STANDARD_NORM_MULTIPLIER = 1000;
const FILTERED_NORM_MULTIPLIER = 1000;
const TYPES = ['hold', 'flight', 'dd', 'full'];

const matrixMult = (a, b) => {
  if (!a[0].length) a = [a];
  if (!b[0].length) b = [b];

  const result = new Array(a.length).fill(0).map(() => new Array(b[0].length).fill(0));

  return result.map(
    (row, i) => row.map(
      (val, j) => a[i].reduce(
        (sum, elm, k) => sum + (elm * b[k][j]), 0,
      ),
    ),
  );
};

const confidence = (mean, sd, n, c = 0.95) => {

};

const norm = (a) => Math.sqrt(ss.sum(a.map((v) => v ** 2)));

const euclidean = (d1, d2, w = 1) => Math.sqrt(w * (Math.abs(d2 - d1) ** 2));

const cityblock = (d1, d2) => Math.abs(d1 - d2);

const mahalanobis = (attempt, mean, covMatrix) => {
  // D = sqrt((x-mean) * S^-1 * (x - mean)^T)
  // Wikipedia uses a column vector, we use a row vector
  // Thus, transpose is on the right and not left (like on Wiki)

  let sInv;
  try {
    sInv = math.inv(covMatrix);
  } catch (err) {
    logger.warn('sInv is not possible');
    logger.warn(sInv);
    return NaN;
  }

  const diffVector = attempt.map((v, i) => v - mean[i]);
  const transDiffVector = diffVector.map((v) => [v]);

  const leftProduct = matrixMult(diffVector, sInv);
  const product = Math.abs(matrixMult(leftProduct, transDiffVector));

  // let distance;
  // if (typeof product === 'number') {
  //   distance = Math.sqrt(product);
  // } else if (typeof product === 'object' && !!product.length) {
  //   distance = Math.sqrt(product[0][0]);
  // }

  const distance = Math.sqrt(product);

  return distance;
};

const cityblockArray = (a1, a2) => ss.sum(
  a1.map((v, i) => Math.abs(a1[i] - a2[i])),
);

const euclideanArray = (a1, a2, w) => Math.sqrt(
  ss.sum(
    a1.map((v, i) => (w?.[i] ?? 1) * (Math.abs(a1[i] - a2[i]) ** 2)),
  ),
);

const covariance = (x, y, xMean, yMean, n) => (1 / (n - 1)) * ss.sum(
  Array(n).fill(0).map((v, i) => (x[i] - xMean) * (y[i] - yMean)),
);

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

const computeStandardTendencies = (data) => {
  const transposedData = _.unzip(data.times);

  const means = data.means.map((v, i) => ss.mean(transposedData[i]));
  const sd = data.sd.map((v, i) => ss.standardDeviation(transposedData[i]));

  return { means, sd };
};

const computeFilteredTendencies = (data, SDFilterMultiplier = 2) => {
  const transposedData = _.unzip(data.times)
    .map(
      (row) => row.filter( // Each Row is now the columns of original matrix
        // Each element (attempt for a given keystroke) is checked and filtered
        (v, i) => euclidean(v, data.means[i]) < SDFilterMultiplier * data.sd[i],
      ),
    );

  const filteredMeans = data.filteredMeans.map(
    (v, i) => ss.mean(transposedData[i].length === 0 ? [0] : transposedData[i]),
  );
  const filteredSd = data.filteredSd.map(
    (v, i) => ss.standardDeviation(transposedData[i].length === 0 ? [0] : transposedData[i]),
  );

  return { filteredMeans, filteredSd };
};

const computeMahalanobis = (data, means) => {
  const transTime = _.unzip(data.times);

  const obsCount = data.times.length;
  const featureCount = data.times[0].length;

  const covMatrix = new Array(featureCount).fill(0).map(() => new Array(featureCount).fill(0));

  Array(featureCount).fill(0).map((v, i) => {
    Array(featureCount).fill(0).map((w, j) => {
      covMatrix[i][j] = covariance(transTime[i], transTime[j], means[i], means[j], obsCount);

      return j;
    });
    return i;
  });

  return { covMatrix };
};

const computeDataTendencies = (keystrokeData) => {
  TYPES.map((type) => {
    const { means, sd } = computeStandardTendencies(keystrokeData[type]);
    keystrokeData[type].means = means;
    keystrokeData[type].sd = sd;

    const { filteredMeans, filteredSd } = computeFilteredTendencies(keystrokeData[type]);
    keystrokeData[type].filteredMeans = filteredMeans;
    keystrokeData[type].filteredSd = filteredSd;

    const { covMatrix } = computeMahalanobis(keystrokeData[type], means);
    keystrokeData[type].covMatrix = covMatrix;

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
    TYPES.map((type) => {
      if (i === 0) {
        // Keys of the processed data is checked for equality
        // So the first one is used for the dataset
        acc.keystrokeData[type].keys = v[type].keys;

        // Length of the processedData array is the number of attempts
        // Times is an array of arrays of each attempt
        acc.keystrokeData[type].times = Array(v.length).fill([]);

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

const updateUser = ({
  username, updateData,
}) => User.updateOne({ username }, updateData).exec();

const addAttemptToKeystrokeData = ({
  userData, attemptKeystrokeData,
}) => {
  TYPES.map((type) => {
    userData.keystrokeData[type].times.push(attemptKeystrokeData[type].times);
    return type;
  });
  userData.keystrokeDataTimestamps.push(Date.now());

  userData.keystrokeData = computeDataTendencies(userData.keystrokeData);

  // console.log(userData);

  return userData;
};

const processStandard = (
  userKeystrokeData,
  attemptKeystrokeData,
  controls,
) => {
  const {
    threshold = THRESHOLD_PERCENT,
    sd: sdMult = SD_MULTIPLIER,
  } = controls;

  const scores = {
    distance: {},
    inRange: {},
    inRangePercent: {},
  };

  TYPES.map((type) => {
    scores.distance[type] = Array(userKeystrokeData[type].means.length).fill(0);
    const isInRange = Array(userKeystrokeData[type].means.length).fill(false);
    let inRangeCount = 0;
    let totalCount = 0;
    scores.inRangePercent[type] = 0;
    scores.inRange[type] = false;

    userKeystrokeData[type].means.map((v, i) => {
      const mean = userKeystrokeData[type].means[i];
      const sd = userKeystrokeData[type].sd[i];
      const attemptTime = attemptKeystrokeData[type].times[i];

      const low = mean - (sd * sdMult);
      const high = mean + (sd * sdMult);

      const distance = cityblock(mean, attemptTime);

      scores.distance[type][i] = distance;
      isInRange[i] = attemptTime >= low && attemptTime <= high;

      inRangeCount += !!isInRange[i];
      totalCount += 1;
      return v;
    });

    scores.inRangePercent[type] = (inRangeCount / totalCount) * 100;
    if (scores.inRangePercent[type] >= threshold) {
      scores.inRange[type] = true;
    }

    return type;
  });

  return scores;
};

const processFiltered = (
  userKeystrokeData,
  attemptKeystrokeData,
  controls,
) => {
  const {
    threshold = THRESHOLD_PERCENT,
    sd: sdMult = SD_MULTIPLIER,
  } = controls;

  const scores = {
    distance: {},
    inRange: {},
    inRangePercent: {},
  };

  TYPES.map((type) => {
    scores.distance[type] = Array(userKeystrokeData[type].filteredMeans.length).fill(0);
    const isInRange = Array(userKeystrokeData[type].filteredMeans.length).fill(false);
    let inRangeCount = 0;
    let totalCount = 0;
    scores.inRangePercent[type] = 0;
    scores.inRange[type] = false;

    userKeystrokeData[type].filteredMeans.map((v, i) => {
      const mean = userKeystrokeData[type].filteredMeans[i];
      const sd = userKeystrokeData[type].filteredSd[i];
      const attemptTime = attemptKeystrokeData[type].times[i];

      const low = mean - (sd * sdMult);
      const high = mean + (sd * sdMult);

      const distance = cityblock(mean, attemptTime);

      scores.distance[type][i] = distance;
      isInRange[i] = attemptTime >= low && attemptTime <= high;

      inRangeCount += !!isInRange[i];
      totalCount += 1;
      return v;
    });

    scores.inRangePercent[type] = (inRangeCount / totalCount) * 100;
    if (scores.inRangePercent[type] >= threshold) {
      scores.inRange[type] = true;
    }

    return type;
  });

  return scores;
};

const processMahalanobis = (
  userKeystrokeData,
  attemptKeystrokeData,
  controls,
) => {
  const {
    threshold = MAHALANOBIS_THRESHOLD,
  } = controls;

  const scores = {
    normedDistance: {},
    distance: {},
    inRange: {},
  };

  TYPES.map((type) => {
    scores.distance[type] = 0;
    scores.inRange[type] = false;

    const distance = mahalanobis(
      attemptKeystrokeData[type].times,
      userKeystrokeData[type].means,
      userKeystrokeData[type].covMatrix,
    );
    scores.distance[type] = distance;

    const normedDistance = (distance * MAHALANOBIS_NORM_MULTIPLIER) / (
      norm(attemptKeystrokeData[type].times) * norm(userKeystrokeData[type].means)
    );

    scores.normedDistance[type] = normedDistance;
    if (normedDistance <= threshold) {
      scores.inRange[type] = true;
    }

    return type;
  });

  return scores;
};

const processFullStandard = (
  userKeystrokeData,
  attemptKeystrokeData,
  controls,
) => {
  const {
    threshold = FULL_STANDARD_THRESHOLD,
  } = controls;

  const scores = {
    normedDistance: {},
    distance: {},
    inRange: {},
  };

  TYPES.map((type) => {
    scores.distance[type] = 0;
    scores.inRange[type] = false;

    const distance = cityblockArray(
      attemptKeystrokeData[type].times,
      userKeystrokeData[type].means,
    );
    scores.distance[type] = distance;

    const normedDistance = (distance * STANDARD_NORM_MULTIPLIER) / (
      norm(attemptKeystrokeData[type].times) * norm(userKeystrokeData[type].means)
    );

    scores.normedDistance[type] = normedDistance;
    if (normedDistance <= threshold) {
      scores.inRange[type] = true;
    }

    return type;
  });

  return scores;
};

const processFullFiltered = (
  userKeystrokeData,
  attemptKeystrokeData,
  controls,
) => {
  const {
    threshold = FULL_FILTERED_THRESHOLD,
  } = controls;

  const scores = {
    normedDistance: {},
    distance: {},
    inRange: {},
  };

  TYPES.map((type) => {
    scores.distance[type] = 0;
    scores.inRange[type] = false;

    const distance = cityblockArray(
      attemptKeystrokeData[type].times,
      userKeystrokeData[type].filteredMeans,
    );
    scores.distance[type] = distance;

    const normedDistance = (distance * FILTERED_NORM_MULTIPLIER) / (
      norm(attemptKeystrokeData[type].times) * norm(userKeystrokeData[type].filteredMeans)
    );

    scores.normedDistance[type] = normedDistance;
    if (normedDistance <= threshold) {
      scores.inRange[type] = true;
    }

    return type;
  });

  return scores;
};

const processAttempt = ({
  userKeystrokeData: ukd,
  attemptKeystrokeData: akd,
  controls,
}) => {
  const {
    standard: stControls,
    filtered: flControls,
    fullStandard: stPopControls,
    fullFiltered: flPopControls,
    mahalanobis: mhControls,
  } = controls;

  const result = {
    standard: {
      ...stControls,
      ...processStandard(ukd, akd, stControls),
    },
    fullStandard: {
      ...stPopControls,
      ...processFullStandard(ukd, akd, stPopControls),
    },
    filtered: {
      ...flControls,
      ...processFiltered(ukd, akd, flControls),
    },
    fullFiltered: {
      ...flPopControls,
      ...processFullFiltered(ukd, akd, flPopControls),
    },
    mahalanobis: {
      ...mhControls,
      ...processMahalanobis(ukd, akd, mhControls),
    },
    accepted: false,
  };

  result.accepted = (stControls.use || flControls.use || mhControls.use
    || flPopControls.use || stPopControls.use)
    && (!mhControls.use || result.mahalanobis.inRange.full)
    && (!stPopControls.use || result.fullStandard.inRange.full)
    && (!flPopControls.use || result.fullFiltered.inRange.full)
    && (!stControls.use || result.standard.inRange.full)
    && (!flControls.use || result.filtered.inRange.full);

  return result;
};

module.exports = {
  processKeystrokeData,
  createSignupDataFromProcessedData,
  findUser,
  signUpNewUser,
  updateUser,
  addAttemptToKeystrokeData,
  computeDataTendencies,
  processAttempt,
};
