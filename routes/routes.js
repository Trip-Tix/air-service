const express = require('express');
const bodyParser = require('body-parser').json();
const adminAirController = require('../controllers/adminAirController');

const router = express.Router();

// Get Air info
router.get('/getAirInfo', bodyParser, adminAirController.getAirInfo);

module.exports = router;