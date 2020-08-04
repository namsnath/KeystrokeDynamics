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
    },
    flight: {
      keys: [String],
      times: [[Number]],
      sums: [Number],
      means: [Number],
      sd: [Number],
    },
    dd: {
      keys: [String],
      times: [[Number]],
      sums: [Number],
      means: [Number],
      sd: [Number],
    },
    full: {
      keys: [String],
      times: [[Number]],
      sums: [Number],
      means: [Number],
      sd: [Number],
    },
  },
});

module.exports = mongoose.model('User', userSchema);
