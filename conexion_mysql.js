const mysql = require('mysql');
const database = {
    host : 'localhost',
    user : 'tele26',
    password : '2026tele',
    database : 'telemedicina2026'
};

const conexion = mysql.createConnection(database);

conexion.connect(function (err) {
    if (err) {
        console.error('Error en la conexión de la base de datos:',err);
        process.exit();
    }
});

module.exports = conexion;