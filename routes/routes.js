const express = require('express');
const bodyParser = require('body-parser').json();
const adminAirController = require('../controllers/adminAirController');
const userAirController = require('../controllers/userAirController');


const router = express.Router();

// Get air class info
router.post('/api/admin/getClassInfo', bodyParser, adminAirController.getClassInfo);

// Add air class info
router.post('/api/admin/addClassInfo', bodyParser, adminAirController.addClassInfo);

// Get single air layout details
router.post('/api/admin/getAirLayout', bodyParser, adminAirController.getAirLayout);

// Get unique air id list from admin
router.post('/api/admin/getUniqueAirIdList', bodyParser, adminAirController.getUniqueAirIdList);

// add air info
router.post('/api/admin/addAirInfo', bodyParser, adminAirController.addAirInfo);

// Get air info from admin
router.post('/api/admin/getAirInfo', bodyParser, adminAirController.getAirInfo);

// Get air location list from admin
router.post('/api/admin/getAirLocations', bodyParser, adminAirController.getAirLocations);


// Get available air list from admin
router.post('/api/admin/getAvailableAir', bodyParser, adminAirController.getAvailableAir);


// Add air schedule info from admin
router.post('/api/admin/addAirScheduleInfo', bodyParser, adminAirController.addAirScheduleInfo);

router.post('/api/getLocations', bodyParser, userAirController.getLocation);

router.post('/api/getScheduleWiseAirDetails', bodyParser, userAirController.getScheduleWiseAirDetails);

router.post('/api/getUniqueAirDetails', bodyParser, userAirController.getUniqueAirDetails);

router.post('/api/temporaryBookTicket', bodyParser, userAirController.tempBookSeat);

module.exports = router;