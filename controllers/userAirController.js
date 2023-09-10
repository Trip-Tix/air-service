const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const airPool = require("../config/airDB.js");
const accountPool = require("../config/accountDB.js");

dotenv.config();

const secretKey = process.env.SECRETKEY;

// Get all air from source, destination and date
const getScheduleWiseAirDetails = async (req, res) => {
    console.log("getScheduleWiseAirDetails called from air-service");
    console.log("req.body: ", req.body);
    const { source, destination, journeyDate } = req.body;
    try {
        // Parse journeyDate and returnDate
        const journeyDateParts = journeyDate.split("-");
        // const returnDateParts = returnDate.split('-');
        const isoJourneyDate = `${journeyDateParts[2]}-${journeyDateParts[1]}-${journeyDateParts[0]}`; // yyyy-mm-dd
        // const isoReturnDate = `${returnDateParts[2]}-${returnDateParts[1]}-${returnDateParts[0]}`; // yyyy-mm-dd


        const getAirDetailsQuery = {
            text: `SELECT unique_air_id, air_company_id, air_schedule_id, departure_time, air_fare    
            FROM air_schedule_info 
            WHERE starting_point = $1 
            AND ending_point = $2 
            AND schedule_date = $3 
            AND schedule_status = 1`,
            values: [source, destination, isoJourneyDate],
        };

        const getAirDetailsResult = await airPool.query(getAirDetailsQuery);
        const airDetails = getAirDetailsResult.rows;
        console.log("airDetails: ", airDetails);

        if (airDetails.length === 0) {
            return res.status(200).json([]);
        }

        let responseData = [];
        let responseObj = {};

        for (let i = 0; i < airDetails.length; i++) {
            const airId = airDetails[i].air_company_id;
            const uniqueAirId = airDetails[i].unique_air_id;
            const airScheduleId = airDetails[i].air_schedule_id;
            const airFares = airDetails[i].air_fare;

            // Change the departure time format to hh:mm AM/PM
            const departureTime = airDetails[i].departure_time;
            const departureTimeParts = departureTime.split(":");
            let hour = parseInt(departureTimeParts[0]);
            let minute = departureTimeParts[1];
            let ampm = "AM";
            if (hour > 12) {
                hour -= 12;
                ampm = "PM";
            }
            if (hour === 12) {
                ampm = "PM";
            }
            if (hour === 0) {
                hour = 12;
            }
            const departureTimeFormatted = `${hour}:${minute} ${ampm}`;
            airDetails[i].departure_time = departureTimeFormatted;

            airDetails[i].arrival_time = "";

            // Get air company name from air_services table
            const getAirCompanyNameQuery = {
                text: `SELECT air_company_name FROM air_services WHERE air_company_id = $1`,
                values: [airId],
            };
            const getAirCompanyNameResult = await airPool.query(
                getAirCompanyNameQuery
            );
            const airCompanyName = getAirCompanyNameResult.rows[0].air_company_name;

            // Get the class info from air_class info table
            const getCoachInfoQuery = {
                text: `SELECT class_info, facilities FROM air_class_details 
                WHERE unique_air_id = $1`,
                values: [uniqueAirId],
            };
            const getCoachInfoResult = await airPool.query(getCoachInfoQuery);
            const facilities = getCoachInfoResult.rows[0].facilities;
            const classInfo = getCoachInfoResult.rows[0].class_info;

            for (let j = 0; j < classInfo.length; j++) {
                responseObj = {};
                const classId = classInfo[j];

                // Get the class name from class_info table and fare from air fare table
                const getCoachNameQuery = {
                    text: `SELECT class_name FROM class_info WHERE class_id = $1`,
                    values: [classId],
                };
                const getCoachNameResult = await airPool.query(getCoachNameQuery);
                const className = getCoachNameResult.rows[0].class_name;

                const airFare = airFares[j];

                // Get the air layout id
                const getAirLayoutIdQuery = {
                    text: `SELECT air_layout_id, number_of_seats, row, col
                    FROM air_layout_info
                    WHERE class_id = $1
                    AND air_company_id = $2`,
                    values: [classId, airId],
                };
                const getAirLayoutIdResult = await airPool.query(
                    getAirLayoutIdQuery
                );
                const airLayoutId = getAirLayoutIdResult.rows[0].air_layout_id;
                const numberOfSeats = getAirLayoutIdResult.rows[0].number_of_seats;
                const row = getAirLayoutIdResult.rows[0].row;
                const col = getAirLayoutIdResult.rows[0].col;

                // Get available seat count query
                const getAvailableSeatCountQuery = {
                    text: `SELECT COUNT(*)
                    FROM air_schedule_seat_info
                    WHERE air_schedule_id = $1
                    AND air_layout_id = $2
                    AND booked_status = 0`,
                    values: [airScheduleId, airLayoutId],
                };
                const getAvailableSeatCountResult = await airPool.query(
                    getAvailableSeatCountQuery
                );
                const availableSeatCount = getAvailableSeatCountResult.rows[0].count;

                responseObj.class_name = className;
                responseObj.air_fare = airFare;
                responseObj.air_company_name = airCompanyName;
                responseObj.brand_name = "";
                responseObj.unique_air_id = uniqueAirId;
                responseObj.air_schedule_id = airScheduleId;
                responseObj.departure_time = departureTimeFormatted;
                responseObj.facilities = facilities;
                responseObj.air_company_id = airId;
                responseObj.number_of_seats = numberOfSeats;
                responseObj.available_seat_count = availableSeatCount;

                responseData.push(responseObj);
                
                // console.log(responseObj);
            }

            
        }

        // console.log("airDetails: ", responseData);

        return res.status(200).json(responseData);
    } catch (error) {
        console.log("error: ", error);
        return res.status(500).json(error);
    }
};

