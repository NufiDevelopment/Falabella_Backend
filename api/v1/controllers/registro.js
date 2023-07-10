const api = require("express").Router(),
    fs = require("fs"),
    moment = require("moment"),
    {v1: uuidv1 } = require('uuid'),
    DB = require("../utils/DB"),
    Nufi = require("../utils/Nufi"),
    Utilities = require("../utils/Utilities"),
    CATALOGO_SEXO = {'H':'Hombre', 'M': 'Mujer'},
    CATALOGO_ESTADO = {'AS': 'Aguascalientes', 'BC': 'Baja California', 'BS': 'Baja California Sur', 'CC': 'Campeche', 'CL': 'Coahuila de Zaragoza', 'CM': 'Colima', 'CS': 'Chiapas', 'CH': 'Chihuahua', 'DF': 'Distrito Federal', 'DG': 'Durango', 'GT': 'Guanajuato', 'GR': 'Guerrero', 'HG': 'Hidalgo', 'JC': 'Jalisco', 'MC': 'México', 'MN': 'Michoacán de Ocampo', 'MS': 'Morelos', 'NT': 'Nayarit', 'NL': 'Nuevo León', 'OC': 'Oaxaca', 'PL': 'Puebla', 'QT': 'Querétaro', 'QR': 'Quintana Roo', 'SP': 'San Luis Potosí', 'SL': 'Sinaloa', 'SR': 'Sonora', 'TC': 'Tabasco', 'TS': 'Tamaulipas', 'TL': 'Tlaxcala', 'VZ': 'Veracruz de Ignacio de la Llave', 'YN': 'Yucatán', 'ZS': 'Zacatecas'};
    
api.post("/crear", telefonoValido, function(req, res) {
    const numero = req.body.numero || "",
        correo = req.body.correo || "",
        uuid = uuidv1();
        
        let telefonoValido = req.telefonoValido;

        if(telefonoValido){

            req.Log(`Crear Registro (DB)`, `Insertando registro`);
            DB.insert({
                    uuid: uuid,
                    fecha_creacion: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
                    numero: numero,
                    correo: correo,
                    estatus: "registrado"
                }, DB.table.REGISTROS)
                .then((id) => {
                    req.Log(`Crear Registro (DB)`, `Registro insertado con id: ${id}`);
                    res.response("success", "Registro insertado", {uuid}, 200);
                })
                .catch((err) => {
                    req.Log(`Crear Registro (DB) Error`, err.message || err);
                    res.response("error", `Error al crear registro, porfavor intentelo nuevamente.`, null, 400);
                });
        }
        else{
            res.response("error", `Télefono previamente registrado.`, {telefonoValido}, 400);
        }
});

api.post("/evento", obtenerRegistro, function(req, res) {
    const evento = req.body.evento,
        identificador = req.body.identificador;

    if(!evento) return res.response("error", "Campo evento requerido", null);
    if(!identificador) return res.response("error", "Campo identificador requerido", null);

    req.Log(`Evento (DB)`, `Insertando evento`);
    DB.insert({
            fecha_creacion: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
            registro: req.user.id,
            evento: evento,
            identificador: identificador
        }, DB.table.LOGS)
        .then((id) => {
            req.Log(`Evento (DB)`, `Evento insertado`);
            res.response("success", "Evento insertado", {id}, 200);
        })
        .catch((err) => {
            req.Log(`Evento (DB) Error`, err.message || err);
            res.response("error",`Error insertando evento`, null, 400);
        });
});

api.get("/estatus", obtenerRegistro, function(req, res) {
    let _user = req.user;
    delete _user.id;
    res.response("success", "Registro obtenido", _user);
});

api.post("/ocr_frente", obtenerRegistro, function(req, res) {
    const base64 = req.body.base64 || "";

    Nufi.INEfrente(base64, req)
        .then( ocr => {
            req.Log(`OCR Frente (DB)`, `Actualizando registro con respuesta de OCR frente`);
            return DB.update({
                estatus: "credencial_frente",
                rfc: ocr?.rfc,
                json_ocr_frente: Utilities.LimitarLogDB(ocr, 2000)
            }, DB.table.REGISTROS, `id=${req.user.id}`)
        })
        .then( updated => {
            req.Log(`OCR Frente (DB)`, `Registro actualizado`);
            res.response("success", "Credencial Procesada", null, 200);
        })
        .catch((err) => {
            req.Log(`OCR Frente (DB) Error`, err.message || err);
            res.response("error", `Error actualizando registro, porfavor intentelo nuevamente `, null, 400);
        });
});

