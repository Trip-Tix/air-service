const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const trainPool = require("../config/trainDB.js");
const accountPool = require("../config/accountDB.js");

dotenv.config();

const secretKey = process.env.SECRETKEY;

// Get all train from source, destination and date
const getScheduleWiseTrainDetails = async (req, res) => {
    console.log("getScheduleWiseTrainDetails called from train-service");
    console.log("req.body: ", req.body);
    const { source, destination, journeyDate } = req.body;

    // Parse journeyDate and returnDate
    const journeyDateParts = journeyDate.split("-");
    // const returnDateParts = returnDate.split('-');
    const isoJourneyDate = `${journeyDateParts[2]}-${journeyDateParts[1]}-${journeyDateParts[0]}`; // yyyy-mm-dd
    // const isoReturnDate = `${returnDateParts[2]}-${returnDateParts[1]}-${returnDateParts[0]}`; // yyyy-mm-dd

    try {
        const getTrainDetailsQuery = {
            text: `SELECT unique_train_id, train_id, train_schedule_id, destination_points, departure_time    
            FROM train_schedule_info 
            WHERE starting_point = $1 
            AND $2 = ANY(destination_points) 
            AND schedule_date = $3 
            AND schedule_status = 1`,
            values: [source, destination, isoJourneyDate],
        };

        const getTrainDetailsResult = await trainPool.query(getTrainDetailsQuery);
        const trainDetails = getTrainDetailsResult.rows;
        console.log("trainDetails: ", trainDetails);

        if (trainDetails.length === 0) {
            return res.status(200).json([]);
        }

        for (let i = 0; i < trainDetails.length; i++) {
            const trainId = trainDetails[i].train_id;
            const uniqueTrainId = trainDetails[i].unique_train_id;
            const trainScheduleId = trainDetails[i].train_schedule_id;
            const fare = trainDetails[i].train_fare;
            const destinationPoints = trainDetails[i].destination_points;

            // Change the departure time format to hh:mm AM/PM
            const departureTime = trainDetails[i].departure_time;
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
            trainDetails[i].departure_time = departureTimeFormatted;

            trainDetails[i].arrival_time = "";

            for (let j = 0; j < destinationPoints.length; j++) {
                if (destinationPoints[j] === destination) {
                    trainDetails[i].fare = fare[j];
                    break;
                }
            }

            const getTrainCompanyNameQuery = {
                text: `SELECT train_company_name FROM train_services WHERE train_id = $1`,
                values: [trainId],
            };
            const getTrainCompanyNameResult = await trainPool.query(
                getTrainCompanyNameQuery
            );
            const trainCompanyName = getTrainCompanyNameResult.rows[0].train_company_name;
            trainDetails[i].train_company_name = trainCompanyName;

            const getCoachInfoQuery = {
                text: `SELECT train_coach_details.coach_id, train_coach_details.brand_name_id, 
                coach_info.coach_name, train_coach_info.train_coach_id, brand_name_info.brand_name  
                FROM train_coach_details 
                INNER JOIN coach_info ON train_coach_details.coach_id = coach_info.coach_id 
                INNER JOIN brand_name_info ON train_coach_details.brand_name_id = brand_name_info.brand_name_id 
                INNER JOIN train_coach_info ON train_coach_details.coach_id = train_coach_info.coach_id 
                AND train_coach_details.train_id = train_coach_info.train_id 
                WHERE train_coach_details.train_id = $1 
                AND train_coach_details.unique_train_id = $2`,
                values: [trainId, uniqueTrainId],
            };
            const getCoachInfoResult = await trainPool.query(getCoachInfoQuery);
            const coachInfo = getCoachInfoResult.rows[0];
            const coachId = coachInfo.coach_id;
            const brandNameId = coachInfo.brand_name_id;
            const coachName = coachInfo.coach_name;
            const trainCoachId = coachInfo.train_coach_id;
            const brandName = coachInfo.brand_name;

            trainDetails[i].coach_id = coachId;
            trainDetails[i].brand_name = brandName;
            trainDetails[i].coach_name = coachName;

            const getAvailableSeatCountQuery = {
                text: `SELECT COUNT(*) 
                FROM train_schedule_seat_info
                WHERE train_schedule_id = $1
                AND booked_status = 0`,
                values: [trainScheduleId],
            };
            const getAvailableSeatCountResult = await trainPool.query(
                getAvailableSeatCountQuery
            );
            const availableSeatCount = getAvailableSeatCountResult.rows[0].count;
            trainDetails[i].available_seat_count = availableSeatCount;

            // Get train layout
            const getTrainLayoutQuery = {
                text: `SELECT train_layout_id, number_of_seats, row, col 
                FROM train_layout_info
                WHERE train_coach_id = $1 
                AND train_id = $2`,
                values: [trainCoachId, trainId],
            };
            const getTrainLayoutResult = await trainPool.query(getTrainLayoutQuery);
            const trainLayout = getTrainLayoutResult.rows[0];
            const trainLayoutId = trainLayout.train_layout_id;
            const numberOfSeats = trainLayout.number_of_seats;
            const row = trainLayout.row;
            const col = trainLayout.col;
            trainDetails[i].train_layout_id = trainLayoutId;
            trainDetails[i].number_of_seats = numberOfSeats;

            const getSeatDetailsQuery = {
                text: `SELECT train_seat_id, seat_name, is_seat, row_id, col_id 
                FROM train_seat_details
                WHERE train_layout_id = $1`,
                values: [trainLayoutId],
            };
            const getSeatDetailsResult = await trainPool.query(getSeatDetailsQuery);
            const seatDetails = getSeatDetailsResult.rows;

            let layout = [];
            for (let j = 0; j < row; j++) {
                layout.push(new Array(col).fill(0));
            }

            let seatName = [];
            for (let j = 0; j < row; j++) {
                seatName.push(new Array(col).fill(""));
            }

            for (let j = 0; j < seatDetails.length; j++) {
                let seat = seatDetails[j];
                console.log("seat: ", seat);
                if (seat.is_seat) {
                    layout[seat.row_id][seat.col_id] = 1;
                    seatName[seat.row_id][seat.col_id] = seat.seat_name;
                }
            }

            trainDetails[i].layout = layout;
            trainDetails[i].seat_name = seatName;

            // Remove unnecessary fields
            delete trainDetails[i].train_fare;
            delete trainDetails[i].destination_points;
        }

        console.log("trainDetails: ", trainDetails);

        return res.status(200).json(trainDetails);
    } catch (error) {
        console.log("error: ", error);
        return res.status(500).json(error);
    }
};

