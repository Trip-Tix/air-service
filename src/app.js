const express = require('express');
const dotenv = require("dotenv")
const { Client } = require('pg');

dotenv.config()

const app = express();
const port = process.env.PORT;

// Connect to Postgres
const client = new Client({
    host: process.env.PGHOST,
    port: process.env.PGPORT,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    keepAlive: true,
    ssl: true,
    sslmode: process.env.PGSSLMODE,
    ssl: {
        rejectUnauthorized: false
    },
    connectionTimeoutMillis: 5000
});

// Connect to Postgres with a callback
client.connect((err) => {
    if (err) {
        console.log(err);
    } else {
        console.log('Connected to database');
    }
});



app.get('/', (req, res) => {
    res.send('Hello World testing!');
    }
);

// Get all from bus_details
app.get('/train_details', (req, res) => {
    client.query('SELECT * FROM train_details', (err, result) => {
        if (err) {
            console.log(err);
            res.status(500).send('Error retrieving listings from database');
        } else {
            res.status(200).send(result.rows);
        }
    });
});

app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`);
    }
);