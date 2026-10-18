// Pablo Sánchez Sos
// Se van actualizando en cambiarSeccion
var seccionActual = "login"; // Con la que se inicia
var seccionAnterior = ""; 

var id; // Para guardar el id del gestor
var tokenGestor = null; //? Para guardar el token que devuelve el login
// Para ver el token, en la consola del navegador, en Network. Pegar en jwt.io y cambiar el secreto, te muestra el id de usuario y el tiempo de expiración del token.
var idRecursoGlobal; // Para guardar el id del recurso que se está modificando

var ws = null; // ** Variable global para la conexión WebSocket    

// Cargar listas
var listaCategorias = [];  
var listaModelos = [];
var listaUbicaciones = [];
var recursos = [];

// LOGIN
// Comprueba si las credenciales son válidas
function acceder(){ 
    //  Guarda el nombre y la contraseña en un objeto llamado credenciales
    var credenciales = {usuario: document.getElementById("usuario").value, 
        password: document.getElementById("password").value
    }
    // Mandamos los datos con post
    rest.post("/api/gestores/login",credenciales, function(estado,respuesta){ // Respuesta es lo que manda el servidor, en este caso el id
        if (estado==403 || estado==500){
            console.log(respuesta);
            alert(respuesta);
            return;
        }
        // Inicializado fuera
        id = respuesta.id; //? El servidor ahora manda {id, token}
        tokenGestor = respuesta.token; //? Se guarda para mandarlo en todas las peticiones
        actualizar();
        cargarCategorias(false); //? Antes se cargaban al abrir la página, pero ahora necesitan el token
        cargarUbicaciones(false); //?
        cambiarSeccion("principal");
        cargarRanking(); //! Carga el ranking de reservas por área médica al entrar
    })
}

// Actualiza el párrafo de bienvenida y actualiza la página de registro (modificar los datos)
function actualizar(){
    rest.get("/api/gestores/"+id + "?token=" + tokenGestor, function (estado, respuesta){ //?
        if (sesionCaducada(estado, respuesta)){ return; } //?
        if (estado== 404 || estado==500){
            alert(respuesta);
            return;
        }
        else{
            // Campos registro            
            var nombre = document.getElementById("nombre");
            var apellidos = document.getElementById("apellidos");
            var usuarioReg = document.getElementById("usuarioReg");
            var parrafo = document.getElementById("nombreUsuario");
            
            nombre.value = respuesta.nombre;
            apellidos.value = respuesta.apellidos;
            usuarioReg.value = respuesta.usuario;
            document.getElementById("passwordReg").value = "";
            
            // Párrafo bienvenida
            parrafo.innerHTML ="Bienvenido, " + respuesta.nombre + " " + respuesta.apellidos + "." + "<button class='editar' onclick=\"cambiarSeccion('registro')\">Editar datos</button>"; // (\") se usa para que tome las comillas como un caracter literal  

            // **
            if (!ws) {
                iniciarWS("gestor", id, respuesta.nombre + " " + respuesta.apellidos);
            }
        }
    })
}

//REGISTRO
// Da de alta nuevos usuarios y modifica los datos
function registrarActualizar(){
    // trim() quita los espacios al principio y al final
    var gestor = { nombre: document.getElementById("nombre").value.trim(),
    apellidos: document.getElementById("apellidos").value.trim(),
    usuario: document.getElementById("usuarioReg").value.trim(),
    password: document.getElementById("passwordReg").value.trim()}

    // Comprueba que nombre y apellidos sean letras y espacios con un mínimo de 1 caracter y 100 de máximo
    var patternCampo = /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü\s]{1,100}$/;
    if (!patternCampo.test(gestor.nombre) || !patternCampo.test(gestor.apellidos)){
        alert("Nombre o apellidos inválidos, solo se admiten letras y espacios")
        return;
    }
    
    // Comprueba que no hay campos sin rellenar
    if (gestor.nombre=="" || gestor.apellidos=="" || gestor.usuario==""){
        alert("Falta por completar algún campo");
        return;
    }

    // Si la variable id no tiene valor --> viene del login --> usuario nuevo
    // Comprueba también que la contraseña esté vacía
    if (id==null){
        if (gestor.password==""){
            alert("Rellena la contraseña")
            return;
        }
        // Crea nuevo usuario
        rest.post("/api/gestores", gestor, function(estado,respuesta){
            alert(respuesta); 
            if (estado!=201){
                return;
            }
            volverAnterior();
        })
    }
    else{
        // Modifica los datos de un usuario
        rest.put("/api/gestores/"+id + "?token=" + tokenGestor, gestor, function(estado,respuesta){ //?
            if (sesionCaducada(estado, respuesta)){ return; } //?
            alert(respuesta)
            // Si ocurre algún tipo de error, no se actualiza ni se vuelve a la sección anterior
            if (respuesta!="Datos modificados correctamente"){
                return;
            }
            actualizar();
            volverAnterior();
        })
    }
}

