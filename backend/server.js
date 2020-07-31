const express = require('express');
const mongoose = require('mongoose');

// Utilities
const { logger, expressWinstonLogger } = require('./utilities/loggers.js');

// Routes
const userRoute = require('./routes/user');

// Environment constants
const API_PORT = process.env.API_PORT || 3001;
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/keystroke';

// Service Initialisation
mongoose.connect(MONGO_URL, { useFindAndModify: false });
const db = mongoose.connection;

db.on('error', logger.error.bind(logger, 'connection error:'));
db.once('open', () => {
  logger.info('Connected to MongoDB Instance');
});

// Express Initialisation
const app = express();

app.use(express.urlencoded({ extended: false }));
app.use(expressWinstonLogger);

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') { return res.status(200).end(); }

  return next();
});

// Routes
app.use('/user', userRoute);

app.get('/', (req, res) => {
  res.json({ msg: 'Default Route' });
});

app.listen(API_PORT, () => logger.info(`Listening on port ${API_PORT}`));
