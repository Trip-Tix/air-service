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
                    return res.status(200).json({
                        layout: [],
                    });
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
                res.status(200).json(airInfo[0]);
            } catch(error) {
                console.log(error);
                res.status(500).json({ message: error.message })
            }
        }
    });
}



// Get unique air id for each air from air class details table
const getUniqueAirIdList = async (req, res) => {
    // get the token
    // console.log(req)
    const {token, airCompanyName} = req.body;
    if (!token) {
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
                console.log("getUniqueAirId called from air-service");
                console.log(req.body);
                // Get the air id from air company name
                const airIdQuery = { 
                    text: 'SELECT air_company_id FROM air_services WHERE air_company_name = $1',
                    values: [airCompanyName]
                };
                const airIdResult = await airPool.query(airIdQuery);
                const airId = airIdResult.rows[0].air_company_id;
                console.log("Air id", airId);

                // Get the unique air id from air class details table
                const query = {
                    text: 'SELECT unique_air_id FROM air_class_details WHERE air_company_id = $1',
                    values: [airId]
                };
                const result = await airPool.query(query);
                const uniqueAirId = result.rows;
                console.log(uniqueAirId);
                res.status(200).json(uniqueAirId);
            } catch (error) {
                console.log(error);
                res.status(500).json({ message: error.message });
            }
        }
    });
}


// Add air info
const addAirInfo = async (req, res) => {
    // get the token
    // console.log(req)
    const { token, airCompanyName, classes, numFlight, uniqueFlightId, numSeats, layouts, rows, cols, facilities } = req.body;
    if (!token) {
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

                console.log({
                    airCompanyName,
                    classes,
                    numFlight,
                    uniqueFlightId,
                    numSeats,
                    layouts,
                    rows,
                    cols,
                    facilities
                })
                // Begin transaction
                await airPool.query('BEGIN');
                //get air_company_id from air_services
                const airIdQuery = {
                    text: 'SELECT air_company_id, number_of_planes FROM air_services WHERE air_company_name = $1',
                    values: [airCompanyName]
                };
                const airIdResult = await airPool.query(airIdQuery);
                const airId = airIdResult.rows[0].air_company_id;
                numberOfPlanes = airIdResult.rows[0].number_of_planes;
                console.log("Air id", airId);

                numberOfPlanes += numFlight;

                // update number_of_planes in air_services
                const updateNumberOfPlanesQuery = {
                    text: 'UPDATE air_services SET number_of_planes = $1 WHERE air_company_id = $2',
                    values: [numberOfPlanes, airId]
                };
                await airPool.query(updateNumberOfPlanesQuery);
                console.log("Number of planes updated");
                
                const numberOfTotalSeats = numSeats.reduce((accumulator, currentValue) => accumulator + currentValue, 0);
                console.log(numberOfTotalSeats);
                
                const classIds = classes.map(classObj => classObj.classId);
                console.log(classIds);

                // iterate through each unique flight id
                for (let i = 0; i < uniqueFlightId.length; i++) {
                    const flightId = uniqueFlightId[i];

                    // add flightId, airId, classIds, facilities, numberOfTotalSeats to air_class_details
                    const airClassDetailsQuery = {
                        text: 'INSERT INTO air_class_details (unique_air_id, air_company_id, class_info, facilities, number_of_seats) VALUES ($1, $2, $3, $4, $5)',
                        values: [flightId, airId, classIds, facilities, numberOfTotalSeats]
                    };
                    await airPool.query(airClassDetailsQuery);
                    console.log("Air Class Details added");
                }
                    

                for (let i = 0; i < classIds.length; i++) {
                    const numberOfSeats = numSeats[i];
                    const row = rows[i];
                    const col = cols[i];
                    const classId = classIds[i];
                    
                    if (row != -1 || col != -1) {
                        // add airId, numberOfSeats, row, col, classId to air_layout_info
                        const airLayoutInfoQuery = {
                            text: 'INSERT INTO air_layout_info (air_company_id, number_of_seats, row, col, class_id) VALUES ($1, $2, $3, $4, $5)',
                            values: [airId, numberOfSeats, row, col, classId]
                        };
                        await airPool.query(airLayoutInfoQuery);
                        console.log("Air Layout Info added");
                        
                        // get air_layout_id from air_layout_info
                        const airLayoutIdQuery = {
                            text: 'SELECT air_layout_id FROM air_layout_info WHERE air_company_id = $1 AND class_id = $2',
                            values: [airId, classId]
                        };
                        const airLayoutIdResult = await airPool.query(airLayoutIdQuery);
                        const airLayoutId = airLayoutIdResult.rows[0].air_layout_id;
                        console.log("Air Layout Id", airLayoutId);

                        // insert into air_seat_details table
                        for (let j = 0; j < row; j++) {
                            column_count = 0;
                            for (let k = 0; k < col; k++) {
                                seatName = null;
                                const isSeat = layouts[i][j][k];
                                
                                if (isSeat != 0) {
                                    seatName = String.fromCharCode(65 + j) + (column_count + 1);
                                    column_count++;
                                }

                                const seatQuery = {
                                    text: 'INSERT INTO air_seat_details (air_layout_id, seat_name, is_seat, row_id, col_id) VALUES ($1, $2, $3, $4, $5)',
                                    values: [airLayoutId, seatName, isSeat, j, k]
                                };
                                await airPool.query(seatQuery);
                            }
                        }
                        console.log("Air Seat Details added");
                    }
                }

                console.log("Air Info added");
                res.status(200).json({ message: 'Air Info added' });
            } catch (error) {
                // Rollback transaction
                await airPool.query('ROLLBACK');
                console.log(error);
                res.status(500).json({ message: error.message });
            } finally {
                // End transaction
                await airPool.query('COMMIT');
            }
        }
    });
}