api.post("/ocr_reverso", obtenerRegistro, function(req, res) {
    const base64 = req.body.base64 || "";

    Nufi.INEreverso(base64, req)
        .then( ocr => {
            req.Log(`OCR Reverso (DB)`, `Actualizando registro con respuesta de OCR reverso`);
            return DB.update({
                estatus: "credencial_reverso",
                json_ocr_reverso: Utilities.LimitarLogDB(ocr, 2000)
            }, DB.table.REGISTROS, `id=${req.user.id}`)
        })
        .then( updated => {
            req.Log(`OCR Reverso (DB)`, `Registro actualizado`);
            res.response("success", "Credencial Procesada", null, 200);
        })
        .catch((err) => {
            req.Log(`OCR Reverso (DB) Error`, err.message || err);
            res.response("error", `Error actualizando registro, porfavor intentelo nuevamente `, null, 400);
        });
});

api.post("/datos_personales", obtenerRegistro, function(req, res) {
    const { nombre, apellido_paterno, apellido_materno, fecha_nacimiento, sexo, estado }  = req.body,
        fecha_nacimiento_date = moment(fecha_nacimiento, 'DD/MM/YYYY'),
        sexo_code = Object.keys(CATALOGO_SEXO).find(key => CATALOGO_SEXO[key] === sexo),
        estado_code = Object.keys(CATALOGO_ESTADO).find(key => CATALOGO_ESTADO[key] === estado);

    if(!nombre) return res.response("error", "Campo nombre requerido", null);
    if(!apellido_paterno) return res.response("error", "Campo apellido_paterno requerido", null);
    if(!apellido_materno) return res.response("error", "Campo apellido_materno requerido", null);
    if(!fecha_nacimiento) return res.response("error", "Campo fecha_nacimiento requerido", null);
    if(!sexo) return res.response("error", "Campo sexo requerido", null);
    if(!sexo_code) return res.response("error", "Campo sexo no válido en catálogo", null);
    if(!estado) return res.response("error", "Campo estado requerido", null);
    if(!estado_code) return res.response("error", "Campo estado no válido en catálogo", null);
    if(!fecha_nacimiento_date.isValid()) return res.response("error", "Fecha de nacimiento no válida", null);
    let fecha_string = fecha_nacimiento_date.format("YYYY-MM-DD");

    Nufi.calcularCURP(nombre, apellido_paterno, apellido_materno, fecha_string, sexo_code, estado_code, req)
        .then((curp_data) => {
            return Nufi.calcularRFC(nombre, apellido_paterno, apellido_materno, fecha_string, req)
                .then((rfc_data) => {
                    return [curp_data, rfc_data];
                });
        })
        .then( ([curp_data, rfc_data]) => {
            req.Log(`DB`, `Actualizando registro con id: ${req.user.id}`);
            return DB.update({
                    nombre: nombre,
                    apellido_paterno: apellido_paterno,
                    apellido_materno: apellido_materno,
                    fecha_nacimiento: fecha_string,
                    sexo: sexo,
                    lugar_de_nacimiento: estado,
                    estatus: "curp_rfc",
                    json_curp: Utilities.LimitarLogDB(curp_data, 1000),
                    json_rfc: Utilities.LimitarLogDB(rfc_data, 1000)
                }, DB.table.REGISTROS, `id=${req.user.id}`)
        })
        .then( updated => {
            req.Log(`DB`, `Registro actualizado`);
            res.response("success", "Datos actualizados", null, 200);
        })
        .catch((err) => {
            req.Log(`DB Error`, err.message || err);
            res.response("error", err.message || err, null, 400);
        });
});

api.post("/curp_rfc", obtenerRegistro, curpValido, function(req, res) {
    const { curp, rfc }  = req.body;
    if(!curp) return res.response("error", "Campo curp requerido", null);
    if(!rfc) return res.response("error", "Campo rfc requerido", null);
    
    let curpValido = req.curpValido;

    if(curpValido){
        req.Log(`DB`, `Actualizando registro con id: ${req.user.id}`);
        DB.update({
                curp: curp,
                rfc: rfc,
                estatus: "curp_rfc_validado"
            }, DB.table.REGISTROS, `id=${req.user.id}`)
            .then( updated => {
                req.Log(`DB`, `Registro actualizado`);
                res.response("success", "Datos actualizados", null, 200);
            })
            .catch((err) => {
                req.Log(`DB Error`, err.message || err);
                res.response("error", err.message || err, null, 400);
            });
        }
        else{
            res.response("error", `Curp previamente registrado.`, {curpValido}, 400);
        }
});

api.post("/domicilio", obtenerRegistro, function(req, res) {
    const { calle, numero_exterior, codigo_postal, colonia, municipio, estado, numero_interior}  = req.body;
    
    if(!calle) return res.response("error", "Campo calle requerido", null);
    if(!numero_exterior) return res.response("error", "Campo numero_exterior requerido", null);
    if(!codigo_postal) return res.response("error", "Campo codigo_postal requerido", null);
    if(!colonia) return res.response("error", "Campo colonia requerido", null);
    if(!municipio) return res.response("error", "Campo municipio requerido", null);
    if(!estado) return res.response("error", "Campo estado requerido", null);
    
    req.Log(`DB`, `Actualizando registro con id: ${req.user.id}`);
    DB.update({
            calle: calle,
            numero_exterior: numero_exterior,
            numero_interior: numero_interior,
            codigo_postal: codigo_postal,
            colonia: colonia,
            municipio: municipio,
            estado: estado,
            estatus: "domicilio"
        }, DB.table.REGISTROS, `id=${req.user.id}`)
        .then( updated => {
            req.Log(`DB`, `Registro actualizado`);
            res.response("success", "Datos actualizados", null, 200);
        })
        .catch((err) => {
            req.Log(`DB`, `Error al actualizar registro: ${err.message || err}`);
            res.response("error", err.message || err, null, 400);
        });
});

