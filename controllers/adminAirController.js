const { Pool } = require('pg');
const dotenv = require("dotenv")
const accountPool = require('../config/accountDB');
const airPool = require('../config/airDB');

dotenv.config()

// Get Air Info
const getAirInfo = async (req, res) => {
    try {
        console.log("getBusInfo called from bus-service");
        const query = {
            text: 'SELECT * FROM air_services'
        };
        const result = await airPool.query(query);
        const busInfo = result.rows;
        console.log(busInfo);
        res.status(200).json(busInfo);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

module.exports = {
    getAirInfo
}