// Get air information
const getAirInfo = async (req, res) => {
    // get the token
    // console.log(req)
    const {token, airCompanyName} = req.body;
    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }

    // verify the token
    console.log("token", token)
    console.log("secretKey", secretKey)
    jwt.verify(token, secretKey, async (err, decoded) => {
        if (err) {
            console.log("Unauthorized access: token invalid");
            return res.status(401).json({ message: 'Unauthorized access: token invalid' });
        }
        try {
            console.log("getAirInfo called from air-service");
            console.log(req.body);

            // Get the air id
            const airIdQuery = {
                text: 'SELECT air_company_id FROM air_services WHERE air_company_name = $1',
                values: [airCompanyName]
            };
            const airIdResult = await airPool.query(airIdQuery);
            const airId = airIdResult.rows[0].air_company_id;
            console.log("Air id", airId);

            let result = [];

            // Get the unique air id list
            const uniqueAirIdQuery = {
                text: 'SELECT unique_air_id, class_info, facilities, number_of_seats, status FROM air_class_details WHERE air_company_id = $1',
                values: [airId]
            };

            const uniqueAirIdResult = await airPool.query(uniqueAirIdQuery);
            const uniqueAirIdList = uniqueAirIdResult.rows;

            // iterate through each unique flight id
            for (let i = 0; i < uniqueAirIdList.length; i++) {
                const classIds = uniqueAirIdList[i].class_info;

                let layouts = [];
                let eachNumOfSeats = [];
                let layoutIds = [];
                let class_names = [];
                for (let i = 0; i < classIds.length; i++) {
                    const classId = classIds[i];

                    // Get the class name
                    const classNameQuery = {
                        text: 'SELECT class_name FROM class_info WHERE class_id = $1',
                        values: [classId]
                    };
                    const classNameResult = await airPool.query(classNameQuery);
                    const className = classNameResult.rows[0].class_name;
                    class_names.push(className);

                    let queryText = `SELECT air_layout_info.air_layout_id, air_layout_info.number_of_seats, air_layout_info.row, air_layout_info.col
                                    FROM air_layout_info
                                    WHERE air_layout_info.air_company_id = $1 AND air_layout_info.class_id = $2`;
                    let queryValues = [airId, classId];

                    const query = {
                        text: queryText,
                        values: queryValues
                    };
                    const result = await airPool.query(query);
                    
                    let layoutInfoArray = result.rows;

                    // if (layoutInfoArray.length === 0) {
                    //     return res.status(200).json({
                    //         layout: [],
                    //     });
                    // }
                    
                    let layoutInfo = layoutInfoArray[0];
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
                    layouts.push(layout);
                    eachNumOfSeats.push(layoutInfo.number_of_seats);
                    layoutIds.push(layoutInfo.air_layout_id);
                    layoutInfo.layout = layout;
                }

                uniqueAirIdList[i].layouts = layouts;
                uniqueAirIdList[i].eachNumOfSeats = eachNumOfSeats;
                uniqueAirIdList[i].layoutIds = layoutIds;
                uniqueAirIdList[i].class_names = class_names;
            }
            
            console.log(uniqueAirIdList);
            res.status(200).json(uniqueAirIdList);
        } catch (error) {
            console.log(error);
            res.status(500).json({ message: error.message });
        }
    });
}


// Get locations
const getAirLocations = async (req, res) => {
    // get the token
    // console.log(req)
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
            console.log("Unauthorized access: token invalid");
            res.status(401).json({ message: 'Unauthorized access: token invalid' });
        } else {
            try {
                console.log("getAirLocations called from air-service");
                const query = {
                    text: 'SELECT * FROM location_info'
                };
                const result = await airPool.query(query);
                const locations = result.rows;
                console.log(locations);
                res.status(200).json(locations);
            } catch (error) {
                console.log(error);
                res.status(500).json({ message: error.message });
            }
        }
    });
}