// PRINCIPAL
// Sirve tanto para crear los selects al iniciar la página, como para resetearlos al cerrar sesión o al recargar la página.
function crearSelects(){
    document.getElementById("categorias").innerHTML = "<option value=''>Seleccionar categoría</option> <option value=-1>Todos</option>";
    document.getElementById("modelos").innerHTML = "<option value=''>Seleccionar modelo</option> <option value=-1>Todos</option>";
    document.getElementById("ubicaciones").innerHTML = "<option value=''>Seleccionar ubicación</option> <option value=-1>Todos</option>";
    document.getElementById("estados").innerHTML = "<option value=''>Seleccionar estado</option> <option value=-1>Todos</option><option value=0>Operativo</option><option value=1>De baja o defectuoso</option><option value=2>En mantenimiento</option>";
}

// Crea las opciones del select de categorías
function cargarCategorias(limpiarRecursos){
    // Obtener el elemento select de categorías del HTML
    var selectCategorias = document.getElementById("categorias");
    var selectCategoriasRecursos = document.getElementById("categoriasRecursos");
    // Al crear un recurso, guarda el valor del select para que al volver a la página principal se muestre la misma categoría
    var valorAnterior = selectCategorias.value;
    
    // Obtener la lista de posibles categorías
    rest.get("/api/categorias?token=" + tokenGestor, function(estado, respuesta){ //?
        if (sesionCaducada(estado, respuesta)){ return; } //?
        listaCategorias = respuesta;
        selectCategorias.innerHTML = "<option value=''>Seleccionar categoría</option> <option value=-1>Todos</option>";
        if(limpiarRecursos){
            // Solo carga el select de recursos con esta opción cuando se trata de un recurso nuevo
            selectCategoriasRecursos.innerHTML = "<option value=''>Seleccionar categoría</option>";
        }
        else{
            selectCategoriasRecursos.innerHTML = "";
        }
        for (i = 0; i < listaCategorias.length; i++) {
            // Crear un nuevo elemento option para cada categoría
            var option1 = document.createElement("option");
            var option2 = document.createElement("option");
            
            // Asignar el id de la categoría como valor del option
            option1.value = listaCategorias[i].id;
            option2.value = listaCategorias[i].id;
            
            // Asignar el nombre de la categoría como texto visible del option
            option1.textContent = listaCategorias[i].nombre;
            option2.textContent = listaCategorias[i].nombre;
            
            // Añadir el option al select de categorías
            selectCategorias.appendChild(option1);
            selectCategoriasRecursos.appendChild(option2);
        }
        selectCategorias.value = valorAnterior; //Para cuando vuelves desde añadir recurso, que no se pierda la categoria seleccionada en el select de búsqueda
    })
}


// Muestra en el select los modelos disponbiles según la categoría seleccionada
function cargarModelos(entrar, modeloPreseleccionado){
    rest.get("/api/modelos?token=" + tokenGestor, function(estado, respuesta){ //?
        if (sesionCaducada(estado, respuesta)){ return; } //?
        listaModelos = respuesta;
        var selectCategorias = document.getElementById("categorias");
        var selectCategoriasRecursos = document.getElementById("categoriasRecursos");
        var selectModelos = document.getElementById("modelos");
        var selectModelosRecursos = document.getElementById("modelosRecursos");

        selectModelosRecursos.innerHTML = "";

        if (entrar){
            selectModelosRecursos.innerHTML = "<option value=''>Seleccionar modelo</option>";
        }
        else{
            selectModelos.innerHTML = "<option value=''>Seleccionar modelo</option>  <option value=-1>Todos</option>";
        }

        for (var i = 0; i < listaModelos.length; i++) {
            if (!entrar && (listaModelos[i].categoria == selectCategorias.value || selectCategorias.value == -1)) {
                var option1 = document.createElement('option');
                option1.value = listaModelos[i].id;
                option1.textContent = listaModelos[i].nombre;
                selectModelos.appendChild(option1);
            }

            if (entrar && (listaModelos[i].categoria == selectCategoriasRecursos.value || selectCategoriasRecursos.value == -1)) {
                var option2 = document.createElement('option');
                option2.value = listaModelos[i].id;
                option2.textContent = listaModelos[i].nombre;
                selectModelosRecursos.appendChild(option2);
            }
        }

        // Una vez creadas las opciones, ya podemos preseleccionar el modelo del recurso
        if (entrar && modeloPreseleccionado !== undefined) {
            selectModelosRecursos.value = modeloPreseleccionado;
        }
    })
}
//Muestra en el select todas las ubicaciones
function cargarUbicaciones(limpiarRecursos){
    rest.get("/api/ubicaciones?token=" + tokenGestor, function(estado, respuesta){ //?
        if (sesionCaducada(estado, respuesta)){ return; } //?
        listaUbicaciones = respuesta;
        var selectUbicaciones = document.getElementById("ubicaciones");
        var selectUbicacionesRecursos = document.getElementById("ubicacionesRecursos");

        var valorAnterior = selectUbicaciones.value;

        // Limpiar siempre el select principal antes de rellenar
        selectUbicaciones.innerHTML = "<option value=''>Seleccionar ubicación</option> <option value=-1>Todos</option>";
        // limpiarRecursos=true cuando es un recurso nuevo
        if(limpiarRecursos){
            selectUbicacionesRecursos.innerHTML = "<option value=''>Seleccionar ubicación</option>";
        }
        else{
            selectUbicacionesRecursos.innerHTML = "";
        }

        for (i = 0; i < listaUbicaciones.length; i++) {
            // Crear un nuevo elemento option para cada ubicación
            var option1 = document.createElement("option");
            var option2 = document.createElement("option");
            // Asignar el id de la ubicación como valor del option
            option1.value = listaUbicaciones[i].id;
            option2.value = listaUbicaciones[i].id;
            // Asignar el nombre de la ubicación como texto visible del option
            option1.textContent = listaUbicaciones[i].nombre;
            option2.textContent = listaUbicaciones[i].nombre;
            // Añadir el option al select de ubicaciones
            selectUbicaciones.appendChild(option1);
            selectUbicacionesRecursos.appendChild(option2);
        }
        selectUbicaciones.value = valorAnterior; //Para cuando vuelves desde añadir recurso, que no se pierda la ubicación seleccionada en el select de búsqueda,
    })
}

