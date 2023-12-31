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
                responseObj.class_id = classId;

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

        try {
            // Get the air layout id
        const getAirLayoutIdQuery = {
            text: `SELECT air_layout_id, number_of_seats, row, col
            FROM air_layout_info
            WHERE class_id = $1
            AND air_company_id = $2`,
            values: [classId, airId],
        };
        const getAirLayoutIdResult = await airPool.query(getAirLayoutIdQuery);
        console.log("getAirLayoutIdResult: ", getAirLayoutIdResult.rows);
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
                        if (seat.passenger_gender === "Male") {
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
                        if (seat.passenger_gender === "Male") {
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
        } catch (error) {
            console.log(error);
            return res.status(500).json(error);
        }

        
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
                const { airScheduleId, passengerInfo, source, destination, airFare, classId } = ticket;
                const ticketId = Math.random().toString().substring(2, 17);

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
                const airTicketFare = airFare;

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
                    const passengerDobYear = parseInt(passengerDobParts[0]);
                    const passengerDobMonth = parseInt(passengerDobParts[1]);
                    const passengerDobDate = parseInt(passengerDobParts[2]);

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
                        SET booked_status = 1, passenger_id = $1, passenger_gender = $2, booking_time = $3, ticket_id = $4, user_id = $5  
                        WHERE air_schedule_id = $6
                        AND air_seat_id = $7`,
                            values: [
                                passengerId,
                                passengerGender,
                                bookingTimestamp,
                                ticketId,
                                userId,
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
                            number_of_tickets, total_fare, passenger_info, date, source, destination, class_id) 
                            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                        values: [ticketId, userId, airScheduleId, numTickets, perValidTicketFare, passengerIdArray, currentDate, source, destination, classId]
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
                        (queue_ticket_id, user_id, total_fare, air_schedule_id, number_of_tickets, passenger_info, air_seat_id, date, source, destination, class_id)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
                        values: [
                            queueTicketId,
                            userId,
                            perTempTicketFare,
                            airScheduleId,
                            temporaryNumberOfTickets,
                            temporaryPassengerIdArray,
                            temporaryAirSeatIdArray,
                            currentDate,
                            source,
                            destination,
                            classId,
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
            text: "SELECT location_id, CONCAT (location_name || ' - ' || airport_name) AS location_name FROM location_info",
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

// Check temporary booked seat
const cancel = async (req, res) => {
    console.log('cancel called from air-service');
    console.log('req.body: ', req.body);

    const { ticketId } = req.body;

    try {

        const currentTime = new Date().getTime();

        // Get the airScheduleId from ticketId
        const getBusScheduleIdQuery = {
            text: `SELECT air_schedule_id
                        FROM ticket_info
                        WHERE ticket_id = $1`,
            values: [ticketId]
        }
        const getBusScheduleIdResult = await airPool.query(getBusScheduleIdQuery);

        if (getBusScheduleIdResult.rows.length === 0) {
            // delete from ticket queue
            const deleteFromQueueQuery = {
                text: `DELETE FROM ticket_queue
                        WHERE queue_ticket_id = $1`,
                values: [ticketId]
            }
            await airPool.query(deleteFromQueueQuery);

            return res.status(200).json({ message: 'Ticket cancelled successfully' });
        }

        const airScheduleId = getBusScheduleIdResult.rows[0].air_schedule_id;
        const bookedStatus = getBusScheduleIdResult.rows[0].booked_status;

        // Remove from ticket_info
        const removeFromTicketInfoQuery = {
            text: `DELETE FROM ticket_info
                        WHERE ticket_id = $1`,
            values: [ticketId]
        }
        await airPool.query(removeFromTicketInfoQuery);

        // Update status to 0
        const updateStatusQuery = {
            text: `UPDATE air_schedule_seat_info
                        SET booked_status = 0, user_id = NULL, ticket_id = NULL, booking_time = NULL, passenger_id = NULL, passenger_gender = NULL  
                        WHERE ticket_id = $1`,
            values: [ticketId]
        }
        await airPool.query(updateStatusQuery);

        if (bookedStatus === 1) {
            // Search in ticket_queue with air_schedule_id
            const getExpiredBusSeatIdQuery = {
                text: `SELECT *
                        FROM ticket_queue
                        WHERE air_schedule_id = $1 ORDER BY date ASC`,
                values: [airScheduleId]
            }
            const getExpiredBusSeatIdResult = await airPool.query(getExpiredBusSeatIdQuery);
            const queueInfo = getExpiredBusSeatIdResult.rows;

            if (queueInfo.length === 0) {
                return res.status(200).json({ message: 'No queue found' });
            }

            const expiredTicket = queueInfo[0];
            const userId = expiredTicket.user_id;


            // Insert into ticket_info
            const insertTicketInfoQuery = {
                text: `INSERT INTO ticket_info (ticket_id, user_id, total_fare, air_schedule_id, number_of_tickets, passenger_info, date, source, destination, class_id)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING ticket_id`,
                values: [expiredTicket.queue_ticket_id, expiredTicket.user_id, expiredTicket.total_fare, expiredTicket.air_schedule_id, expiredTicket.number_of_tickets, expiredTicket.passenger_info, expiredTicket.date, expiredTicket.source, expiredTicket.destination, expiredTicket.class_id]
            }
            const insertTicketInfoResult = await airPool.query(insertTicketInfoQuery);

            // Remove from ticket_queue
            const removeFromTicketQueueQuery = {
                text: `DELETE FROM ticket_queue
                                    WHERE queue_ticket_id = $1`,
                values: [expiredTicket.queue_ticket_id]
            }
            await airPool.query(removeFromTicketQueueQuery);

            const expiredSeatIdArray = expiredTicket.air_seat_id;

            // Update status to 1
            for (let i = 0; i < expiredSeatIdArray.length; i++) {
                const updateStatusQuery = {
                    text: `UPDATE air_schedule_seat_info
                            SET user_id = $1, booked_status = 1, ticket_id = $2, booking_time = $3
                            WHERE air_schedule_id = $4
                            AND air_seat_id = $5`,
                    values: [userId, expiredTicket.queue_ticket_id, currentTime, airScheduleId, expiredSeatIdArray[i]]
                }
                await airPool.query(updateStatusQuery);
            }

            console.log('Ticket cancelled successfully');

            // Get user email
            const getUserEmailQuery = {
                text: `SELECT email
                        FROM user_info
                        WHERE user_id = $1`,
                values: [userId]
            }
            const getUserEmailResult = await accountPool.query(getUserEmailQuery);
            const userEmail = getUserEmailResult.rows[0].email;

            // Send ticket to user email
            const mailOptions = {
                from: 'triptix.sfz@gmail.com',
                to: userEmail,
                subject: `${ticketId} Ticket`,
                text: 'Your ticket is free! Go to dashboard to proceed to payment',
            };
            await transporter.sendMail(mailOptions);
            console.log('Ticket sent to user email');
        }


        return res.status(200).json({ message: 'Ticket cancelled successfully' });
    } catch (error) {
        console.log('error: ', error);
        return res.status(500).json(error);
    }
}

const getAirSeatFareStat = async (req, res) => {
    const { src, dest, date } = req.body;

    try {
        console.log("getAirSeatFareStat called from air-service");
        console.log(req.body);

        const dateParts = date.split('-');
        const isoDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`; // yyyy-mm-dd

        console.log('isoDate: ', isoDate);

        // Get air_schedule_id for the given date, src, and dest
        const scheduleQuery = {
            text: 'SELECT air_schedule_id, air_fare FROM air_schedule_info WHERE starting_point = $1 AND ending_point = $2 AND schedule_date = $3',
            values: [src, dest, isoDate]
        };
        
        const scheduleResult = await airPool.query(scheduleQuery);
        console.log('scheduleResult: ', scheduleResult.rows);

        if (scheduleResult.rows.length === 0) {
            return res.status(200).json({
                totalSeats: 0,
                bookedSeats: 0,
                avgFare: 0
            });
        }

        let totalSeats = 0;
        let bookedSeats = 0;
        let avgFare = 0;

        for (let i = 0; i < scheduleResult.rows.length; i++) {
            const schedule = scheduleResult.rows[i];
            const airScheduleId = schedule.air_schedule_id;
            const airFare = schedule.air_fare;

            // Get total seats for the air
            const seatsQuery = {
                text: 'SELECT COUNT(air_seat_id) as booked_seats FROM air_schedule_seat_info WHERE air_schedule_id = $1',
                values: [airScheduleId]
            };

            const seatsResult = await airPool.query(seatsQuery);
            totalSeats += parseInt(seatsResult.rows[0].booked_seats, 10);

            // Get total booked seats for the air
            const bookedSeatsQuery = {
                text: 'SELECT COUNT(air_seat_id) as booked_seats FROM air_schedule_seat_info WHERE air_schedule_id = $1 AND booked_status = 2',
                values: [airScheduleId]
            };
            const bookedSeatsResult = await airPool.query(bookedSeatsQuery);
            bookedSeats += parseInt(bookedSeatsResult.rows[0].booked_seats, 10);

            let totalFare = 0;

            console.log('airFare: ', airFare);

            for (let j = 0; j < airFare.length; j++) {
                totalFare += airFare[j];
            }

            avgFare +=  totalFare / airFare.length;
            
        }

        avgFare = avgFare / scheduleResult.rows.length;        
        
        res.status(200).json({
            totalSeats: totalSeats,
            bookedSeats: bookedSeats,
            avgFare: avgFare
        });

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
    getAirSeatFareStat,
    cancel
};
