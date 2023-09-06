const express = require('express');
const dotenv = require('dotenv');
const router = require('./routes/routes');
const cors = require('cors');
const startAdminCreationConsumer = require('./consumer/messageConsumer.js');


dotenv.config();

const app = express();
const port = process.env.PORT;

app.use(express.json());
app.use(cors());
app.use('/', router);

app.get('/', (req, res) => {
    res.send('Air service is up and running');
});

// startAdminCreationConsumer();

app.listen(port, () => {
    console.log(`Air service listening on port ${port}`);
});
