// Pablo Sánchez Sos
var express = require("express");
var jwt = require('jwt-simple'); //?
var clave = 'miSecretoMasOscuro'; //? clave para codificar / decodificar el token
var app = express();
// Entonces la URL donde se servirá la páginas será http://localhost:3000/appCliente/index.html
// URL en internet https://pract3tt.onrender.com/AppCliente
// Prueba
app.use("/appCliente", express.static("cliente_rest")); // express.statitic(Nombre de la carpeta donde se encuentran los archivos del cliente)
app.use(express.json());

// 1. Importar el cliente de Supabase
const { createClient } = require('@supabase/supabase-js');

// 2. Configurar con tu URL y tu Public Key (anon key)
const supabaseUrl = 'https://ordhwdensqniqbcwxfxq.supabase.co';
const supabaseKey = 'sb_publishable_G1s4ATQuhNI4Leoy3bHrsA_f1daC7jO'; // la que sale en Project Settings > API
const supabase = createClient(supabaseUrl, supabaseKey);

// LOGIN
// Comprueba que el usuario y contraseña estén bien y devuelve el id del usuario en caso de ser correcto
// Se emplea post ya que hay datos sensibles (contraseña)
app.post("/api/gestores/login", function(req,res){
    // req.body ya que la información se pasa en el cuerpo, no en la URL porque sería inseguro
    console.log(req.body);
    // Con Supabase no se escribe el SQL: from() indica la tabla, select() las columnas y eq() equivale a WHERE columna = valor
    // El resultado es un objeto {data, error}: data es un array de objetos (las filas) y error el fallo, si lo hay
    supabase.from("gestores").select("id").eq("usuario", req.body.usuario).eq("password", req.body.password).then(function(resultado){
        if (resultado.error) {
            console.log("Error al realizar la select", resultado.error);
            res.status(500).json("Error al realizar la consulta");
            return;
        }
        if (resultado.data.length == 0) {
            // Si no encuentra el usuario con esa contraseña, devuelve un array vacío
            res.status(403).json("Credenciales inválidas"); // login incorrecto
            return;
        }
        // Te da un array de objetos que solo contiene el id del usuario, por eso se hace data[0].id
        var contenido = { //? contenido del token
            usuario: resultado.data[0].id, //?
            expira: Date.now() + 60 * 60 * 1000 //? expira dentro de 1 hora (en ms)
        }; //?
        var token = jwt.encode(contenido, clave); //? Se crea el token firmado con la clave
        res.json({id: resultado.data[0].id, token: token}); //? Mandamos el id y el token al cliente
        return;
    });
})

