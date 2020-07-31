const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: String,

  keystrokeSampleHeaders: [String],
  keystrokeSamples: [[Number]],

  keystrokeDataTimestamps: [Date],
  keystrokeData: {
    hold: {
      keys: [String],
      times: [[Number]],
    },
    flight: {
      keys: [String],
      times: [[Number]],
    },
    dd: {
      keys: [String],
      times: [[Number]],
    },
  },
});

module.exports = mongoose.model('User', userSchema);
