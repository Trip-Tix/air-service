const express = require('express');
const bodyParser = require('body-parser').json();
const adminAirController = require('../controllers/adminAirController');


const router = express.Router();

// Get air class info
router.post('/api/admin/getClassInfo', bodyParser, adminAirController.getClassInfo);

// Add air class info
router.post('/api/admin/addClassInfo', bodyParser, adminAirController.addClassInfo);

// Get single air layout details
router.post('/api/admin/getAirLayout', bodyParser, adminAirController.getAirLayout);

// Get unique air id list from admin
router.post('/api/admin/getUniqueAirIdList', bodyParser, adminAirController.getUniqueAirIdList);

module.exports = router;