// Get unique air details
const getUniqueAirDetails = async (req, res) => {
    console.log("getUniqueAirDetails called from air-service");

    // Get the token
    const { token, uniqueAirId, airId, airScheduleId, classId } = req.body;
    if (!token) {
        console.log("No token provided");
        return res.status(401).json({ message: "No token provided" });
    }

    // Verify the token
    jwt.verify(token, secretKey, async (err, decoded) => {
        if (err) {
            console.log("Failed to authenticate token");
            return res.status(500).json({ message: "Failed to authenticate token" });
        }


        // Get the air layout id
        const getAirLayoutIdQuery = {
            text: `SELECT air_layout_id, number_of_seats, row, col
            FROM air_layout_info
            WHERE air_class_id = $1
            AND air_company_id = $2`,
            values: [classId, airId],
        };
        const getAirLayoutIdResult = await airPool.query(getAirLayoutIdQuery);
        const airLayoutId = getAirLayoutIdResult.rows[0].air_layout_id;
        const numberOfSeats = getAirLayoutIdResult.rows[0].number_of_seats;
        const row = getAirLayoutIdResult.rows[0].row;
        const col = getAirLayoutIdResult.rows[0].col;
        let availableSeatCount = numberOfSeats;
        console.log("airLayoutId: ", airLayoutId);

        // Get the seat details
        const getSeatDetailsQuery = {
            text: `SELECT air_seat_id, seat_name, is_seat, row_id, col_id
            FROM air_seat_details
            WHERE air_layout_id = $1`,
            values: [airLayoutId],
        };
        const getSeatDetailsResult = await airPool.query(getSeatDetailsQuery);
        const seatDetails = getSeatDetailsResult.rows;

        // Get the schedule seat details
        const getScheduleSeatDetailsQuery = {
            text: `SELECT air_schedule_seat_id, air_seat_id, booked_status, passenger_id, passenger_gender  
            FROM air_schedule_seat_info
            WHERE air_schedule_id = $1 
            AND air_layout_id = $2`,
            values: [airScheduleId, airLayoutId],
        };
        const getScheduleSeatDetailsResult = await airPool.query(
            getScheduleSeatDetailsQuery
        );
        const scheduleSeatDetails = getScheduleSeatDetailsResult.rows;

        let layout = [];
        for (let i = 0; i < row; i++) {
            layout.push(new Array(col).fill(0));
        }

        let seatName = [];
        for (let i = 0; i < row; i++) {
            seatName.push(new Array(col).fill(""));
        }

        let airSeatId = [];
        for (let i = 0; i < row; i++) {
            airSeatId.push(new Array(col).fill(-1));
        }

        for (let i = 0; i < seatDetails.length; i++) {
            let seat = seatDetails[i];
            console.log("seat: ", seat);
            if (seat.is_seat) {
                layout[seat.row_id][seat.col_id] = 1;
                seatName[seat.row_id][seat.col_id] = seat.seat_name;
                airSeatId[seat.row_id][seat.col_id] = seat.air_seat_id;
            }
        }

        for (let i = 0; i < scheduleSeatDetails.length; i++) {
            let seat = scheduleSeatDetails[i];
            if (seat.booked_status === 1) {
                // Temporary Booked
                availableSeatCount--;
                let seatId = seat.air_seat_id;
                for (let j = 0; j < seatDetails.length; j++) {
                    if (seatId === seatDetails[j].air_seat_id) {
                        if (seat.passenger_gender === "M") {
                            layout[seatDetails[j].row_id][seatDetails[j].col_id] = 4;
                        } else {
                            layout[seatDetails[j].row_id][seatDetails[j].col_id] = 5;
                        }
                        break;
                    }
                }
            } else if (seat.booked_status === 2) {
                // Permanent Booked
                availableSeatCount--;
                let seatId = seat.air_seat_id;
                for (let j = 0; j < seatDetails.length; j++) {
                    if (seatId === seatDetails[j].air_seat_id) {
                        if (seat.passenger_gender === "M") {
                            layout[seatDetails[j].row_id][seatDetails[j].col_id] = 2;
                        } else {
                            layout[seatDetails[j].row_id][seatDetails[j].col_id] = 3;
                        }
                        break;
                    }
                }
            }
        }

        console.log("layout: ", layout);
        console.log("seatName: ", seatName);

        return res
            .status(200)
            .json({ layout, seatName, airSeatId, numberOfSeats, availableSeatCount });
    });
};

