// Load Environment Variables from the .env file
require('dotenv').config();

// Application Dependencies
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const client = require('./lib/client');
// Initiate database connection
client.connect();

// Application Setup
const app = express();
const PORT = process.env.PORT;
app.use(morgan('dev')); // http logging
app.use(cors()); // enable CORS request
app.use(express.static('public')); // server files from /public folder
app.use(express.json()); // enable reading incoming json data
app.use(express.urlencoded({ extended: true }));

// API Routes
const createAuthRoutes = require('./lib/auth/create-auth-routes');
const authRoutes = createAuthRoutes({
    selectUser(email) {
        return client.query(`
            SELECT id, email, hash 
            FROM users
            WHERE email = $1;
        `,
        [email]
        ).then(result => result.rows[0]);
    },
    insertUser(user, hash) {
        return client.query(`
            INSERT into users (email, hash)
            VALUES ($1, $2)
            RETURNING id, email;
        `,
        [user.email, hash]
        ).then(result => result.rows[0]);
    }
});

// before ensure auth, but after other middleware:
app.use('/api/auth', authRoutes);

// for every route, on every request, make sure there is a token
const ensureAuth = require('./lib/auth/ensure-auth');

app.use('/api/me', ensureAuth);

//connect to swapi
const request = require('superagent');

// *** FAVVVVVV ***
app.get('/api/characters', async(req, res) => {
    try {
        const data = await request.get(`https://swapi.co/api/people/?search=${req.query.search}`);
        res.json(data.body);

    } catch (err) {
        console.log(err);
        res.status(500).json({
            error: err.message || err
        });
    }
});

app.get('/api/me/favorites', async(req, res) => {
    try {
        const result = await client.query(`
            SELECT * FROM favorites
            WHERE user_id = $1;
        `, [req.userId]);

        res.json(result.rows);

    } catch (err) {
        console.log(err);
        res.status(500).json({
            error: err.message || err
        });
    }
});

app.post('/api/me/favorites', async(req, res) => {
    try {
        const result = await client.query(`
            INSERT INTO favorites
            (name, birth_year, mass, height, eye_color, user_id)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *;
        `, [req.body.name, req.body.birth_year, req.body.mass, req.body.height, req.body.eye_color, req.userId]);

        res.json(result.rows[0]);
    }
    catch (err) {
        console.log(err);
        res.status(500).json({
            error: err.message || err
        });
    }
});

app.delete('/api/me/favorites/:id', async(req, res) => {
    const id = req.params.id;
    try {
        const result = await client.query(`
            DELETE FROM favorites
            WHERE id = $1
            AND user_id = $2;
        `, [id, req.userId]);

        res.json(result.rows[0]);
    }
    catch (err) {
        console.log(err);
        res.status(500).json({
            error: err.message || err
        });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log('server running on PORT', process.env.PORT);
});