// El parámetro ultima se usa para que si se borran o se vueleve a la principal se muestre la tabla con la última búsqueda hecha sin tener en cuenta posibles modificaciones de los filtros de la página principal que no han llegado a buscarse

var ultimaBusqueda = {};

function buscarRecursos(ultima){

    var selectCategorias = document.getElementById("categorias");
    var selectModelos = document.getElementById("modelos");
    var selectUbicaciones = document.getElementById("ubicaciones");
    var selectEstados = document.getElementById("estados");
    // Solo actualiza los filtros si no viene de eliminar o de volverPrincipal
    if (!ultima){
        if (selectCategorias.value=="" || selectModelos.value=="" || selectUbicaciones.value=="" || selectEstados.value==""){
            alert("Selecciona todos los campos para realizar la búsqueda");
            return;
        }
        ultimaBusqueda = {categoria: selectCategorias.value, modelo: selectModelos.value, ubicacion: selectUbicaciones.value, estado: selectEstados.value};
    }
    
    // Busca con todos los parámetros siempre
    rest.get("/api/recursos?categoria="+ultimaBusqueda.categoria+"&modelo="+ultimaBusqueda.modelo+"&ubicacion="+ultimaBusqueda.ubicacion+"&estado="+ultimaBusqueda.estado + "&token=" + tokenGestor, function(estado,respuesta){ //?
        if (sesionCaducada(estado, respuesta)){ return; } //?
        recursos = respuesta;
        mostrarTabla();
        if (recursos.length==0 && !ultima){ // Si se ha llamado a buscarRecursos() desde eliminarRecurso(), no se muestra el mensaje de "No se han encontrado recursos con esos criterios de búsqueda" aunque ya no haya recursos que mostrar, porque es normal que al eliminar un recurso desaparezca de la tabla, aunque sí se muestra el mensaje si se ha llamado a buscarRecursos() desde cualquier otra función, para informar al usuario de que no hay recursos que mostrar
        alert("No se han encontrado recursos con esos criterios de búsqueda");
        return;
        }
    })
}


function mostrarTabla(){
    // Limpiar la tabla de resultados
    limpiarTabla();
    var tabla = document.getElementById("tablaRecursos");
    // Añadir una fila por cada recurso encontrado
    for (i=0; i<recursos.length; i++){
        // Elementos de la tabla
        var fila = document.createElement("tr");
        var tdNumeroSerie = document.createElement("td");
        var tdCategoria = document.createElement("td");
        var tdModelo = document.createElement("td");
        var tdUbicacion = document.createElement("td");
        var tdEstado = document.createElement("td");
        var botones = document.createElement("td");

        //ID del recurso
        var idRecurso = recursos[i].id;

        //Nº serie del recurso
        tdNumeroSerie.textContent = recursos[i].numero_serie;

        // Para obtener los nombres de categoría, modelo y ubicación, hay que hacer una consulta a cada una de las listas cargadas previamente, para luego buscar el nombre correspondiente a los diferentes ids que tiene el recurso
        

        var idCategoriaDelRecurso;
        // Se busca a través de modelo
        for (var j = 0; j < listaModelos.length; j++) {
            if (listaModelos[j].id == recursos[i].modelo) {
                // id categoría a través de la lista de modelos
                idCategoriaDelRecurso = listaModelos[j].categoria;

                // Nombre del modelo
                tdModelo.textContent = listaModelos[j].nombre;
                break;
            }
        }

        // Nombre de la categoría
        for (var j = 0; j < listaCategorias.length; j++) {
            if (listaCategorias[j].id == idCategoriaDelRecurso) {
                tdCategoria.textContent = listaCategorias[j].nombre;
                break;
            }
        }

        // Nombre de la ubicación
        for (j=0; j<listaUbicaciones.length; j++){
            if (listaUbicaciones[j].id==recursos[i].ubicacion){
                tdUbicacion.textContent = listaUbicaciones[j].nombre;
                break;
            }
        }

        // Nombre del estado
        if (recursos[i].estado==0){
            tdEstado.textContent = "Operativo";
        }
        else if (recursos[i].estado==1){
            tdEstado.textContent = "De baja o defectuoso";
        }
        else if (recursos[i].estado==2){
            tdEstado.textContent = "En mantenimiento";
        }
        // Creación de los botones de abrir el recurso y eliminarlo pasando como parámetro su correspondiente id
        botones.innerHTML = "<button onclick='abrirRecurso(" + idRecurso + "," + idCategoriaDelRecurso + ")'>Abrir</button><button onclick='eliminarRecurso(" + idRecurso + ")'>X</button>";

        // Se añade cada elemento a la fila 
        fila.appendChild(tdNumeroSerie);
        fila.appendChild(tdCategoria);
        fila.appendChild(tdModelo);
        fila.appendChild(tdUbicacion);
        fila.appendChild(tdEstado);
        fila.appendChild(botones);

        // Se añade la fila a la tabla
        tabla.appendChild(fila);
    } 
}

