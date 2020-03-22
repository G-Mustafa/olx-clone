const fs = require('fs');

function runSetup(pool) {
    fs.readFile('./dbSetup/postgresSetup.sql', 'utf8', (err, data) => {
        if (err) throw err;
        pool.query(data, (err, res) => {
            if (err) throw err
            console.log('Tables created');
        })
    })
}

module.exports = runSetup;