// Temporary book seat
const tempBookSeat = async (req, res) => {
    // get the token
    console.log(req.body);
    const { token, ticketInfo, userId } = req.body;

    if (!token) {
        console.log("No token provided");
        return res.status(401).json({ message: "No token provided" });
    }

    // Verify the token
    jwt.verify(token, secretKey, async (err, decoded) => {
        if (err) {
            console.log("Failed to authenticate token");
            return res.status(500).json({ message: "Failed to authenticate token" });
        }

        try {
            console.log("Temporary book seat called from air-service");
            // Begin transaction
            await airPool.query("BEGIN");
            await accountPool.query("BEGIN");

            // Get the current date and time
            const today = new Date();
            const todayYear = today.getFullYear();
            const todayMonth = today.getMonth() + 1;
            const todayDate = today.getDate();
            const todayHour = today.getHours();
            const todayMinute = today.getMinutes();
            const todaySecond = today.getSeconds();
            const bookingTimestamp = new Date(
                `${todayYear}-${todayMonth}-${todayDate} ${todayHour}:${todayMinute}:${todaySecond}`
            ).getTime();

            const currentDate = `${todayYear}-${todayMonth}-${todayDate} ${todayHour}:${todayMinute}:${todaySecond}`; // yyyy-mm-dd

            let responseData = [];
            let tempResponseData = [];

            let grandTotalFare = 0;
            let tempTotalFare = 0;

            let isValidTicketPresent = false;
            let isInvalidTicketPresent = false;

            for (let i = 0; i < ticketInfo.length; i++) {
                const ticket = ticketInfo[i];
                const { airScheduleId, passengerInfo, source, destination } = ticket;
                const ticketId = Math.random().toString().substring(2, 17);

                // Get source and destination name from location_info table
                const getSourceNameQuery = {
                    text: `SELECT location_name FROM location_info WHERE location_id = $1`,
                    values: [source],
                };
                const getSourceNameResult = await airPool.query(getSourceNameQuery);
                const sourceName = getSourceNameResult.rows[0].location_name;

                const getDestinationNameQuery = {
                    text: `SELECT location_name FROM location_info WHERE location_id = $1`,
                    values: [destination],
                };
                const getDestinationNameResult = await airPool.query(
                    getDestinationNameQuery
                );
                const destinationName = getDestinationNameResult.rows[0].location_name;

                console.log("passengerInfo: ", passengerInfo);

                // Generate unique ticket ID of 15 characters length with numbers only

                // Get the air ticket fare 
                const getAirTicketFareQuery = {
                    text: `SELECT air_fare FROM air_schedule_info WHERE air_schedule_id = $1`,
                    values: [airScheduleId],
                };
                const getAirTicketFareResult = await airPool.query(
                    getAirTicketFareQuery
                );
                const airTicketFare = parseInt(getAirTicketFareResult.rows[0].air_fare);

                let perValidTicketFare = 0;
                let perTempTicketFare = 0;
                let temporaryNumberOfTickets = 0;

                let passengerIdArray = [];

                let temporaryAirSeatIdArray = [];
                let temporaryPassengerIdArray = [];


                for (let i = 0; i < passengerInfo.length; i++) {
                    const passenger = passengerInfo[i];
                    const {
                        airSeatId,
                        passengerName,
                        passengerGender,
                        passengerMobile,
                        passengerDob,
                        passengerNid,
                        passengerBirthCertficate,
                        isTemp,
                    } = passenger;

                    // Age calculation
                    const passengerDobParts = passengerDob.split("-");
                    const passengerDobYear = parseInt(passengerDobParts[2]);
                    const passengerDobMonth = parseInt(passengerDobParts[1]);
                    const passengerDobDate = parseInt(passengerDobParts[0]);

                    const today = new Date();
                    const todayYear = today.getFullYear();
                    const todayMonth = today.getMonth() + 1;
                    const todayDate = today.getDate();

                    let age = todayYear - passengerDobYear;
                    if (todayMonth < passengerDobMonth) {
                        age--;
                    } else if (todayMonth === passengerDobMonth) {
                        if (todayDate < passengerDobDate) {
                            age--;
                        }
                    }
                    console.log("dob: ", passengerDob);
                    console.log("age: ", age);

                    // Check if passenger already exists
                    const checkPassengerQuery = {
                        text: `SELECT passenger_id FROM passenger_info 
                        WHERE passenger_nid = $1 
                        OR passenger_birth_certificate = $2`,
                        values: [passengerNid, passengerBirthCertficate],
                    };
                    const checkPassengerResult = await accountPool.query(
                        checkPassengerQuery
                    );
                    const passengerResultInfo = checkPassengerResult.rows;
                    let passengerId = -1;
                    if (passengerResultInfo.length === 0) {
                        // Add passenger
                        const addPassengerQuery = {
                            text: `INSERT INTO passenger_info(
                                passenger_name, passenger_nid, passenger_birth_certificate, 
                                passenger_passport, passenger_mobile, passenger_gender, passenger_age)
                                VALUES ($1, $2, $3, $4, $5, $6, $7);`,
                            values: [
                                passengerName,
                                passengerNid,
                                passengerBirthCertficate,
                                "",
                                passengerMobile,
                                passengerGender,
                                age,
                            ],
                        };
                        await accountPool.query(addPassengerQuery);
                        console.log("Passenger added successfully");

                        // Get the passenger id
                        const getPassengerIdQuery = {
                            text: `SELECT passenger_id FROM passenger_info
                            WHERE passenger_nid = $1
                            OR passenger_birth_certificate = $2`,
                            values: [passengerNid, passengerBirthCertficate],
                        };
                        const getPassengerIdResult = await accountPool.query(
                            getPassengerIdQuery
                        );
                        passengerId = parseInt(getPassengerIdResult.rows[0].passenger_id);
                    } else {
                        passengerId = parseInt(passengerResultInfo[0].passenger_id);
                    }

                    if (isTemp) {
                        isInvalidTicketPresent = true;
                        perTempTicketFare += airTicketFare;
                        temporaryAirSeatIdArray.push(airSeatId);
                        temporaryPassengerIdArray.push(passengerId);
                        temporaryNumberOfTickets++;
                    } else {
                        isValidTicketPresent = true;
                        // Temporary booking ticket
                        perValidTicketFare += airTicketFare;
                        passengerIdArray.push(passengerId);
                        const tempBookSeatQuery = {
                            text: `UPDATE air_schedule_seat_info
                        SET booked_status = 1, passenger_id = $1, passenger_gender = $2, booking_time = $3, ticket_id = $4  
                        WHERE air_schedule_id = $5
                        AND air_seat_id = $6`,
                            values: [
                                passengerId,
                                passengerGender,
                                bookingTimestamp,
                                ticketId,
                                airScheduleId,
                                airSeatId,
                            ],
                        };
                        await airPool.query(tempBookSeatQuery);
                        console.log("Seat temporarily booked successfully");
                    }
                }

                if (isValidTicketPresent) {
                    const numTickets = passengerIdArray.length;
                    const insertIntoTicketInfoQuery = {
                        text: `INSERT INTO ticket_info (ticket_id, user_id, air_schedule_id, 
                            number_of_tickets, total_fare, passenger_info, date, source, destination) 
                            VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                        values: [ticketId, userId, airScheduleId, numTickets, perValidTicketFare, passengerIdArray, currentDate, sourceName, destinationName]
                    }
                    await airPool.query(insertIntoTicketInfoQuery);
                    console.log("Temporary Ticket added successfully");
                    responseData.push({
                        ticketId,
                        passengerIdArray,
                        airScheduleId,
                        totalFare: perValidTicketFare,
                        numberOfTickets: numTickets,
                    });
                }

                if (isInvalidTicketPresent) {
                    // Insert to ticket queue
                    const queueTicketId = Math.random().toString().substring(2, 17);
                    const insertIntoTicketQueueQuery = {
                        text: `INSERT INTO ticket_queue 
                        (queue_ticket_id, user_id, total_fare, air_schedule_id, number_of_tickets, passenger_info, air_seat_id, date, source, destination)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                        values: [
                            queueTicketId,
                            userId,
                            perTempTicketFare,
                            airScheduleId,
                            temporaryNumberOfTickets,
                            temporaryPassengerIdArray,
                            temporaryAirSeatIdArray,
                            currentDate,
                            sourceName,
                            destinationName,
                        ],
                    };
                    await airPool.query(insertIntoTicketQueueQuery);
                    console.log("Ticket added to queue successfully");
                    tempResponseData.push({
                        ticketId: queueTicketId,
                        passengerIdArray: temporaryPassengerIdArray,
                        airScheduleId,
                        totalFare: perTempTicketFare,
                        numberOfTickets: temporaryNumberOfTickets,
                    });
                } 
                
                grandTotalFare += perValidTicketFare;
                tempTotalFare += perTempTicketFare;
            }
            const responseObj = {
                ticketInfo: responseData,
                tempTicketInfo: tempResponseData,
                grandTotalFare,
                tempTotalFare,
                userId,
            };
            console.log("Temporary ticket booked successfully");
            res.status(200).json(responseObj);
        } catch (error) {
            // Rollback transaction
            await airPool.query("ROLLBACK");
            await accountPool.query("ROLLBACK");
            console.log("error here: ", error);
            res.status(500).json(error);
        } finally {
            // Commit transaction
            await airPool.query("COMMIT");
            await accountPool.query("COMMIT");
        }
    });
};

// Get districts
const getLocation = async (req, res) => {
    try {
        console.log("getDistricts called from air-service");
        const query = {
            text: "SELECT location_id, location_name FROM location_info",
        };
        const result = await airPool.query(query);
        const districts = result.rows;
        console.log(districts);
        res.status(200).json(districts);
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getScheduleWiseAirDetails,
    getUniqueAirDetails,
    tempBookSeat,
    getLocation,
};