function limpiarTabla(){
    var tabla = document.getElementById("tablaRecursos");
    tabla.innerHTML = "";
}

function eliminarRecurso(idRecurso){
    rest.delete("/api/recursos/"+idRecurso + "?token=" + tokenGestor, function(estado,respuesta){ //?
        if (sesionCaducada(estado, respuesta)){ return; } //?
        if (estado==404 || estado==500){
            alert(respuesta);
            return;
        }
        buscarRecursos(true); // Para que se actualice la tabla con el recurso eliminado, sin tener que actualizar la página. El parámetro true es para que no muestre el mensaje de "No se han encontrado recursos con esos criterios de búsqueda" al eliminar un recurso, aunque ya no haya recursos que mostrar
    })
}


// PRINCIPAL
// Vuelve a cargarlo todo desde 0
function cerrarSesion(){
    id = null;
    tokenGestor = null; //? Se borra el token al cerrar sesión
    cambiarSeccion("login");
    limpiarTabla();
    crearSelects();
    limpiarFormulario();
    //? Las categorías y ubicaciones ya no se cargan aquí, se cargan en acceder() cuando hay token
    cerrarWS(); // **
    document.getElementById("tablaRanking").innerHTML = ""; //! Limpia el ranking al cerrar sesión
}


// Botón ABRIR
function abrirRecurso(idRecurso,idCat){
    document.getElementById("tablaReservas").innerHTML = "";
    document.getElementById("tablaResenyas").innerHTML = "";
    idRecursoGlobal = idRecurso;

    rest.get("/api/recursos/"+idRecurso + "?token=" + tokenGestor, function(estado,respuesta){ //?
        if (sesionCaducada(estado, respuesta)){ return; } //?
        var recurso = respuesta;
        if (estado==404 || estado==500){
            alert(respuesta);
            return;
        }
        cambiarSeccion("recursos");
        document.getElementById("estadosRecursos").innerHTML = "<option value=0>Operativo</option><option value=1>De baja o defectuoso</option><option value=2>En mantenimiento</option>";

        // Primero fijamos la categoría...
        document.getElementById("categoriasRecursos").value = idCat;
        // ...y ahora cargamos los modelos filtrados por esa categoría, indicando cuál debe quedar preseleccionado
        cargarModelos(true, recurso.modelo);

        document.getElementById("numSerie").value = recurso.numero_serie;
        document.getElementById("ubicacionesRecursos").value = recurso.ubicacion;
        document.getElementById("estadosRecursos").value = recurso.estado;

        buscarReservasResenyas();
    })
}

function modificarRecurso(){
    var recursoModificado = {
        categoria: document.getElementById("categoriasRecursos").value,
        modelo: document.getElementById("modelosRecursos").value,
        ubicacion: document.getElementById("ubicacionesRecursos").value,
        numero_serie: document.getElementById("numSerie").value.trim(),
        estado: document.getElementById("estadosRecursos").value
    }
    // Comprueba si hay campos vacíos
    if (recursoModificado.categoria=="" || recursoModificado.modelo=="" || recursoModificado.ubicacion=="" || recursoModificado.estado=="" || recursoModificado.numero_serie==""){
        alert("Rellena todos los campos para crear un recurso");
        return;
    }
    // Modificar
    if (idRecursoGlobal){
        rest.put("/api/recursos/"+idRecursoGlobal + "?token=" + tokenGestor, recursoModificado, function(estado,respuesta){ //?
            if (sesionCaducada(estado, respuesta)){ return; } //?
            alert(respuesta);
            if (respuesta!="Recurso modificado correctamente"){
                return;
            }
        })
    }

    // Crear 
    else {
    rest.post("/api/recursos?token=" + tokenGestor, recursoModificado, function(estado,respuesta){ //?
        if (sesionCaducada(estado, respuesta)){ return; } //?
        alert(respuesta);
        // **
        if (estado == 201 && ws) { // 201 indica éxito al crear
            var catSelect = document.getElementById("categoriasRecursos");
            var modSelect = document.getElementById("modelosRecursos");
            ws.send(JSON.stringify({
                operacion: "avisoNuevoRecurso",
                categoria: catSelect.options[catSelect.selectedIndex].text,
                modelo: modSelect.options[modSelect.selectedIndex].text,
                numSerie: recursoModificado.numero_serie
            }));
        }
    })
}
}

