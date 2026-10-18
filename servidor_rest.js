// Pablo Sánchez Sos
var express = require("express");
var jwt = require('jwt-simple'); //?
var clave = 'miSecretoMasOscuro'; //? clave para codificar / decodificar el token
var app = express();
// Entonces la URL donde se servirá la páginas será http://localhost:3000/appCliente/index.html
app.use("/appCliente", express.static("cliente_rest")); // express.statitic(Nombre de la carpeta donde se encuentran los archivos del cliente)
app.use(express.json());

var conexion = require("./conexion_mysql.js");

// LOGIN
// Comprueba que el usuario y contraseña estén bien y devuelve el id del usuario en caso de ser correcto
// Se emplea post ya que hay datos sensibles (contraseña)
app.post("/api/gestores/login", function(req,res){
    // req.body ya que la información se pasa en el cuerpo, no en la URL porque sería inseguro
    console.log(req.body);
    // Se usa la conexión a la base de datos para realizar la consulta
    // SELECT devuelve un array de objetos, cada objeto es una fila de la tabla y cada propiedad del objeto es una columna de la tabla
    var sql = "SELECT id FROM gestores WHERE usuario = ? AND password = ?";
    
    conexion.query(sql, [req.body.usuario, req.body.password], function (err, id) {
        if (err) {
            console.log("Error al realizar la select", err);
            res.status(500).json("Error al realizar la consulta");
            return;
        } 
        if (id.length == 0) {
            // Si no encuentra el usuario con esa contraseña, devuelve un array vacío
            res.status(403).json("Credenciales inválidas"); // login incorrecto
            return;
        }
            // Te da un array de objetos que solo contiene el id del usuario, por eso se hace id[0].id
            var contenido = { //? contenido del token
                usuario: id[0].id, //?
                expira: Date.now() + 60 * 60 * 1000 //? expira dentro de 1 hora (en ms)
            }; //?
            var token = jwt.encode(contenido, clave); //? Se crea el token firmado con la clave
            res.json({id: id[0].id, token: token}); //? Mandamos el id y el token al cliente
            return;
    });
})

// REGISTRO
// Crea un nuevo usuario y le asigna un id
app.post("/api/gestores", function(req, res){
    console.log(req.body);

        // 2. El usuario no existe: se inserta
        // INSERT devuelve un objeto con la propiedad insertId que es el id del nuevo usuario
        var sql = "INSERT INTO gestores (nombre, apellidos, usuario, password) VALUES (?, ?, ?, ?)";
        var datos = [req.body.nombre, req.body.apellidos, req.body.usuario, req.body.password];
        conexion.query(sql, datos, function (err, resultado) {
            if (err) {
            if (err.code === "ER_DUP_ENTRY") {
                res.json("El usuario ya existe");
                return;
            }
            console.log("Error al insertar el gestor", err);
            res.status(500).json("Error al crear el usuario");
            return;
        }
        console.log("Gestor creado con id", resultado.insertId);
        res.status(201).json("Usuario creado correctamente");
        });
})

//? Antes de este use, los servicios son públicos (login y registro, no necesitan token)
//? Con esta función intermedia validamos el token. Si no es correcto terminamos con un error. Si es correcto continuamos.
app.use("/api", function (req, res, next) { //?
    var token = req.query.token; //? obtengo el token de la query de la URL: /api/ruta?token=XXXXXXXX
    if (!token) { //? no se ha pasado un token
        res.status(401).json("No se ha encontrado token"); //?
        return; //?
    } //?

    //? Decodificar el token
    try { //? capturamos el error por si el token no es correcto
        var contenidoToken = jwt.decode(token, clave); //? se decodifica con la misma clave con la que se codificó
    } catch (error) { //?
        res.status(401).json("El token es incorrecto"); //?
        return; //?
    } //?

    //? Validar el formato del token
    if (!contenidoToken || !contenidoToken.expira || !contenidoToken.usuario) { //?
        res.status(401).json("El formato del token no es adecuado"); //?
        return; //?
    } //?

    //? Comprobar la fecha de expiración
    if (contenidoToken.expira < Date.now()) { //?
        res.status(401).json("El token ha expirado"); //?
        return; //?
    } //?

    next(); //? Todo ha ido bien: express continúa con el procesado
}); //?
//? Después de este use, los servicios son privados (necesitan el token)

