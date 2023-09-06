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


module.exports = {
    getClassInfo,
    addClassInfo
}

