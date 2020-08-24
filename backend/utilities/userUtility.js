const ss = require('simple-statistics');
const _ = require('lodash');
const math = require('mathjs');
const { logger } = require('./loggers');

const User = require('../models/User');

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

const euclidean = (d1, d2, w = 1) => Math.sqrt(w * (Math.abs(d2 - d1) ** 2));

const cityblock = (d1, d2) => Math.abs(d1 - d2);

const mahalanobis = (attempt, mean, covMatrix) => {
  // D = sqrt((x-mean) * S^-1 * (x - mean)^T)
  // Wikipedia uses a column vector, we use a row vector
  // Thus, transpose is on the right and not left (like on Wiki)

  const sInv = math.inv(covMatrix);
  const diffVector = attempt.map((v, i) => v - mean[i]);
  const transDiffVector = diffVector.map((v) => [v]);

  const leftProduct = matrixMult(diffVector, sInv);
  const product = matrixMult(leftProduct, transDiffVector);

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

  const filteredMeans = data.filteredMeans.map((v, i) => ss.mean(transposedData[i]));
  const filteredSd = data.filteredSd.map((v, i) => ss.standardDeviation(transposedData[i]));

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
  const types = ['hold', 'flight', 'dd', 'full'];

  types.map((type) => {
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
    const types = ['hold', 'flight', 'dd', 'full'];

    types.map((type) => {
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
  const types = ['hold', 'flight', 'dd', 'full'];

  types.map((type) => {
    userData.keystrokeData[type].times.push(attemptKeystrokeData[type].times);
    return type;
  });
  userData.keystrokeDataTimestamps.push(Date.now());

  userData.keystrokeData = computeDataTendencies(userData.keystrokeData);

  // console.log(userData);

  return userData;
};

const calculateStandardScores = ({
  userKeystrokeData,
  attemptKeystrokeData,
  sdThreshold = 2.5,
}) => {
  const types = ['hold', 'flight', 'dd', 'full'];
  const scores = {
    distance: {},
    low: {},
    high: {},
    inrange: {},
    inrangeCount: {},
    totalCount: {},
    inrangePercent: {},
    distanceSum: {},
  };

  types.map((type) => {
    scores.distance[type] = Array(userKeystrokeData[type].means.length).fill(0);
    scores.low[type] = Array(userKeystrokeData[type].means.length).fill(0);
    scores.high[type] = Array(userKeystrokeData[type].means.length).fill(0);
    scores.inrange[type] = Array(userKeystrokeData[type].means.length).fill(0);
    scores.distanceSum[type] = 0;
    scores.inrangeCount[type] = 0;
    scores.totalCount[type] = 0;
    scores.inrangePercent[type] = 0;

    userKeystrokeData[type].means.map((v, i) => {
      const mean = userKeystrokeData[type].means[i];
      const sd = userKeystrokeData[type].sd[i];
      const attemptTime = attemptKeystrokeData[type].times[i];

      scores.distance[type][i] = cityblock(mean, attemptTime);
      scores.distanceSum[type] += cityblock(mean, attemptTime);
      scores.low[type][i] = mean - (sd * sdThreshold);
      scores.high[type][i] = mean + (sd * sdThreshold);
      scores.inrange[type][i] = attemptTime >= scores.low[type][i]
        && attemptTime <= scores.high[type][i];

      scores.inrangeCount[type] += !!scores.inrange[type][i];
      scores.totalCount[type] += 1;
      return v;
    });

    scores.inrangePercent[type] = (scores.inrangeCount[type] / scores.totalCount[type]) * 100;

    return type;
  });

  return scores;
};

const calculateFilteredScores = ({
  userKeystrokeData,
  attemptKeystrokeData,
  sdThreshold = 2.5,
}) => {
  const types = ['hold', 'flight', 'dd', 'full'];
  const scores = {
    distance: {},
    low: {},
    high: {},
    inrange: {},
    inrangeCount: {},
    totalCount: {},
    inrangePercent: {},
    distanceSum: {},
  };

  types.map((type) => {
    scores.distance[type] = Array(userKeystrokeData[type].filteredMeans.length).fill(0);
    scores.low[type] = Array(userKeystrokeData[type].filteredMeans.length).fill(0);
    scores.high[type] = Array(userKeystrokeData[type].filteredMeans.length).fill(0);
    scores.inrange[type] = Array(userKeystrokeData[type].filteredMeans.length).fill(0);
    scores.distanceSum[type] = 0;
    scores.inrangeCount[type] = 0;
    scores.totalCount[type] = 0;
    scores.inrangePercent[type] = 0;

    userKeystrokeData[type].filteredMeans.map((v, i) => {
      const mean = userKeystrokeData[type].filteredMeans[i];
      const sd = userKeystrokeData[type].filteredSd[i];
      const attemptTime = attemptKeystrokeData[type].times[i];

      scores.distance[type][i] = cityblock(mean, attemptTime);
      scores.distanceSum[type] += cityblock(mean, attemptTime);
      scores.low[type][i] = mean - (sd * sdThreshold);
      scores.high[type][i] = mean + (sd * sdThreshold);
      scores.inrange[type][i] = attemptTime >= scores.low[type][i]
        && attemptTime <= scores.high[type][i];

      scores.inrangeCount[type] += !!scores.inrange[type][i];
      scores.totalCount[type] += 1;
      return v;
    });

    scores.inrangePercent[type] = (scores.inrangeCount[type] / scores.totalCount[type]) * 100;

    return type;
  });

  return scores;
};

const calculateMahalanobisScores = ({
  userKeystrokeData,
  attemptKeystrokeData,
  distanceThreshold = 2,
}) => {
  const types = ['hold', 'flight', 'dd', 'full'];
  const scores = {
    distance: {},
    inrange: {},
  };

  types.map((type) => {
    scores.distance[type] = 0;
    scores.inrange[type] = false;

    const distance = mahalanobis(
      attemptKeystrokeData[type].times,
      userKeystrokeData[type].means,
      userKeystrokeData[type].covMatrix,
    );

    scores.distance[type] = distance;
    if (distance <= distanceThreshold) {
      scores.inrange[type] = true;
    }

    return type;
  });

  return scores;
};

const calculateAttemptScores = ({
  userKeystrokeData,
  attemptKeystrokeData,
  standardSdThreshold = 2.5,
  filteredSdThreshold = 2.5,
  mahalanobisDistanceThreshold = 2,
}) => {
  const scores = {
    standard: {},
    filtered: {},
    mahalanobis: {},
    standardSdThreshold,
    filteredSdThreshold,
    mahalanobisDistanceThreshold,
  };

  scores.standard = calculateStandardScores({
    userKeystrokeData,
    attemptKeystrokeData,
    sdThreshold: standardSdThreshold,
  });

  scores.filtered = calculateFilteredScores({
    userKeystrokeData,
    attemptKeystrokeData,
    sdThreshold: filteredSdThreshold,
  });

  scores.mahalanobis = calculateMahalanobisScores({
    userKeystrokeData,
    attemptKeystrokeData,
    distanceThreshold: mahalanobisDistanceThreshold,
  });

  return scores;
};

const verifyAttempt = ({
  scores,
  useStandard = true,
  useFiltered = false,
  useMahalanobis = false,
  standardThreshold = 65,
  filteredThreshold = 65,
}) => {
  const {
    standard: { inrangePercent: { full: standardScore } },
    filtered: { inrangePercent: { full: filteredScore } },
    mahalanobis: {
      inrange: { full: mahalanobisInrange },
      distance: { full: mahalanobisDistance },
    },
  } = scores;

  const standardAccepted = !useStandard || (standardScore >= standardThreshold);
  const filteredAccepted = !useFiltered || (filteredScore >= filteredThreshold);
  const mahalanobisAccepted = !useMahalanobis || mahalanobisInrange;

  const result = {
    useStandard,
    standardScore,
    standardThreshold,
    standardAccepted,
    useFiltered,
    filteredScore,
    filteredThreshold,
    filteredAccepted,
    useMahalanobis,
    mahalanobisDistance,
    mahalanobisAccepted,
    accepted: standardAccepted && filteredAccepted && mahalanobisAccepted,
  };

  return result;
};

module.exports = {
  processKeystrokeData,
  createSignupDataFromProcessedData,
  findUser,
  signUpNewUser,
  updateUser,
  addAttemptToKeystrokeData,
  calculateAttemptScores,
  verifyAttempt,
  computeDataTendencies,
};