// Get available air
const getAvailableAir = async (req, res) => {
    // get the token
    // console.log(req)
    const {token, airCompanyName, date} = req.body;
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
                console.log("getAvailableAir called from air-service");
                console.log(req.body);
                
                // Get the air id from air company name
                const airIdQuery = {
                    text: 'SELECT air_company_id FROM air_services WHERE air_company_name = $1',
                    values: [airCompanyName]
                };
                const airIdResult = await airPool.query(airIdQuery);
                const airId = airIdResult.rows[0].air_company_id;
                console.log("Air id", airId);
                
                const dateParts = date.split('-');
                const isoDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`; // yyyy-mm-dd
                
                // Get the unique air id list from schedule info table whose schedule status is 1
                const scheduleInfoQuery = {
                    text: 'SELECT unique_air_id FROM air_schedule_info WHERE air_company_id = $1 AND schedule_status = $2 AND schedule_date = $3',
                    values: [airId, 1, isoDate]
                };
                const scheduleInfoResult = await airPool.query(scheduleInfoQuery);
                const uniqueAirIdList = scheduleInfoResult.rows;
                console.log(uniqueAirIdList);

                // Get the unique air id array from unique air id list
                let uniqueAirIdArray = [];
                for (let i = 0; i < uniqueAirIdList.length; i++) {
                    uniqueAirIdArray.push(uniqueAirIdList[i].unique_air_id);
                }

                // Get the unique air id list from air class details table whose unique air id is not in unique air id array
                const airClassDetailsQuery = {
                    text: 'SELECT unique_air_id, number_of_seats, class_info FROM air_class_details WHERE air_company_id = $1 AND unique_air_id NOT IN ($2)',
                    values: [airId, uniqueAirIdArray]
                };

                const airClassDetailsResult = await airPool.query(airClassDetailsQuery);
                const uniqueAirIdList1 = airClassDetailsResult.rows;
                console.log(uniqueAirIdList1);
                
                // Get the class names
                for (let i = 0; i < uniqueAirIdList1.length; i++) {
                    const classIds = uniqueAirIdList1[i].class_info;
                    let classNames = [];
                    for (let j = 0; j < classIds.length; j++) {
                        const classId = classIds[j];
                        const classNameQuery = {
                            text: 'SELECT class_name FROM class_info WHERE class_id = $1',
                            values: [classId]
                        };
                        const classNameResult = await airPool.query(classNameQuery);
                        const className = classNameResult.rows[0].class_name;
                        classNames.push(className);
                    }
                    uniqueAirIdList1[i].class_names = classNames;
                }

                let result = {}
                result.uniqueAirs = uniqueAirIdList1;
                console.log(result);
                res.status(200).json(result);
            } catch (error) {
                console.log(error);
                res.status(500).json({ message: error.message });
            }
        }
    });
}



// Add air schedule info with air id, source, destination, departure time, fare and date
const addAirScheduleInfo = async (req, res) => {
    // get the token
    // console.log(req)
    const {token, airCompanyName, src, dest, date, schedule} = req.body;

    if (!token) {
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
                // Begin transaction
                await airPool.query('BEGIN');
                console.log("addAirScheduleInfo called from air-service");
                console.log(req.body);

                // Get the air id from air company name
                const airIdQuery = {
                    text: 'SELECT air_company_id FROM air_services WHERE air_company_name = $1',
                    values: [airCompanyName]
                };
                const airIdResult = await airPool.query(airIdQuery);
                const airId = airIdResult.rows[0].air_company_id;
                console.log("Air id", airId);

                for (let i = 0; i < schedule.length; i++) {
                    let scheduleInfo = schedule[i];
                    console.log(scheduleInfo)
                    const { time, fare, uniqueFlightId } = scheduleInfo;

                    console.log(time);
                    console.log(fare);
                    console.log(uniqueFlightId);

                    const dateParts = date.split('-');
                    const isoDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`; // yyyy-mm-dd

                    console.log(isoDate);

                    // add air_company_id, unique_air_id, starting_point, ending_point, departure_time, air_fare, schedule_date to air_schedule_info
                    const airScheduleInfoQuery = {
                        text: 'INSERT INTO air_schedule_info (air_company_id, unique_air_id, starting_point, ending_point, departure_time, air_fare, schedule_date) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                        values: [airId, uniqueFlightId, src, dest, time, fare, isoDate]
                    };
                    await airPool.query(airScheduleInfoQuery);
                    console.log("Air schedule info added");

                    // Get the air schedule id from air schedule info table
                    const airScheduleIdQuery = {
                        text: 'SELECT air_schedule_id FROM air_schedule_info WHERE air_company_id = $1 AND unique_air_id = $2 AND starting_point = $3 AND ending_point = $4 AND departure_time = $5 AND schedule_date = $6 ORDER BY air_schedule_id DESC LIMIT 1',
                        values: [airId, uniqueFlightId, src, dest, time, isoDate]
                    };
                    const airScheduleIdResult = await airPool.query(airScheduleIdQuery);
                    const airScheduleId = airScheduleIdResult.rows[0].air_schedule_id;
                    console.log("Air schedule id: ", airScheduleId);

                    // Get class_info from air class details table
                    const airClassDetailsQuery = {
                        text: 'SELECT class_info FROM air_class_details WHERE air_company_id = $1 AND unique_air_id = $2',
                        values: [airId, uniqueFlightId]
                    };
                    const airClassDetailsResult = await airPool.query(airClassDetailsQuery);
                    const classInfo = airClassDetailsResult.rows[0].class_info;
                    console.log("Class info: ", classInfo);

                    for (let i = 0; i < classInfo.length; i++) {
                        const classId = classInfo[i];
    
                        let queryText = `SELECT air_layout_info.air_layout_id, air_layout_info.number_of_seats, air_layout_info.row, air_layout_info.col
                                        FROM air_layout_info
                                        WHERE air_layout_info.air_company_id = $1 AND air_layout_info.class_id = $2`;
                        let queryValues = [airId, classId];
    
                        const query = {
                            text: queryText,
                            values: queryValues
                        };
                        const result = await airPool.query(query);
                        
                        let layoutInfoArray = result.rows;
    
                        // if (layoutInfoArray.length === 0) {
                        //     return res.status(200).json({
                        //         layout: [],
                        //     });
                        // }

                        let layoutInfo = layoutInfoArray[0];
                        // Get seat details for each layout
                        let seatQuery = {
                            text: `SELECT air_seat_details.air_seat_id, air_seat_details.seat_name, air_seat_details.is_seat, air_seat_details.row_id, air_seat_details.col_id
                            FROM air_seat_details WHERE air_seat_details.air_layout_id = $1`,
                            values: [layoutInfo.air_layout_id]
                        };
    
                        const seatResult = await airPool.query(seatQuery);
                        let seatDetails = seatResult.rows;

                        // Add air seat details to air schedule seat details table
                        for (let j = 0; j < seatDetails.length; j++) {
                            let seat = seatDetails[j];
                            if (seat.is_seat) {
                                const airScheduleSeatDetailsQuery = {
                                    text: 'INSERT INTO air_schedule_seat_info (air_schedule_id, air_layout_id, air_seat_id) VALUES ($1, $2, $3)',
                                    values: [airScheduleId, layoutInfo.air_layout_id, seat.air_seat_id]
                                };
                                await airPool.query(airScheduleSeatDetailsQuery);
                            }
                        }
                        console.log("Air schedule seat details added");
                    }
                    
                }
                console.log("Air schedule details added");
                res.status(200).json({ message: 'Air schedule details added' });
            } catch (error) {
                console.log(error);
                // Rollback transaction
                await airPool.query('ROLLBACK');
                res.status(500).json({ message: error.message });
            } finally {
                // End transaction
                await airPool.query('COMMIT');
            }
        }
    });

}




