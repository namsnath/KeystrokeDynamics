const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: String,

  keystrokeDataTimestamps: [Date],
  keystrokeData: {
    hold: {
      keys: [String],
      times: [[Number]],
      sums: [Number],
      means: [Number],
      sd: [Number],
      filteredMeans: [Number],
      filteredSd: [Number],
      covMatrix: [[Number]],
    },
    flight: {
      keys: [String],
      times: [[Number]],
      sums: [Number],
      means: [Number],
      sd: [Number],
      filteredMeans: [Number],
      filteredSd: [Number],
      covMatrix: [[Number]],
    },
    dd: {
      keys: [String],
      times: [[Number]],
      sums: [Number],
      means: [Number],
      sd: [Number],
      filteredMeans: [Number],
      filteredSd: [Number],
      covMatrix: [[Number]],
    },
    full: {
      keys: [String],
      times: [[Number]],
      sums: [Number],
      means: [Number],
      sd: [Number],
      filteredMeans: [Number],
      filteredSd: [Number],
      covMatrix: [[Number]],
    },
  },
});

module.exports = mongoose.model('User', userSchema);