// Botón AÑADIR RECURSO
function abrirRecursoNuevo(){
    // Primero hay que borrar las tablas de reservas y recursos, sino se mantendrán si se ha entrado antes a modificar un recurso
    document.getElementById("tablaReservas").innerHTML = "";
    document.getElementById("tablaResenyas").innerHTML = "";

    // Para no permitir seleccionar "todos" (limpia)
    document.getElementById("categoriasRecursos").innerHTML = "";
    document.getElementById("modelosRecursos").innerHTML = "<option value=''>Seleccionar modelo</option>"
    document.getElementById("numSerie").value = "";
    document.getElementById("ubicacionesRecursos").innerHTML = "";
    document.getElementById("estadosRecursos").innerHTML = "<option value=''>Seleccionar estado</option><option value=0>Operativo</option><option value=1>De baja o defectuoso</option><option value=2>En mantenimiento</option>";
    
    cargarCategorias(true);
    cargarUbicaciones(true);
    cargarModelos(true);
    cambiarSeccion("recursos");
}

var sanitarios = {};

function buscarReservasResenyas(){
    // Está el segundo rest dentro del primero para conservar la asincronía
    rest.get("/api/recursos/" + idRecursoGlobal + "/reservas?token=" + tokenGestor, function(estado, respuesta1){ //?
        if (sesionCaducada(estado, respuesta1)){ return; } //?
        var reservas = respuesta1;
        if (estado == 404 || estado == 500){
            alert(reservas); 
            return;
        }

        rest.get("/api/recursos/" + idRecursoGlobal + "/resenyas?token=" + tokenGestor, function(estado, respuesta2){ //?
            if (sesionCaducada(estado, respuesta2)){ return; } //?
            var resenyas = respuesta2;
            if (estado == 404 || estado == 500){
                alert(resenyas);
                return;
            }

            // Recoger ids únicos de sanitarios
            var ids = [];
            for (var i = 0; i < reservas.length; i++){
                // Comprueba si el id ya está en la lista
                if (ids.indexOf(reservas[i].sanitario) == -1){
                    ids.push(reservas[i].sanitario);
                } 
            }
            for (var i = 0; i < resenyas.length; i++){
                if (ids.indexOf(resenyas[i].sanitario) == -1){
                    ids.push(resenyas[i].sanitario);
                } 
            }
            cargarSanitarios(ids, reservas, resenyas);
        });
    });
}

function cargarSanitarios(ids, reservas, resenyas){
    var contador = 0; // Necesario para saber cuándo han terminado TODAS las peticiones asíncronas, ya que se lanzan a la vez y terminan en orden aleatorio
    
    for (let i = 0; i < ids.length; i++){ // let en lugar de var para que cada iteración tenga su propio valor de i capturado correctamente, evitando el problema de que todas las callbacks usaran el último valor de i
        
        rest.get("/api/sanitarios/" + ids[i] + "?token=" + tokenGestor, function(status, sanitario){ //?
            if (sesionCaducada(status, sanitario)){ return; } //?
            sanitarios[ids[i]] = sanitario.nombre + " " + sanitario.apellidos;
            contador++; // Cada vez que llega una respuesta incrementamos el contador
            if (contador == ids.length){ // Cuando llega al último id, rellena las tablas
                rellenarTablaReservas(reservas);
                rellenarTablaResenyas(resenyas);
            }
        });
    }
}


function rellenarTablaReservas(reservas){
    var tablaReservas = document.getElementById("tablaReservas");
    // Limpia la tabla
    tablaReservas.innerHTML = "";

    // Añade fila por cada reserva
    for (var i = 0; i < reservas.length; i++){
        // Crea elementos
        var fila = document.createElement("tr");
        var tdSanitario = document.createElement("td");
        var tdHorasEstimadas = document.createElement("td");
        var tdFechaPeticion = document.createElement("td");
        var tdFechaInicio = document.createElement("td");
        var tdFechaFin = document.createElement("td");

        // Da valor a los elementos
        tdSanitario.textContent = sanitarios[reservas[i].sanitario];
        tdHorasEstimadas.textContent = reservas[i].horas_estimadas;
        if (reservas[i].fecha_peticion!=null){   
            tdFechaPeticion.textContent = new Date(reservas[i].fecha_peticion).toLocaleString();
        }
        else{
            tdFechaPeticion.textContent = "";
        }
        if (reservas[i].fecha_inicio!=null){
            tdFechaInicio.textContent = new Date(reservas[i].fecha_inicio).toLocaleString();
        }
        else{
            tdFechaInicio.textContent = "";
        }
        if (reservas[i].fecha_fin!=null){
            tdFechaFin.textContent = new Date(reservas[i].fecha_fin).toLocaleString();
        }
        else{
            tdFechaFin.textContent = "";
        }
        fila.style.backgroundColor = calcularColorReserva(reservas[i]);
        fila.appendChild(tdSanitario);
        fila.appendChild(tdHorasEstimadas);
        fila.appendChild(tdFechaPeticion);
        fila.appendChild(tdFechaInicio);
        fila.appendChild(tdFechaFin);
        tablaReservas.appendChild(fila);
    }
}

