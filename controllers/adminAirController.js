const { Pool } = require('pg');
const dotenv = require("dotenv")

dotenv.config()

// Connect to Postgres
const pool = new Pool({
    host: process.env.PGHOST,
    port: process.env.PGPORT,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    idleTimeoutMillis: 0,
    connectionTimeoutMillis: 0,
    ssl: {
        rejectUnauthorized: false
    }
});

pool.connect(err => {
    if (err) {
        console.error('connection error', err.stack);
    } else {
        console.log('connected to database');
    }
});

// Get AIr Info
const getAirInfo = async (req, res) => {
    try {
        console.log("getBusInfo called from bus-service");
        const query = {
            text: 'SELECT * FROM air_services'
        };
        const result = await pool.query(query);
        const busInfo = result.rows;
        console.log(busInfo);
        res.status(200).json(busInfo);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

module.exports = {
    getBusInfo
}