// REGISTRO
// Crea un nuevo usuario y le asigna un id
app.post("/api/gestores", function(req, res){
    console.log(req.body);

    // insert() añade la fila. Con select("id") pedimos que nos devuelva el id que ha generado la base de datos
    var gestor = {nombre: req.body.nombre, apellidos: req.body.apellidos, usuario: req.body.usuario, password: req.body.password};
    supabase.from("gestores").insert(gestor).select("id").then(function(resultado){
        if (resultado.error) {
            // 23505 es el código de Postgres para un valor duplicado (equivale a ER_DUP_ENTRY de MySQL)
            if (resultado.error.code === "23505") {
                res.json("El usuario ya existe");
                return;
            }
            console.log("Error al insertar el gestor", resultado.error);
            res.status(500).json("Error al crear el usuario");
            return;
        }
        console.log("Gestor creado con id", resultado.data[0].id);
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

    // Postgres no tiene affectedRows/changedRows, así que primero se lee el gestor actual
    supabase.from("gestores").select("*").eq("id", idGestor).then(function(resultado){
        if (resultado.error) {
            console.log("Error al realizar la select", resultado.error);
            return res.status(500).json("Error interno del servidor");
        }
        // Si no hay ninguna fila, el gestor no existe
        if (resultado.data.length == 0) {
            return res.status(404).json("Error, el gestor con id " + idGestor + " no existe");
        }
        var actual = resultado.data[0];

        // Base sin el password de momento
        var cambios = {nombre: req.body.nombre, apellidos: req.body.apellidos, usuario: req.body.usuario};

        // Si la contraseña NO está vacía, la añadimos a los cambios
        if (req.body.password && req.body.password !== "") {
            cambios.password = req.body.password;
        }

        // Equivale a changedRows: se comprueba si algún campo es distinto del que ya había
        var hayCambios = false;
        for (var campo in cambios) {
            if (cambios[campo] != actual[campo]) {
                hayCambios = true;
            }
        }
        if (!hayCambios) {
            return res.status(400).json("Error. Debes editar algún campo");
        }

        supabase.from("gestores").update(cambios).eq("id", idGestor).then(function(resultadoUpdate){
            if (resultadoUpdate.error) {
                // Usuario que ya existe
                if (resultadoUpdate.error.code === "23505"){
                    return res.status(409).json("Error: El usuario ya existe");
                }
                console.log("Error al actualizar:", resultadoUpdate.error);
                return res.status(500).json("Error interno del servidor");
            }
            res.status(200).json("Datos modificados correctamente");
        });
    });
});


// Obtener datos del gestor tras actualizar
app.get("/api/gestores/:id", function(req,res){
    var idGestor = req.params.id;
    supabase.from("gestores").select("nombre, apellidos, usuario").eq("id", idGestor).then(function(resultado){
        if (resultado.error) {
            console.log("Error al realizar la select", resultado.error);
            res.status(500).json("Error al realizar la consulta");
            return;
        }
        if (resultado.data.length == 0) {
            res.status(404).json("Error, el gestor con id " + idGestor + " no existe");
            return;
        }
        var gestor = resultado.data[0];
        res.status(200).json({nombre: gestor.nombre, apellidos: gestor.apellidos, usuario: gestor.usuario});
        return;
    });
})


// Lista de categorías
// order("id") mantiene el orden por id, ya que sin él Postgres no garantiza ningún orden
app.get("/api/categorias", function(req,res){
    supabase.from("categorias").select("*").order("id").then(function(resultado){
        if (resultado.error) {
            console.log("Error al realizar la select", resultado.error);
            res.status(500).json("Error al realizar la consulta");
            return;
        }
        // Mando el array de objetos que contiene todas las categorías, cada objeto es una categoría con sus propiedades
        res.json(resultado.data);
    });
})

// Lista de modelos
app.get("/api/modelos", function(req,res){
    supabase.from("modelos").select("*").order("id").then(function(resultado){
        if (resultado.error) {
            console.log("Error al realizar la select", resultado.error);
            res.status(500).json("Error al realizar la consulta");
            return;
        }
        res.json(resultado.data);
    });
})

// Lista de ubicaciones
app.get("/api/ubicaciones", function(req,res){
    supabase.from("ubicaciones").select("*").order("id").then(function(resultado){
        if (resultado.error) {
            console.log("Error al realizar la select", resultado.error);
            res.status(500).json("Error al realizar la consulta");
            return;
        }
        res.json(resultado.data);
    });
})

// PRINCIPAL
// Filtra los recursos según los parámetros
app.get("/api/recursos", function(req, res){
    var categoria = req.query.categoria;
    var modelo = req.query.modelo;
    var ubicacion = req.query.ubicacion;
    var estado = req.query.estado;

    var consulta;
    if (categoria && categoria != -1) {
        // Equivale al JOIN con modelos: "modelos!inner(categoria)" une cada recurso con su modelo
        // y solo deja los recursos cuyo modelo cumple el filtro de categoría
        consulta = supabase.from("recursos").select("*, modelos!inner(categoria)").eq("modelos.categoria", categoria);
    } else {
        consulta = supabase.from("recursos").select("*");
    }

    // Cada filtro se añade a la consulta solo si el usuario lo ha elegido (-1 = Todos)
    if (modelo && modelo != -1) {
        consulta = consulta.eq("modelo", modelo);
    }
    if (ubicacion && ubicacion != -1) {
        consulta = consulta.eq("ubicacion", ubicacion);
    }
    if (estado !== undefined && estado !== "" && estado != -1) {
        consulta = consulta.eq("estado", estado);
    }

    consulta.order("id").then(function(resultado){
        if (resultado.error) {
            console.log("Error al filtrar recursos", resultado.error);
            res.status(500).json("Error al realizar la consulta");
            return;
        }
        var recursos = resultado.data;
        // El JOIN añade una propiedad "modelos" a cada recurso que el cliente no necesita: se elimina
        for (var i = 0; i < recursos.length; i++) {
            delete recursos[i].modelos;
        }
        res.json(recursos);
    });
})

//  PRINCIPAL
app.delete("/api/recursos/:id", function(req, res){
    var idRecurso = req.params.id;
    // select() al final hace que devuelva las filas borradas, así sabemos si existía (equivale a affectedRows)
    supabase.from("recursos").delete().eq("id", idRecurso).select().then(function(resultado){
        if (resultado.error) {
            console.log("Error al eliminar el recurso", resultado.error);
            res.status(500).json("Error al eliminar el recurso");
            return;
        }
        if (resultado.data.length == 0) {
            res.status(404).json("Error, el recurso con id " + idRecurso + " no existe");
            return;
        }
        res.json("Recurso eliminado correctamente");
    });
})

// Abrir recurso para modificarlo
app.get("/api/recursos/:id", function(req, res){
    var idRecurso = req.params.id;
    supabase.from("recursos").select("*").eq("id", idRecurso).then(function(resultado){
        if (resultado.error) {
            console.log("Error al obtener el recurso", resultado.error);
            res.status(500).json("Error al obtener el recurso");
            return;
        }
        if (resultado.data.length == 0) {
            res.status(404).json("Error, el recurso con id " + idRecurso + " no existe");
            return;
        }
        res.json(resultado.data[0]); // Devuelve el recurso encontrado
    });
});

// RECURSOS
// Crea nuevo recurso
app.post("/api/recursos", function(req, res){
    var recurso = {modelo: req.body.modelo, ubicacion: req.body.ubicacion, numero_serie: req.body.numero_serie, estado: req.body.estado};

    supabase.from("recursos").insert(recurso).then(function(resultado) {
        if (resultado.error) {
            if (resultado.error.code === "23505") {
                return res.status(409).json("Error: Ya existe un recurso con ese número de serie");
            }
            // 23503 es el código de Postgres para una clave foránea que no existe (equivale a ER_NO_REFERENCED_ROW_2)
            if (resultado.error.code === "23503") {
                return res.status(400).json("Error: El modelo o la ubicación seleccionada no existen");
            }
            console.log("Error al crear el recurso:", resultado.error);
            return res.status(500).json("Error interno del servidor");
        }
        res.status(201).json("Recurso creado correctamente");
    });
});

// RECURSOS
// Modifica recurso existente
app.put("/api/recursos/:id", function(req, res){
    var idRecurso = req.params.id;
    var cambios = {modelo: req.body.modelo, ubicacion: req.body.ubicacion, numero_serie: req.body.numero_serie, estado: req.body.estado};

    // Como en la modificación de gestores, primero se lee el recurso actual (existencia y cambios)
    supabase.from("recursos").select("*").eq("id", idRecurso).then(function(resultado) {
        if (resultado.error) {
            console.log("Error al actualizar el recurso:", resultado.error);
            return res.status(500).json("Error interno del servidor");
        }
        if (resultado.data.length == 0) {
            return res.status(404).json("Error, el recurso con id " + idRecurso + " no existe");
        }
        var actual = resultado.data[0];

        // Equivale a changedRows
        var hayCambios = false;
        for (var campo in cambios) {
            if (cambios[campo] != actual[campo]) {
                hayCambios = true;
            }
        }
        if (!hayCambios) {
            return res.status(400).json("Error, no has modificado ningún campo");
        }

        supabase.from("recursos").update(cambios).eq("id", idRecurso).then(function(resultadoUpdate) {
            if (resultadoUpdate.error) {
                if (resultadoUpdate.error.code === "23505") {
                    return res.status(409).json("Error: Ya existe otro recurso con ese número de serie");
                }
                if (resultadoUpdate.error.code === "23503") {
                    return res.status(400).json("Error: El modelo o la ubicación seleccionada no existen");
                }
                console.log("Error al actualizar el recurso:", resultadoUpdate.error);
                return res.status(500).json("Error interno del servidor");
            }
            res.status(200).json("Recurso modificado correctamente");
        });
    });
});

// Reservas de un recurso
app.get("/api/recursos/:id/reservas", function(req, res){
    var idRecurso = req.params.id;

    supabase.from("recursos").select("id").eq("id", idRecurso).then(function(resultado){
        if (resultado.error) {
            console.log("Error al comprobar el recurso", resultado.error);
            res.status(500).json("Error al realizar la consulta");
            return;
        }
        if (resultado.data.length == 0) {
            res.status(404).json("Error, recurso con id " + idRecurso + " no existe");
            return;
        }

        supabase.from("reservas").select("*").eq("recurso", idRecurso).order("id").then(function(resultadoReservas){
            if (resultadoReservas.error) {
                console.log("Error al obtener las reservas", resultadoReservas.error);
                res.status(500).json("Error al realizar la consulta");
                return;
            }
            res.json(resultadoReservas.data);
        });
    });
});

// Reseñas de un recurso
app.get("/api/recursos/:id/resenyas", function(req, res){
    var idRecurso = req.params.id;

    supabase.from("recursos").select("id").eq("id", idRecurso).then(function(resultado){
        if (resultado.error) {
            console.log("Error al comprobar el recurso", resultado.error);
            res.status(500).json("Error al realizar la consulta");
            return;
        }
        if (resultado.data.length == 0) {
            res.status(404).json("Error, recurso con id " + idRecurso + " no existe");
            return;
        }

        supabase.from("resenyas").select("*").eq("recurso", idRecurso).order("id").then(function(resultadoResenyas){
            if (resultadoResenyas.error) {
                console.log("Error al obtener las resenyas", resultadoResenyas.error);
                res.status(500).json("Error al realizar la consulta");
                return;
            }
            res.json(resultadoResenyas.data);
        });
    });
});

// Sanitario por id (sin password)
app.get("/api/sanitarios/:id", function(req, res){
    var idSanitario = req.params.id;

    supabase.from("sanitarios").select("nombre, apellidos").eq("id", idSanitario).then(function(resultado){
        if (resultado.error) {
            console.log("Error al comprobar el recurso", resultado.error);
            res.status(500).json("Error al realizar la consulta");
            return;
        }
        if (resultado.data.length == 0) {
            res.status(404).json("Error, sanitario con id " + idSanitario + " no existe");
            return;
        }
        res.json(resultado.data[0]);
    });
});

// Iniciar servidor --> siempre último paso
app.listen(3000, function(){
    console.log("Servidor en marcha, escuchando en el puerto 3000");
})