function rellenarTablaResenyas(resenyas){
    var tablaResenyas = document.getElementById("tablaResenyas");
    tablaResenyas.innerHTML = "";
    for (var i = 0; i < resenyas.length; i++){
        var fila = document.createElement("tr");
        var tdFecha = document.createElement("td");
        var tdSanitario = document.createElement("td");
        var tdValoracion = document.createElement("td");
        var tdDescripcion = document.createElement("td");
        tdFecha.textContent = new Date(resenyas[i].fecha).toLocaleDateString();
        tdSanitario.textContent = sanitarios[resenyas[i].sanitario];
        tdValoracion.textContent = resenyas[i].valor;
        tdDescripcion.textContent = resenyas[i].descripcion;
        fila.appendChild(tdFecha);
        fila.appendChild(tdSanitario);
        fila.appendChild(tdValoracion);
        fila.appendChild(tdDescripcion);
        tablaResenyas.appendChild(fila);
    }
} 

// Se debe buscar de nuevo en principal para ver la modifiación realizada en recursos
function volverPrincipal(){
    cambiarSeccion("principal");
    buscarRecursos(true); // Así se actualiza la tabla automáticamente y evita el problema de que el usuario haya cambiado los filtros
    // Si no se pone a null, se queda guardado el último id del recurso abierto
    idRecursoGlobal = null;
}


function calcularColorReserva(reserva) { // No se van a dar azules ya que la base de datos no se actualiza y todo son fechas pasadas.
    const ahora = new Date(); // Fecha y hora actual

    // 1. Blanca: La reserva ya ha finalizado
    if (reserva.fecha_fin !== null) {
        return "#FFFFFF";
    }

    // 2. Verde: La reserva aún no ha comenzado (no tiene fecha de inicio)
    if (reserva.fecha_inicio === null) {
        return "#6ef86e";
    }

    // 3. En uso (Tiene fecha_inicio pero no fecha_fin)
    // Calculamos la diferencia en milisegundos y pasamos a horas
    var milisegundosTranscurridos = ahora - new Date(reserva.fecha_inicio);
    var horasTranscurridas = milisegundosTranscurridos / (1000 * 60 * 60);
    // Comparamos con las horas estimadas de la reserva
    if (horasTranscurridas > reserva.horas_estimadas) {
        // Roja: Tiempo excedido
        return "#f86e6e";
    } else {
        // Azul: Dentro del tiempo previsto
        return "#6ec1f8";
    }
}


function cambiarSeccion(seccion){
    // Le borro activa a la clase, y así ya no se muestra (mantiene seccion)
    document.getElementById(seccionActual).classList.remove("activa");
    // Le añado activa a la clase, y así ya se muestra (mantiene seccion)
    document.getElementById(seccion).classList.add("activa");
    seccionAnterior = seccionActual; 
    seccionActual = seccion; // Actualizo donde estoy
}

function volverAnterior(){
    // Limpiar campos si viene desde el login (volver a login desde registro)
    if (seccionAnterior == "login"){
        document.getElementById("usuario").value = "";
        document.getElementById("password").value = "";
        document.getElementById("nombre").value = "";
        document.getElementById("apellidos").value = "";
        document.getElementById("usuarioReg").value = "";
        document.getElementById("passwordReg").value = "";
    }
    // volver a principal desde registro
    if (seccionAnterior == "principal"){
        actualizar(); // Recarga los datos reales del servidor, descartando los cambios
    }
    cambiarSeccion(seccionAnterior);
}

window.onload = function() {
    id = null; // Para asegurarnos de que no hay ningún id guardado al recargar la página
    tokenGestor = null; //? Para asegurarnos de que no hay ningún token guardado al recargar la página
    idRecursoGlobal = null; // Para asegurarnos de que no hay ningún id de recurso guardado al recargar la página
    crearSelects();
    limpiarTabla();
    limpiarFormulario(); // Para que no se muestren los datos si entra otro usuario (refrescando la página)
    //? Las categorías y ubicaciones ya no se cargan aquí, se cargan en acceder() cuando hay token
    cerrarWS(); // **
};

function limpiarFormulario(){
    // Hay que borrar los campos del formulario, para que no se muestren los datos si entra otro usuario (refrescando la página)
    document.getElementById("nombre").value = "";
    document.getElementById("apellidos").value = "";
    document.getElementById("usuarioReg").value = "";
    document.getElementById("passwordReg").value = "";
    document.getElementById("usuario").value = "";
    document.getElementById("password").value = "";
}

// ** WS
function iniciarWS(tipo, id, nombre) {
    ws = new WebSocket("ws://localhost:4444", "saludos");
    ws.onopen = function () {
        // Al abrir, nos registramos en el servidor
        ws.send(JSON.stringify({ operacion: "login", tipo: tipo, id: id, nombre: nombre }));
    };
    ws.onmessage = function (e) {
        var msg = JSON.parse(e.data);
        if (msg.operacion === "aviso") {
            mostrarAviso(msg);
        }
    };
}