api.post("/enviar_otp", obtenerRegistro, tieneIntentosRestantes, function(req, res) {

    if(req.intentosPendientes){
        Nufi.enviarOTP(req.user.numero, req)
            .then((otp) => {
                req.Log(`DB`, `Insertar registro ${JSON.stringify(otp)}`);
                return DB.insert({
                        fecha_creacion: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
                        identificador: otp.identificador,
                        registro: req.user.id,
                        numero: req.user.numero,
                        estatus: "sin_verificar"
                    }, DB.table.OTP)
            })
            .then( id => {
                req.Log(`DB`, `Registro insertado con id: ${id}`);
                res.response("success", "OTP enviado", null, 200);
            })
            .catch((err) => {
                req.Log(`DB`, `Error al actualizar registro: ${err.message || err}`);
                res.response("error", err.message || err, null, 400);
            });
    }
    else{
        res.response("error", "Ha pasado el número maximo de intentos(3), intentelo mas tardes", null, 400);
    }
});


api.post("/validar_otp", obtenerRegistro,  function(req, res) {
    const { codigo }  = req.body;
    if(!codigo) return res.response("error", "Campo codigo requerido", null);

    req.Log(`DB`, `Obteniendo registro OTP de usuario: ${req.user.id}`);
    DB.query(`SELECT TOP 1 * FROM ${DB.table.OTP} WHERE registro='${req.user.id}' ORDER BY id DESC`)
        .then((rows) => {
            if(rows.length == 0 ) return Promise.reject("Error registro de verificacion no encontrado");
            const row = rows[0];

            req.Log(`DB`, `Actualizado registro id: ${row.id}`);
            return Nufi.validarOTP(row.identificador, codigo, req)
                .then((otp) => {
                    return DB.update({estatus: "verificado"}, DB.table.OTP, `id='${row.id}'`);
                })
                .then((otp) => {
                    return DB.update({procesoTerminado: 1}, DB.table.REGISTROS, `id='${row.registro}'`);
                });
        })
        .then( updated => {
            req.Log(`DB`, `Registro actualizado`);
            res.response("success", "OTP verificado", null, 200);
        })
        .catch((err) => {
            res.response("error", err.message || err, null, 400);
        });
});

function obtenerRegistro(req, res, next){
    const uuid = req.headers.uuid;

    DB.query(`SELECT id, nombre, apellido_paterno, apellido_materno, fecha_nacimiento, sexo, lugar_de_nacimiento, curp, rfc, numero, correo, calle, colonia, municipio, estado, numero_exterior, numero_interior, estatus, json_ocr_frente, json_curp, json_rfc FROM ${DB.table.REGISTROS} WHERE uuid='${uuid}'`)
        .then((rows) => {
            if(rows.length == 0) return res.response("error", "Error al obtener registro", null, 404);
            req.user = rows[0];
            next();
        })
        .catch((err) => {
            res.response("error", err.message || err, null, 400);
        });
}

function telefonoValido(req, res, next){    

    const numero = req.body.numero || "";

    if(numero === "") res.response("error", "Número no valido" , null, 400);

    DB.query(`SELECT id FROM ${DB.table.REGISTROS} WHERE numero='${numero}' AND ProcesoTerminado = 1`)
        .then((rows) => {
            if(rows.length == 0) req.telefonoValido = true;
            else req.telefonoValido = false;;
            next();
        })
        .catch((err) => {
            res.response("error", err.message || err, null, 400);
        });
}

function curpValido(req, res, next){    

    const { curp, rfc }  = req.body;

    if(curp === "") res.response("error", "curp no valido" , null, 400);

    DB.query(`SELECT id FROM ${DB.table.REGISTROS} WHERE curp='${curp}' AND ProcesoTerminado = 1`)
        .then((rows) => {
            if(rows.length == 0) req.curpValido = true;
            else req.curpValido = false;;
            next();
        })
        .catch((err) => {
            res.response("error", err.message || err, null, 400);
        });
}

function tieneIntentosRestantes(req, res, next){

    DB.query(`SELECT count(id) counted FROM ${DB.table.OTP} WHERE registro='${req.user.id}' `)
        .then((rows) => {
            if(rows[0].counted >= 3) req.intentosPendientes = false;
            else req.intentosPendientes = true;;
            next();
        })
        .catch((err) => {
            res.response("error", err.message || err, null, 400);
        });
}


module.exports = api;