const express = require('express');
const app = express();
require('dotenv').config();
const { Pool } = require('pg');
const pgPool = new Pool();
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const Busboy = require('busboy');
const fs = require('fs');
const path = require('path');
const https = require('https');
const jwt = require('jsonwebtoken');
const url = require('url')


const options = {
    hostname: "demo.local",
    key: fs.readFileSync(path.join(__dirname + "/ssl/demo.local.key")),
    cert: fs.readFileSync(path.join(__dirname + "/ssl/demo.local.crt"))
};

const server = https.createServer(options, app);
const io = require('socket.io')(server, { cookie: false });


const PORT = process.env.PORT || 3000;

pgPool.on('error', err => {
    console.error('Unexpected error on idle client', err)
    process.exit(-1)
})


app.use(bodyParser.json());
app.use('/static', express.static(path.join(__dirname, 'public'), { fallthrough: true, extensions: ['jpeg', 'jpg', 'png'] }), (req, res) => {
    const match = /\/(ads|profiles)\/\w{8}-\w{4}-\w{4}-\w{4}-\w{12}/.exec(req.url);
    if (match) return res.redirect(`/static/${match[1]}/placeholder.png`);
    //redirect to error handler
});
app.use(cors({ origin: 'http://127.0.0.1:5500', credentials: true }))


app.use(session({
    store: new pgSession({
        pool: pgPool,
        tableName: 'session'
    }),
    secret: process.env.COOKIE_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 10 * 24 * 3600, sameSite: 'none', secure: true }
}));



class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'Validation Error'
    }
}


io.on('connection', async socket => {
    try {
        const { token, id } = socket.handshake.query;
        if (!(token && id)) throw new Error('token and/or id missing');
        const data = jwt.verify(token, process.env.TOKEN_SECRET)
        const query = 'SELECT COUNT(*) FROM users WHERE id=$1 AND email=$2';
        const { rows } = await pgPool.query(query, [id, data])
        if (rows[0].count == 1) {
            const query = 'INSERT INTO active (user_id,socket_id) VALUES ($1,$2)';
            await pgPool.query(query,[id,socket.id]);
            socket.on('chat message', (msg,receiver) => {
                console.log(msg);
                console.log(receiver);
            })
            socket.on('disconnect', async () => {
                const query = 'DELETE FROM active WHERE socket_id=$1';
                await pgPool.query(query,[socket.id]);
            });
        }
    } catch (err) {
        console.log(err);
    }
});

app.post("/search", async (req, res) => {
    try {
        if (!req.session.searches) {
            req.session.searches = [];
        }
        const { searchQuery, offset } = req.body;
        const searchesArr = req.session.searches;
        if (!searchesArr.includes(searchQuery) && searchQuery) {
            searchesArr.unshift('%' + searchQuery + '%');
            if (searchesArr.length > 3) searchesArr.pop()
        }
        const query = 'SELECT ad_id,title FROM ads WHERE country=$1 AND title LIKE $2 ORDER BY issuedAt DESC LIMIT 10 OFFSET $3';
        const { rows } = await pgPool.query(query, [req.session.country, searchesArr[0], Number(offset)]);
        res.json({ search: rows });
    } catch (err) {
        console.log(err);
        res.status(500).end();
    }
})


app.post("/ad/new", async (req, res) => {
    try {
        const { title, details, country } = req.body;
        const price = Number(req.body.price);
        const user_id = 'd4eb895d-d3dc-4eb9-a85e-60c573ded6c3';
        if (price && title && details && country && user_id) {
            const query = "INSERT INTO ads (price,title,details,country,user_id) VALUES ($1,$2,$3,$4,$5) RETURNING ad_id";
            const { rows } = await pgPool.query(query, [price, title, details, country, user_id]);
            res.json({ ad_id: rows[0].ad_id });
        } else {
            throw new ValidationError('Incomplete form');
        }
    } catch (err) {
        if (err.name === 'Validation Error')
            return res.json({ err: err.message })
        console.log(err);
        res.status(500).end();
    }
})

app.get("/users/logout", (req, res) => {
    req.session.user_id = null;
    res.json({ status: true }).end();
})


app.get("/users/login", async (req, res) => {
    try {
        const id = req.session.user_id || req.query.id;
        req.session.user_id = id;
        if (id === null || id === undefined) return res.json({ id: null })
        let email = req.query.email;
        if (!email) {
            const query = 'SELECT email FROM users WHERE id=$1';
            const { rows } = await pgPool.query(query, [id])
            if (!rows.length) throw new Error()
            email = rows[0].email;
        }
        const token = jwt.sign(email, process.env.TOKEN_SECRET)
        res.json({ id, token });
    } catch (err) {
        console.log(err);
        res.status(500).end();
    }
})