// Add air info
const updateAirStatus = async (req, res) => {
    // get the token
    // console.log(req)
    const { token, airCompanyName, unique_flight_id, status } = req.body;
    if (!token) {
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
                // Begin transaction
                await airPool.query('BEGIN');
                
                // get air_company_id from air_services
                const airIdQuery = {
                    text: 'SELECT air_company_id FROM air_services WHERE air_company_name = $1',
                    values: [airCompanyName]
                };
                const airIdResult = await airPool.query(airIdQuery);
                const airId = airIdResult.rows[0].air_company_id;
                console.log("Air id", airId);

                console.log(status, " ", airId, " ", unique_flight_id);

                // update status in air_class_details based on air_company_id and unique_air_id
                const updateStatusQuery = {
                    text: 'UPDATE air_class_details SET status = $1 WHERE air_company_id = $2 AND unique_air_id = $3',
                    values: [status, airId, unique_flight_id]
                };
                await airPool.query(updateStatusQuery);

                console.log("Air Status Updated");
                res.status(200).json({ message: 'Air Status Updated' });
            } catch (error) {
                // Rollback transaction
                await airPool.query('ROLLBACK');
                console.log(error);
                res.status(500).json({ message: error.message });
            } finally {
                // End transaction
                await airPool.query('COMMIT');
            }
        }
    });
}

module.exports = {
    getClassInfo,
    addClassInfo,
    getAirLayout,
    getUniqueAirIdList,
    addAirInfo,
    getAirInfo,
    getAirLocations,
    getAvailableAir,
    addAirScheduleInfo,
    updateAirStatus,
}