function mostrarAviso(msg) {
    var tabla = document.getElementById("tablaAvisos");
    var fila = document.createElement("tr");
    fila.style.backgroundColor = msg.color;

    var tdFecha = document.createElement("td");
    tdFecha.textContent = msg.fecha;
    var tdOrigen = document.createElement("td");
    tdOrigen.textContent = msg.origen;
    var tdMensaje = document.createElement("td");
    tdMensaje.textContent = msg.texto;

    fila.appendChild(tdFecha);
    fila.appendChild(tdOrigen);
    fila.appendChild(tdMensaje);
    tabla.appendChild(fila);
}

function cerrarWS(){
    if (ws) {
        ws.close();
        ws = null;
    }
    document.getElementById("tablaAvisos").innerHTML = "";
}



//! PRÁCTICA 3 - PARTE 1: Integración con la API del Ministerio de Sanidad

//! URL de la API REST del Ministerio (misma URL para POST y GET)
var URL_MINISTERIO = "https://undefined.ua.es/telemedicina/api/datos";
//! Área médica asignada: todos mis gestores son de Oncología
var ID_AREA = 14;
//! Códigos de las áreas médicas según el enunciado
var AREAS = {
    1: "Alergología", 2: "Anestesiología", 3: "Cardiología", 4: "Cirugía General",
    5: "Dermatología", 6: "Aparato Digestivo", 7: "Endocrinología", 8: "Ginecología",
    9: "Hematología", 10: "Medicina Interna", 11: "Neumología", 12: "Neurología",
    13: "Oftalmología", 14: "Oncología", 15: "Pediatría", 16: "Psiquiatría",
    17: "Traumatología", 18: "Urología"
};

var sanitariosMinisterio = {}; //! id sanitario -> {nombre, apellidos}

//! Botón "Enviar reservas al Ministerio"
//! Paso 1: obtiene todos los recursos, los modelos y las categorías (un rest dentro de otro para conservar la asincronía)
function enviarReservasMinisterio(){
    rest.get("/api/recursos?categoria=-1&modelo=-1&ubicacion=-1&estado=-1&token=" + tokenGestor, function(estado, recursosTodos){ //?
        if (sesionCaducada(estado, recursosTodos)){ return; } //?
        if (estado == 404 || estado == 500){
            alert(recursosTodos);
            return;
        }
        rest.get("/api/modelos?token=" + tokenGestor, function(estado, modelosTodos){ //?
            if (sesionCaducada(estado, modelosTodos)){ return; } //?
            if (estado == 404 || estado == 500){
                alert(modelosTodos);
                return;
            }
            rest.get("/api/categorias?token=" + tokenGestor, function(estado, categoriasTodas){ //?
                if (sesionCaducada(estado, categoriasTodas)){ return; } //?
                if (estado == 404 || estado == 500){
                    alert(categoriasTodas);
                    return;
                }
                // id categoría -> nombre
                var nombreCategoria = {};
                for (var i = 0; i < categoriasTodas.length; i++){
                    nombreCategoria[categoriasTodas[i].id] = categoriasTodas[i].nombre;
                }
                // id modelo -> nombre de su categoría
                var categoriaDeModelo = {};
                for (var i = 0; i < modelosTodos.length; i++){
                    categoriaDeModelo[modelosTodos[i].id] = nombreCategoria[modelosTodos[i].categoria];
                }
                cargarReservasMinisterio(recursosTodos, categoriaDeModelo);
            });
        });
    });
}

//! Paso 2: obtiene las reservas de cada recurso
function cargarReservasMinisterio(recursosTodos, categoriaDeModelo){
    var reservasTodas = []; // Todas las reservas, junto con la categoría de su recurso
    var contador = 0; // Para saber cuándo han terminado TODAS las peticiones asíncronas

    if (recursosTodos.length == 0){
        alert("No hay reservas que enviar al Ministerio");
        return;
    }

    for (let i = 0; i < recursosTodos.length; i++){
        rest.get("/api/recursos/" + recursosTodos[i].id + "/reservas?token=" + tokenGestor, function(estado, reservas){ //?
            if (sesionCaducada(estado, reservas)){ return; } //?
            if (estado == 404 || estado == 500){
                alert(reservas);
                return;
            }
            for (var j = 0; j < reservas.length; j++){
                reservasTodas.push({reserva: reservas[j], categoria: categoriaDeModelo[recursosTodos[i].modelo]});
            }
            contador++;
            if (contador == recursosTodos.length){ // Cuando llega la última respuesta, sigue con los sanitarios
                if (reservasTodas.length == 0){
                    alert("No hay reservas que enviar al Ministerio");
                    return;
                }
                cargarSanitariosMinisterio(reservasTodas);
            }
        });
    }
}

//! Paso 3: obtiene nombre y apellidos de cada sanitario distinto
function cargarSanitariosMinisterio(reservasTodas){
    var idsSanitarios = []; 
    for (var i = 0; i < reservasTodas.length; i++){
        if (idsSanitarios.indexOf(reservasTodas[i].reserva.sanitario) == -1){
            idsSanitarios.push(reservasTodas[i].reserva.sanitario);
        }
    }

    var contador = 0;
    for (let i = 0; i < idsSanitarios.length; i++){
        rest.get("/api/sanitarios/" + idsSanitarios[i] + "?token=" + tokenGestor, function(estado, sanitario){ //?
            if (sesionCaducada(estado, sanitario)){ return; } //?
            if (estado == 404 || estado == 500){
                alert(sanitario);
                return;
            }
            sanitariosMinisterio[idsSanitarios[i]] = {nombre: sanitario.nombre, apellidos: sanitario.apellidos};
            contador++;
            if (contador == idsSanitarios.length){
                enviarDatosMinisterio(reservasTodas);
            }
        });
    }
}