// REGISTRO
// Modifica los datos de un gestor
app.put("/api/gestores/:id", function(req, res){
    console.log(req.body);
    var idGestor = req.params.id;

    // Base sin el password de momento
    var sql = "UPDATE gestores SET nombre = ?, apellidos = ?, usuario = ?";
    var datos = [req.body.nombre, req.body.apellidos, req.body.usuario];

    // Si la contraseña NO está vacía, la añadimos a la consulta y a los datos
    if (req.body.password && req.body.password !== "") {
        sql += ", password = ?";
        datos.push(req.body.password);
    }

    // Condición WHERE al final (su valor va el último en datos)
    sql += " WHERE id = ?";
    datos.push(idGestor);

    conexion.query(sql, datos, function (err, result) {
        if (err) {
            // Usuario que ya existe
            if (err.code === "ER_DUP_ENTRY"){
                return res.status(409).json("Error: El usuario ya existe");
            }
            console.log("Error al actualizar:", err);
            return res.status(500).json("Error interno del servidor");
        }

        // result.affectedRows --> cuántas filas coincidieron con el WHERE
        if (result.affectedRows == 0) {
            return res.status(404).json("Error, el gestor con id " + idGestor + " no existe");
        }

        // result.changedRows --> cuántas filas cambiaron
        if (result.changedRows == 0) {
            return res.status(400).json("Error. Debes editar algún campo");
        }

        res.status(200).json("Datos modificados correctamente");
    });
});


// Obtener datos del gestor tras actualizar
app.get("/api/gestores/:id", function(req,res){
    var idGestor = req.params.id;
    var sql = "SELECT nombre, apellidos, usuario FROM gestores WHERE id = ?";
    conexion.query(sql, [idGestor], function (err, filas) {
        if (err) {
            console.log("Error al realizar la select", err);
            res.status(500).json("Error al realizar la consulta");
            return;
        }
        if (filas.length == 0) {
            res.status(404).json("Error, el gestor con id " + idGestor + " no existe");
            return;
        }
        var gestor = filas[0];
        res.status(200).json({nombre: gestor.nombre, apellidos: gestor.apellidos, usuario: gestor.usuario});
        return;
    });
})


// Lista de categorías
app.get("/api/categorias", function(req,res){
    var sql ="SELECT * FROM categorias";
    conexion.query(sql, function (err, categorias) {
        if (err) {
            console.log("Error al realizar la select", err);
            res.status(500).json("Error al realizar la consulta");
            return;
        }
        // Mando el array de objetos que contiene todas las categorías, cada objeto es una categoría con sus propiedades
        res.json(categorias);
    });
})

// Lista de modelos
app.get("/api/modelos", function(req,res){
    var sql ="SELECT * FROM modelos";
    conexion.query(sql, function (err, modelos) {
        if (err) {
            console.log("Error al realizar la select", err);
            res.status(500).json("Error al realizar la consulta");
            return;
        }
        res.json(modelos);
    });
})

// Lista de ubicaciones
app.get("/api/ubicaciones", function(req,res){
    var sql ="SELECT * FROM ubicaciones";
    conexion.query(sql, function (err, ubicaciones) {
        if (err) {
            console.log("Error al realizar la select", err);
            res.status(500).json("Error al realizar la consulta");
            return;
        }
        res.json(ubicaciones);
    });
})

// PRINCIPAL
// Filtra los recursos según los parámetros
app.get("/api/recursos", function(req, res){
    var categoria = req.query.categoria;
    var modelo = req.query.modelo;
    var ubicacion = req.query.ubicacion;
    var estado = req.query.estado;

    // Unimos recursos con modelos para poder filtrar por categoría
    var sql = "SELECT r.* FROM recursos r JOIN modelos m ON r.modelo = m.id WHERE 1=1";
    var params = [];

    if (categoria && categoria != -1) {
        sql += " AND m.categoria = ?";
        params.push(categoria);
    }
    if (modelo && modelo != -1) {
        sql += " AND r.modelo = ?";
        params.push(modelo);
    }
    if (ubicacion && ubicacion != -1) {
        sql += " AND r.ubicacion = ?";
        params.push(ubicacion);
    }
    if (estado !== undefined && estado !== "" && estado != -1) {
        sql += " AND r.estado = ?";
        params.push(estado);
    }

    conexion.query(sql, params, function (err, recursos) {
        if (err) {
            console.log("Error al filtrar recursos", err);
            res.status(500).json("Error al realizar la consulta");
            return;
        }
        res.json(recursos);
    });
})

//  PRINCIPAL
app.delete("/api/recursos/:id", function(req, res){
    var idRecurso = req.params.id;
    var sql = "DELETE FROM recursos WHERE id = ?";
    conexion.query(sql, [idRecurso], function (err, resultado) {
        if (err) {
            console.log("Error al eliminar el recurso", err);
            res.status(500).json("Error al eliminar el recurso");
            return;
        }
        if (resultado.affectedRows == 0) {
            res.status(404).json("Error, el recurso con id " + idRecurso + " no existe");
            return;
        }
        res.json("Recurso eliminado correctamente");
    });
})

