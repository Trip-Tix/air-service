const express = require('express');
const bodyParser = require('body-parser').json();
const adminAirController = require('../controllers/adminAirController');


const router = express.Router();

// Get air class info
router.post('/api/admin/getClassInfo', bodyParser, adminAirController.getClassInfo);

// Add air class info
router.post('/api/admin/addClassInfo', bodyParser, adminAirController.addClassInfo);



module.exports = router;