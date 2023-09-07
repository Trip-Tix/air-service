const { Pool } = require('pg');
const dotenv = require("dotenv")
const accountPool = require('../config/accountDB');
const airPool = require('../config/airDB');
const jwt = require('jsonwebtoken');

dotenv.config()

const secretKey = process.env.SECRETKEY;


// Get Class Info
const getClassInfo = async (req, res) => {
    const {token} = req.body;
    
    if (!token) {
        console.log("No token provided");
        return res.status(401).json({ message: 'No token provided' });
    }

    // verify the token
    console.log("token", token)
    console.log("secretKey", secretKey)
    jwt.verify(token, secretKey, async (err, decoded) => {
        if (err) {
            console.log("Unauthorized access");
            res.status(401).json({ message: 'Unauthorized access: invalid token' });
        } else {
            try {
                console.log("getClassInfo called from air-service");
                const query = {
                    text: 'SELECT * FROM class_info'
                };
                const result = await airPool.query(query);
                const classInfo = result.rows;
                console.log(classInfo);
                res.status(200).json(classInfo);
            } catch (error) {
                res.status(500).json({ message: error.message });
            }
        }
    });
}

// Add class info with class name
const addClassInfo = async (req, res) => {
    const {token, className, adminRole} = req.body;

    if (!token) {
        console.log("No token provided");
        return res.status(401).json({ message: 'No token provided' });
    }

    // verify the token
    console.log("token", token)
    console.log("secretKey", secretKey)
    jwt.verify(token, secretKey, async (err, decoded) => {
       if (err) {
            console.log("Unauthorized access: token invalid");
            res.status(401).json({ message: 'Unauthorized access: token invalid' });
        } else {
            try {
                console.log("addClassInfo called from air-service");
                console.log(req.body);
                // Check admin role
                if (adminRole !== 'ADMIN') {
                    console.log("Unauthorized access: admin role invalid");
                    return res.status(401).json({ message: 'Unauthorized access: admin role invalid' });
                }
                // Check if class name already exists
                const checkQuery = {
                    text: 'SELECT * FROM class_info WHERE class_name = $1',
                    values: [className]
                };
                const checkResult = await airPool.query(checkQuery);
                if (checkResult.rows.length > 0) {
                    console.log("Class name already exists");
                    return res.status(400).json({ message: 'Class name already exists' });
                }
                const query = {
                    text: 'INSERT INTO class_info (class_name) VALUES ($1)',
                    values: [className]
                };
                await airPool.query(query);
                console.log("Class added");
                res.status(200).json({ message: 'Air Class added' });
            } catch (error) {
                res.status(500).json({ message: error.message });
            }
        }
    });
}


// Get air details
const getAirLayout = async (req, res) => {
    // get the token
    console.log(req.body)
    const {token, airCompanyName, classId} = req.body;
    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }

    // verify the token
    console.log("token", token)
    console.log("secretKey", secretKey)

    jwt.verify(token, secretKey, async (err, decoded) => {
        if (err) {
            console.log("Unauthorized access");
            res.status(401).json({ message: 'Unauthorized access: token invalid' });
        } else {
            try {
                console.log("getAirLayout called from air-service");
                console.log(req.body);

                // Get the air id from air company name
                const airIdQuery = {
                    text: 'SELECT air_company_id FROM air_services WHERE air_company_name = $1',
                    values: [airCompanyName]
                };
                const airIdResult = await airPool.query(airIdQuery);
                const airId = airIdResult.rows[0].air_company_id;
                console.log("Air id", airId);

                let queryText = `SELECT air_layout_info.air_layout_id, air_layout_info.number_of_seats, air_layout_info.row, air_layout_info.col
                                FROM air_layout_info
                                WHERE air_layout_info.air_company_id = $1 AND air_layout_info.class_id = $2`;
                let queryValues = [airId, classId];

                const query = {
                    text: queryText,
                    values: queryValues
                };
                const result = await airPool.query(query);
                let airInfo = result.rows;

                if (airInfo.length === 0) {
                    return res.status(200).json([]);
                }

                for (let i = 0; i < airInfo.length; i++) {
                    let layoutInfo = airInfo[i];
                    // Get seat details for each layout
                    let seatQuery = {
                        text: `SELECT air_seat_details.seat_name, air_seat_details.is_seat, air_seat_details.row_id, air_seat_details.col_id
                        FROM air_seat_details WHERE air_seat_details.air_layout_id = $1`,
                        values: [layoutInfo.air_layout_id]
                    };

                    const seatResult = await airPool.query(seatQuery);
                    let seatDetails = seatResult.rows;
                    let layout = [];
                    for (let i = 0; i < layoutInfo.row; i++) {
                        layout.push(new Array(layoutInfo.col).fill(0));
                    }
                    for (let i = 0; i < seatDetails.length; i++) {
                        let seat = seatDetails[i];
                        if (seat.is_seat) {
                            layout[seat.row_id][seat.col_id] = 1;
                        }
                    }
                    layoutInfo.layout = layout;
                }
                console.log(airInfo[0]);                
                res.status(200).json();
            } catch(error) {
                console.log(error);
                res.status(500).json({ message: error.message })
            }
        }
    });
}

module.exports = {
    getClassInfo,
    addClassInfo,
    getAirLayout
}

