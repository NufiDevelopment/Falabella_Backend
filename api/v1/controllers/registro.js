const api = require("express").Router(),
    fs = require("fs"),
    moment = require("moment"),
    {v1: uuidv1 } = require('uuid'),
    DB = require("../utils/DB"),
    Nufi = require("../utils/Nufi"),
    Utilities = require("../utils/Utilities");
    
api.post("/crear", function(req, res) {
    const numero = req.body.numero || "",
        correo = req.body.correo || "",
        uuid = uuidv1();

    DB.insert({
            uuid: uuid,
            fecha_creacion: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
            numero: numero,
            correo: correo,
            estatus: "registrado"
        }, DB.table.REGISTROS)
        .then((id) => {
            res.response("success", "Registro insertado", {uuid}, 200);
        })
        .catch((err) => {
            res.response("error", err.message || err, null, 400);
        });
});

api.post("/evento", obtenerRegistro, function(req, res) {
    const evento = req.body.evento,
        identificador = req.body.identificador;

    if(!evento) return res.response("error", "Campo evento requerido", null);
    if(!identificador) return res.response("error", "Campo identificador requerido", null);

    DB.insert({
            fecha_creacion: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
            registro: req.user.id,
            evento: evento,
            identificador: identificador
        }, DB.table.LOGS)
        .then((id) => {
            res.response("success", "Evento insertado", {id}, 200);
        })
        .catch((err) => {
            res.response("error", err.message || err, null, 400);
        });
});

api.get("/estatus", obtenerRegistro, function(req, res) {
    res.response("success", "Registro obtenido", req.user);
});

api.post("/ocr_frente", obtenerRegistro, function(req, res) {
    const base64 = req.body.base64 || "";

    Nufi.INEfrente(base64)
        .then( ocr => {
            return DB.update({
                estatus: "credencial_frente",
                rfc: ocr?.rfc,
                json_ocr_frente: Utilities.LimitarLogDB(ocr, 2000)
            }, DB.table.REGISTROS, `id=${req.user.id}`)
        })
        .then( updated => {
            res.response("success", "Credencial Procesada", null, 200);
        })
        .catch((err) => {
            res.response("error", err.message || err, null, 400);
        });
});

api.post("/ocr_reverso", obtenerRegistro, function(req, res) {
    const base64 = req.body.base64 || "";

    Nufi.INEreverso(base64)
        .then( ocr => {
            return DB.update({
                estatus: "credencial_reverso",
                json_ocr_reverso: Utilities.LimitarLogDB(ocr, 2000)
            }, DB.table.REGISTROS, `id=${req.user.id}`)
        })
        .then( updated => {
            res.response("success", "Credencial Procesada", null, 200);
        })
        .catch((err) => {
            res.response("error", err.message || err, null, 400);
        });
});

api.post("/datos_personales", obtenerRegistro, function(req, res) {
    const { nombre, apellido_paterno, apellido_materno, fecha_nacimiento, sexo, estado }  = req.body,
        fecha_nacimiento_date = moment(fecha_nacimiento, 'DD/MM/YYYY');

    if(!nombre) return res.response("error", "Campo nombre requerido", null);
    if(!apellido_paterno) return res.response("error", "Campo apellido_paterno requerido", null);
    if(!apellido_materno) return res.response("error", "Campo apellido_materno requerido", null);
    if(!fecha_nacimiento) return res.response("error", "Campo fecha_nacimiento requerido", null);
    if(!sexo) return res.response("error", "Campo sexo requerido", null);
    if(!estado) return res.response("error", "Campo estado requerido", null);
    if(!fecha_nacimiento_date.isValid()) return res.response("error", "Fecha de nacimiento no válida", null);

    let fecha_string = fecha_nacimiento_date.format("YYYY-MM-DD");

    Nufi.calcularCURP(nombre, apellido_paterno, apellido_materno, fecha_string, sexo, estado)
        .then((curp_data) => {
            return Nufi.calcularRFC(nombre, apellido_paterno, apellido_materno, fecha_string)
                .then((rfc_data) => {
                    return [curp_data, rfc_data];
                });
        })
        .then( ([curp_data, rfc_data]) => {
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
            res.response("success", "Datos actualizados", null, 200);
        })
        .catch((err) => {
            res.response("error", err.message || err, null, 400);
        });
});