// Abrir recurso para modificarlo
app.get("/api/recursos/:id", function(req, res){
    var idRecurso = req.params.id;
    var sql = "SELECT * FROM recursos WHERE id = ?";
    conexion.query(sql, [idRecurso], function (err, filas) {
        if (err) {
            console.log("Error al obtener el recurso", err);
            res.status(500).json("Error al obtener el recurso");
            return;
        }
        if (filas.length == 0) {
            res.status(404).json("Error, el recurso con id " + idRecurso + " no existe");
            return;
        }
        res.json(filas[0]); // Devuelve el recurso encontrado
    });
});

// RECURSOS
// Crea nuevo recurso
app.post("/api/recursos", function(req, res){
    var sql = "INSERT INTO recursos (modelo, ubicacion, numero_serie, estado) VALUES (?, ?, ?, ?)";
    var datos = [req.body.modelo, req.body.ubicacion, req.body.numero_serie, req.body.estado];

    conexion.query(sql, datos, function(err, result) {
        if (err) {
            if (err.code === "ER_DUP_ENTRY") {
                return res.status(409).json("Error: Ya existe un recurso con ese número de serie");
            }
            if (err.code === "ER_NO_REFERENCED_ROW_2") {
                return res.status(400).json("Error: El modelo o la ubicación seleccionada no existen");
            }
            console.log("Error al crear el recurso:", err);
            return res.status(500).json("Error interno del servidor");
        }
        res.status(201).json("Recurso creado correctamente");
    });
});

// RECURSOS
// Modifica recurso existente
app.put("/api/recursos/:id", function(req, res){
    var idRecurso = req.params.id;
    var sql = "UPDATE recursos SET modelo = ?, ubicacion = ?, numero_serie = ?, estado = ? WHERE id = ?";
    var datos = [req.body.modelo, req.body.ubicacion, req.body.numero_serie, req.body.estado, idRecurso];

    conexion.query(sql, datos, function(err, result) {
        if (err) {
            if (err.code === "ER_DUP_ENTRY") {
                return res.status(409).json("Error: Ya existe otro recurso con ese número de serie");
            }
            if (err.code === "ER_NO_REFERENCED_ROW_2") {
                return res.status(400).json("Error: El modelo o la ubicación seleccionada no existen");
            }
            console.log("Error al actualizar el recurso:", err);
            return res.status(500).json("Error interno del servidor");
        }

        if (result.affectedRows === 0) {
            return res.status(404).json("Error, el recurso con id " + idRecurso + " no existe");
        }
        if (result.changedRows === 0) {
            return res.status(400).json("Error, no has modificado ningún campo");
        }
        res.status(200).json("Recurso modificado correctamente");
    });
});

// Reservas de un recurso
app.get("/api/recursos/:id/reservas", function(req, res){
    var idRecurso = req.params.id;

    var sql = "SELECT id FROM recursos WHERE id = ?";
    conexion.query(sql, [idRecurso], function (err, id) {
        if (err) {
            console.log("Error al comprobar el recurso", err);
            res.status(500).json("Error al realizar la consulta");
            return;
        }
        if (id.length == 0) {
            res.status(404).json("Error, recurso con id " + idRecurso + " no existe");
            return;
        }

        var sql = "SELECT * FROM reservas WHERE recurso = ?";
        conexion.query(sql, [idRecurso], function (err, reservasRecurso) {
            if (err) {
                console.log("Error al obtener las reservas", err);
                res.status(500).json("Error al realizar la consulta");
                return;
            }
            res.json(reservasRecurso);
        });
    });
});

// Reseñas de un recurso
app.get("/api/recursos/:id/resenyas", function(req, res){
    var idRecurso = req.params.id;

    var sql = "SELECT id FROM recursos WHERE id = ?";
    conexion.query(sql, [idRecurso], function (err, id) {
        if (err) {
            console.log("Error al comprobar el recurso", err);
            res.status(500).json("Error al realizar la consulta");
            return;
        }
        if (id.length == 0) {
            res.status(404).json("Error, recurso con id " + idRecurso + " no existe");
            return;
        }

        var sql = "SELECT * FROM resenyas WHERE recurso = ?";
        conexion.query(sql, [idRecurso], function (err, resenyasRecurso) {
            if (err) {
                console.log("Error al obtener las resenyas", err);
                res.status(500).json("Error al realizar la consulta");
                return;
            }
            res.json(resenyasRecurso);
        });
    });
});

// Sanitario por id (sin password)
app.get("/api/sanitarios/:id", function(req, res){
    var idSanitario = req.params.id;

    var sql = "SELECT nombre, apellidos FROM sanitarios WHERE id = ?"
    conexion.query(sql, [idSanitario], function (err, filas){
        if (err) {
            console.log("Error al comprobar el recurso", err);
            res.status(500).json("Error al realizar la consulta");
            return;
        }
        if (filas.length == 0) {
            res.status(404).json("Error, sanitario con id " + idSanitario + " no existe");
            return;
        }
        res.json(filas[0])
    })
});

// Iniciar servidor --> siempre último paso
app.listen(3000, function(){
    console.log("Servidor en marcha, escuchando en el puerto 3000");
})