app.post("/users/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!(email && password)) throw new ValidationError("Email or Password missing");
        const query = "SELECT pass,id FROM users WHERE email=$1";
        const { rows } = await pgPool.query(query, [email]);
        if (!rows.length) throw new ValidationError('Email not registered.');
        const result = await bcrypt.compare(password, rows[0].pass);
        if (!result) throw new ValidationError("Incorrect Password");
        res.redirect(url.format({
            pathname: "/users/login",
            query: {
                "email": email,
                "id": rows[0].id
            }
        }));
    } catch (err) {
        if (err.name === 'Validation Error') return res.json({ err: err.message });
        console.log(err);
        res.status(500).end();
    }
})


app.post("/users/signup", async (req, res) => {
    try {
        const { fullName, email, password } = req.body;
        if (!(fullName && email && password)) throw new ValidationError("incomplete form");
        const { rows } = await pgPool.query('SELECT id FROM users WHERE email=$1', [email]);
        if (rows.length) throw new ValidationError('email already registered');
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);
        const query = "INSERT INTO users (fullname ,email ,pass ) VALUES ($1,$2,$3) RETURNING id";
        const { rows: result } = await pgPool.query(query, [fullName, email, hash]);
        res.redirect(url.format({
            pathname: "/users/login",
            query: {
                "email": email,
                "id": result[0].id
            }
        }));
    } catch (err) {
        if (err.name === 'Validation Error') return res.json({ err: err.message });
        console.log(err);
        res.status(500).end();
    }
})

app.post("/upload/picture", (req, res) => {
    const imgTypes = { "image/jpeg": ".jpg", "image/png": ".png" };
    let fileComplies = true;
    let location = 'profiles/' + req.session.user_id;
    const busboy = new Busboy({ headers: req.headers, limits: { fileSize: 500 * 1024 } });
    busboy.on('field', (fieldname, val) => {
        location = 'ads/' + val;
    });
    busboy.on('file', function (fieldname, file, filename, encoding, mimetype) {
        if (imgTypes.hasOwnProperty(mimetype)) {
            const saveTo = path.join(__dirname, 'public/' + location + imgTypes[mimetype]);
            file.pipe(fs.createWriteStream(saveTo));
        } else {
            file.resume();
            fileComplies = false;
        }
    });
    busboy.on('finish', function () {
        if (fileComplies) {
            res.status(200).end();
        } else {
            res.json({ err: 'You can upload only jpeg/png images' });
        }
    });
    return req.pipe(busboy);
})

app.post("/ad", async (req, res) => {
    try {
        const { ad_id } = req.body;
        const query = "SELECT details,issuedAt,fullname,user_id,price FROM ads JOIN users ON ads.user_id=users.id WHERE ad_id=$1";
        const { rows } = await pgPool.query(query, [ad_id]);
        res.json({ ...rows[0] });
    } catch (err) {
        console.log(err);
        res.status(500).end();
    }
})

app.post("/", async (req, res) => {
    const response = {};
    try {
        const { country, types, offset } = req.body;
        if (country) req.session.country = country;
        const values = [req.session.country, Number(offset)];
        if (types.includes("suggestions")) {
            const query = "SELECT ad_id,title FROM ads WHERE country=$1 ORDER BY issuedAt DESC LIMIT 10 OFFSET $2";
            const { rows } = await pgPool.query(query, values);
            response["suggestions"] = rows;
        }
        if (req.session.searches && types.includes("recentSearches")) {
            let query = 'SELECT ad_id,title FROM ads WHERE country=$1 AND title LIKE $3';
            for (let i = 1; i < req.session.searches.length; i++) {
                query += ' OR title LIKE $' + String(i + 3);
            }
            query += ' LIMIT 10 OFFSET $2';
            values.push(...req.session.searches);
            const { rows } = await pgPool.query(query, values);
            response['recentSearches'] = rows;
        }
        res.json(response);
    } catch (err) {
        console.log(err);
        res.status(500).end();
    }
})



server.listen(PORT, () => {
    console.log("server starting on port : " + PORT)
});

process.on('SIGTERM', () => {
    server.close(() => {
        console.log('closing down gracefully');
        pgPool.end();
        process.exit(0);
    });
});