//! Paso 4: construye el objeto del enunciado y lo manda al Ministerio con POST
function enviarDatosMinisterio(reservasTodas){
    var datos = [];
    for (var i = 0; i < reservasTodas.length; i++){
        var r = reservasTodas[i].reserva;
        datos.push({
            "nombre": sanitariosMinisterio[r.sanitario].nombre,
            "apellidos": sanitariosMinisterio[r.sanitario].apellidos,
            "categoría": reservasTodas[i].categoria,
            "horas_estimadas": r.horas_estimadas,
            "fec_pet": r.fecha_peticion,
            "fec_ini": r.fecha_inicio,
            "fecha_fin": r.fecha_fin
        });
    }

    var envio = {
        "id_area": ID_AREA,
        "fecha": new Date().toLocaleDateString("sv-SE"), // Formato YYYY-MM-DD, solo coges la fecha, no la hora
        "datos": datos
    };

    rest.post(URL_MINISTERIO, envio, function(estado, respuesta){
        if (estado < 200 || estado >= 300){ // 200 indica éxito, cualquier otro código es error
            alert("Error al enviar las reservas al Ministerio");
            return;
        }
        alert("Se han enviado " + datos.length + " reservas al Ministerio de Sanidad");
        cargarRanking(); // Actualiza el ranking con los nuevos datos
    });
}

//! GET al Ministerio y muestra el ranking de reservas por área médica
function cargarRanking(){
    rest.get(URL_MINISTERIO, function(estado, contenido){
        if (estado < 200 || estado >= 300){
            alert("No se ha podido cargar el ranking del Ministerio");
            return;
        }

        // Total de reservas por id_area
        var totales = {};
        for (var clave in AREAS){ //! Todas las áreas empiezan con 0 reservas, así aparecen aunque el Ministerio no tenga datos suyos
            totales[clave] = 0;
        }
        if (Array.isArray(contenido)){
            // [{id_area, fecha, datos:[...]}, ...]
            for (var i = 0; i < contenido.length; i++){
                var area = contenido[i].id_area;
                totales[area] = (totales[area] || 0) + contarReservas([contenido[i]]);
            }
        }
        else if (contenido && typeof contenido == "object"){
            // {"14": [...], "15": [...], ...}
            for (var clave in contenido){
                totales[clave] = (totales[clave] || 0) + contarReservas(contenido[clave]);
            }
        }

        // Ordenar de mayor a menor número de reservas
        var ranking = [];
        for (var clave in totales){
            ranking.push({id_area: clave, total: totales[clave]});
        }
        //! Bubble sort para ordenar de mayor a menor
        for (var i = 0; i < ranking.length - 1; i++){
            for (var j = 0; j < ranking.length - 1 - i; j++){
                if (ranking[j].total < ranking[j + 1].total){
                    var auxiliar = ranking[j]; // Guardamos uno de los dos para no perderlo al intercambiar
                    ranking[j] = ranking[j + 1];
                    ranking[j + 1] = auxiliar;
                }
            }
        }

        mostrarRanking(ranking);
    });
}

//! Cuenta cuántas reservas contiene un valor de la respuesta del Ministerio.
//! Admite una lista de registros {id_area, fecha, datos:[...]} o directamente una lista de reservas.
function contarReservas(valor){
    if (Array.isArray(valor)){
        var total = 0;
        for (var i = 0; i < valor.length; i++){
            if (valor[i] && Array.isArray(valor[i].datos)){
                total += valor[i].datos.length;
            }
            else {
                total += 1;
            }
        }
        return total;
    }
    if (valor && Array.isArray(valor.datos)){
        return valor.datos.length;
    }
    return 0;
}

//! Rellena la tabla del ranking
function mostrarRanking(ranking){
    var tabla = document.getElementById("tablaRanking");
    tabla.innerHTML = "";
    for (var i = 0; i < ranking.length; i++){
        var fila = document.createElement("tr");
        var tdPuesto = document.createElement("td");
        var tdArea = document.createElement("td");
        var tdTotal = document.createElement("td");

        tdPuesto.textContent = i + 1;
        tdArea.textContent = AREAS[ranking[i].id_area] || ("Área " + ranking[i].id_area);
        tdTotal.textContent = ranking[i].total;

        fila.appendChild(tdPuesto);
        fila.appendChild(tdArea);
        fila.appendChild(tdTotal);
        tabla.appendChild(fila);
    }
}

//? PRÁCTICA 3 - PARTE 2: Autenticación con JWT

//? Si el servidor responde 401 (token ausente, incorrecto o caducado) avisa y vuelve al login
function sesionCaducada(estado, respuesta){
    if (estado == 401){
        alert(respuesta);
        cerrarSesion();
        return true;
    }
    return false;
}
