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
    },
    flight: {
      keys: [String],
      times: [[Number]],
      sums: [Number],
      means: [Number],
      sd: [Number],
      filteredMeans: [Number],
      filteredSd: [Number],
    },
    dd: {
      keys: [String],
      times: [[Number]],
      sums: [Number],
      means: [Number],
      sd: [Number],
      filteredMeans: [Number],
      filteredSd: [Number],
    },
    full: {
      keys: [String],
      times: [[Number]],
      sums: [Number],
      means: [Number],
      sd: [Number],
      filteredMeans: [Number],
      filteredSd: [Number],
    },
  },
});

module.exports = mongoose.model('User', userSchema);