api.post("/curp_rfc", obtenerRegistro, function(req, res) {
    const { curp, rfc }  = req.body;
    if(!curp) return res.response("error", "Campo curp requerido", null);
    if(!rfc) return res.response("error", "Campo rfc requerido", null);
    
    DB.update({
            curp: curp,
            rfc: rfc,
            estatus: "curp_rfc_validado"
        }, DB.table.REGISTROS, `id=${req.user.id}`)
        .then( updated => {
            res.response("success", "Datos actualizados", null, 200);
        })
        .catch((err) => {
            res.response("error", err.message || err, null, 400);
        });
});

api.post("/domicilio", obtenerRegistro, function(req, res) {
    const { calle, numero_exterior, codigo_postal, colonia, municipio, estado, numero_interior}  = req.body;
    
    if(!calle) return res.response("error", "Campo calle requerido", null);
    if(!numero_exterior) return res.response("error", "Campo numero_exterior requerido", null);
    if(!codigo_postal) return res.response("error", "Campo codigo_postal requerido", null);
    if(!colonia) return res.response("error", "Campo colonia requerido", null);
    if(!municipio) return res.response("error", "Campo municipio requerido", null);
    if(!estado) return res.response("error", "Campo estado requerido", null);
        
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
            res.response("success", "Datos actualizados", null, 200);
        })
        .catch((err) => {
            res.response("error", err.message || err, null, 400);
        });
});

api.post("/enviar_otp", obtenerRegistro, function(req, res) {
    Nufi.enviarOTP(req.user.numero)
        .then((otp) => {
            return DB.insert({
                    fecha_creacion: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
                    identificador: otp.identificador,
                    registro: req.user.id,
                    numero: req.user.numero,
                    estatus: "sin_verificar"
                }, DB.table.OTP)
        })
        .then( inserted => {
            res.response("success", "OTP enviado", null, 200);
        })
        .catch((err) => {
            res.response("error", err.message || err, null, 400);
        });
});


api.post("/validar_otp", obtenerRegistro, function(req, res) {
    const { codigo }  = req.body;
    if(!codigo) return res.response("error", "Campo codigo requerido", null);

    DB.query(`SELECT TOP 1 * FROM ${DB.table.OTP} WHERE registro='${req.user.id}' ORDER BY id DESC`)
        .then((rows) => {
            if(rows.length == 0 ) return Promise.reject("Error registro de verificacion no encontrado");
            const row = rows[0];

            return Nufi.validarOTP(row.identificador, codigo)
                .then((result) => {
                    return DB.update({
                            estatus: "verificado"
                        }, DB.table.OTP, `id='${row.id}'`)
                });
        })
        .then( updated => {
            res.response("success", "OTP verificado", null, 200);
        })
        .catch((err) => {
            res.response("error", err.message || err, null, 400);
        });
});

function obtenerRegistro(req, res, next){
    const uuid = req.headers.uuid;

    DB.query(`SELECT id, nombre, apellido_paterno, apellido_materno, fecha_nacimiento, sexo, lugar_de_nacimiento, curp, rfc, numero, correo, estatus, json_ocr_frente, json_curp, json_rfc FROM ${DB.table.REGISTROS} WHERE uuid='${uuid}'`)
        .then((rows) => {
            if(rows.length == 0) return res.response("error", "Error al obtener registro", null, 404);
            req.user = rows[0];
            next();
        })
        .catch((err) => {
            res.response("error", err.message || err, null, 400);
        });
}

module.exports = api;