// Get unique train details
const getUniqueTrainDetails = async (req, res) => {
    console.log("getUniqueTrainDetails called from train-service");

    // Get the token
    const { token, uniqueTrainId, trainId, trainScheduleId } = req.body;
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

        // Get the train coach id
        const getTrainCoachIdQuery = {
            text: `SELECT train_coach_info.train_coach_id, train_coach_details.coach_id, train_coach_details.brand_name_id 
            FROM train_coach_info
            INNER JOIN train_coach_details ON train_coach_info.coach_id = train_coach_details.coach_id 
            AND train_coach_info.train_id = train_coach_details.train_id 
            AND train_coach_info.brand_name_id = train_coach_details.brand_name_id
            WHERE train_coach_details.unique_train_id = $1
            AND train_coach_details.train_id = $2`,
            values: [uniqueTrainId, trainId],
        };
        const getTrainCoachIdResult = await trainPool.query(getTrainCoachIdQuery);
        const trainCoachId = getTrainCoachIdResult.rows[0].train_coach_id;
        console.log("trainCoachId: ", trainCoachId);

        // Get the train layout id
        const getTrainLayoutIdQuery = {
            text: `SELECT train_layout_id, number_of_seats, row, col
            FROM train_layout_info
            WHERE train_coach_id = $1
            AND train_id = $2`,
            values: [trainCoachId, trainId],
        };
        const getTrainLayoutIdResult = await trainPool.query(getTrainLayoutIdQuery);
        const trainLayoutId = getTrainLayoutIdResult.rows[0].train_layout_id;
        const numberOfSeats = getTrainLayoutIdResult.rows[0].number_of_seats;
        const row = getTrainLayoutIdResult.rows[0].row;
        const col = getTrainLayoutIdResult.rows[0].col;
        let availableSeatCount = numberOfSeats;
        console.log("trainLayoutId: ", trainLayoutId);

        // Get the seat details
        const getSeatDetailsQuery = {
            text: `SELECT train_seat_id, seat_name, is_seat, row_id, col_id
            FROM train_seat_details
            WHERE train_layout_id = $1`,
            values: [trainLayoutId],
        };
        const getSeatDetailsResult = await trainPool.query(getSeatDetailsQuery);
        const seatDetails = getSeatDetailsResult.rows;

        // Get the schedule seat details
        const getScheduleSeatDetailsQuery = {
            text: `SELECT train_schedule_seat_id, train_seat_id, booked_status, passenger_id 
            FROM train_schedule_seat_info
            WHERE train_schedule_id = $1 
            AND train_layout_id = $2`,
            values: [trainScheduleId, trainLayoutId],
        };
        const getScheduleSeatDetailsResult = await trainPool.query(
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

        let trainSeatId = [];
        for (let i = 0; i < row; i++) {
            trainSeatId.push(new Array(col).fill(-1));
        }

        for (let i = 0; i < seatDetails.length; i++) {
            let seat = seatDetails[i];
            console.log("seat: ", seat);
            if (seat.is_seat) {
                layout[seat.row_id][seat.col_id] = 1;
                seatName[seat.row_id][seat.col_id] = seat.seat_name;
                trainSeatId[seat.row_id][seat.col_id] = seat.train_seat_id;
            }
        }

        for (let i = 0; i < scheduleSeatDetails.length; i++) {
            let seat = scheduleSeatDetails[i];
            if (seat.booked_status === 1) {
                // Temporary Booked
                availableSeatCount--;
                let seatId = seat.train_seat_id;
                for (let j = 0; j < seatDetails.length; j++) {
                    if (seatId === seatDetails[j].train_seat_id) {
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
                let seatId = seat.train_seat_id;
                for (let j = 0; j < seatDetails.length; j++) {
                    if (seatId === seatDetails[j].train_seat_id) {
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
            .json({ layout, seatName, trainSeatId, numberOfSeats, availableSeatCount });
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
            console.log("Temporary book seat called from train-service");
            // Begin transaction
            await trainPool.query("BEGIN");
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
                const { trainScheduleId, passengerInfo, source, destination } = ticket;
                const ticketId = Math.random().toString().substring(2, 17);

                // Get source and destination name from location_info table
                const getSourceNameQuery = {
                    text: `SELECT location_name FROM location_info WHERE location_id = $1`,
                    values: [source],
                };
                const getSourceNameResult = await trainPool.query(getSourceNameQuery);
                const sourceName = getSourceNameResult.rows[0].location_name;

                const getDestinationNameQuery = {
                    text: `SELECT location_name FROM location_info WHERE location_id = $1`,
                    values: [destination],
                };
                const getDestinationNameResult = await trainPool.query(
                    getDestinationNameQuery
                );
                const destinationName = getDestinationNameResult.rows[0].location_name;

                console.log("passengerInfo: ", passengerInfo);

                // Generate unique ticket ID of 15 characters length with numbers only

                // Get the train ticket fare 
                const getTrainTicketFareQuery = {
                    text: `SELECT train_fare FROM train_schedule_info WHERE train_schedule_id = $1`,
                    values: [trainScheduleId],
                };
                const getTrainTicketFareResult = await trainPool.query(
                    getTrainTicketFareQuery
                );
                const trainTicketFare = parseInt(getTrainTicketFareResult.rows[0].train_fare);

                let perValidTicketFare = 0;
                let perTempTicketFare = 0;
                let temporaryNumberOfTickets = 0;

                let passengerIdArray = [];

                let temporaryTrainSeatIdArray = [];
                let temporaryPassengerIdArray = [];


                for (let i = 0; i < passengerInfo.length; i++) {
                    const passenger = passengerInfo[i];
                    const {
                        trainSeatId,
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
                        perTempTicketFare += trainTicketFare;
                        temporaryTrainSeatIdArray.push(trainSeatId);
                        temporaryPassengerIdArray.push(passengerId);
                        temporaryNumberOfTickets++;
                    } else {
                        isValidTicketPresent = true;
                        // Temporary booking ticket
                        perValidTicketFare += trainTicketFare;
                        passengerIdArray.push(passengerId);
                        const tempBookSeatQuery = {
                            text: `UPDATE train_schedule_seat_info
                        SET booked_status = 1, passenger_id = $1, passenger_gender = $2, booking_time = $3, ticket_id = $4  
                        WHERE train_schedule_id = $5
                        AND train_seat_id = $6`,
                            values: [
                                passengerId,
                                passengerGender,
                                bookingTimestamp,
                                ticketId,
                                trainScheduleId,
                                trainSeatId,
                            ],
                        };
                        await trainPool.query(tempBookSeatQuery);
                        console.log("Seat temporarily booked successfully");
                    }
                }

                if (isValidTicketPresent) {
                    const numTickets = passengerIdArray.length;
                    const insertIntoTicketInfoQuery = {
                        text: `INSERT INTO ticket_info (ticket_id, user_id, train_schedule_id, 
                            number_of_tickets, total_fare, passenger_info, date, source, destination) 
                            VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                        values: [ticketId, userId, trainScheduleId, numTickets, perValidTicketFare, passengerIdArray, currentDate, sourceName, destinationName]
                    }
                    await trainPool.query(insertIntoTicketInfoQuery);
                    console.log("Temporary Ticket added successfully");
                    responseData.push({
                        ticketId,
                        passengerIdArray,
                        trainScheduleId,
                        totalFare: perValidTicketFare,
                        numberOfTickets: numTickets,
                    });
                }

                if (isInvalidTicketPresent) {
                    // Insert to ticket queue
                    const queueTicketId = Math.random().toString().substring(2, 17);
                    const insertIntoTicketQueueQuery = {
                        text: `INSERT INTO ticket_queue 
                        (queue_ticket_id, user_id, total_fare, train_schedule_id, number_of_tickets, passenger_info, train_seat_id, date, source, destination)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                        values: [
                            queueTicketId,
                            userId,
                            perTempTicketFare,
                            trainScheduleId,
                            temporaryNumberOfTickets,
                            temporaryPassengerIdArray,
                            temporaryTrainSeatIdArray,
                            currentDate,
                            sourceName,
                            destinationName,
                        ],
                    };
                    await trainPool.query(insertIntoTicketQueueQuery);
                    console.log("Ticket added to queue successfully");
                    tempResponseData.push({
                        ticketId: queueTicketId,
                        passengerIdArray: temporaryPassengerIdArray,
                        trainScheduleId,
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
            await trainPool.query("ROLLBACK");
            await accountPool.query("ROLLBACK");
            console.log("error here: ", error);
            res.status(500).json(error);
        } finally {
            // Commit transaction
            await trainPool.query("COMMIT");
            await accountPool.query("COMMIT");
        }
    });
};

// Get districts
const getLocation = async (req, res) => {
    try {
        console.log("getDistricts called from train-service");
        const query = {
            text: "SELECT location_id, location_name FROM location_info",
        };
        const result = await trainPool.query(query);
        const districts = result.rows;
        console.log(districts);
        res.status(200).json(districts);
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getScheduleWiseTrainDetails,
    getUniqueTrainDetails,
    tempBookSeat,
    getLocation,
};
