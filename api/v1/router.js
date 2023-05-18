const express = require("express"),
    fs = require('fs'),
    moment = require("moment"),
  	api = express.Router({ mergeParams: true }),
    {v1: uuidv1 } = require('uuid'),
    Utilities = require("./utils/Utilities"),
    DB = require("./utils/DB"),
    registro = require("./controllers/registro");

api.all("*", function(req, res, next) {
    req.request_time = moment().utc();
    req.request_id = req.request_time.format("YYYYMMDDHHmmss") + "_"+ uuidv1();
    req.log = [];
    req.Log = (text, object = "") => {
        req.log.push(`${moment().format("DD/MM/YYYY HH:mm:ss:SSS")} ${text}${typeof object == "object" ? " > " + JSON.stringify(object) : (object ? " > " + object : "")}`);
        //console.log(`${moment().format("DD/MM/YYYY HH:mm:ss:SSS")} ${text}${typeof object == "object" ? " > " + JSON.stringify(object) : (object ? " > " + object : "")}`);
        //fs.appendFileSync('log.txt', `${moment().format("DD/MM/YYYY HH:mm:ss:SSS")} ${text}${object ? " > " + JSON.stringify(object) : ""}\n`);
        return null; //Importante
    }

    res.response = (status, message, data = {}, code = 0) => {
        let response_time = moment().utc(),
            duration = moment.duration(response_time.diff(req.request_time)).asSeconds(),
            response = {status, message, data, code};

        req.Log(`Tiempo de procesamiento: ${duration} s`);

        Promise.resolve()
            .then(() => {
                if (!req.id_log) return Promise.resolve();
                return DB.update({
                    log: Utilities.LimitarLogDB(req.log, 1000),
                    response_datetime: response_time.format("YYYY-MM-DD HH:mm:ss"),
                    response_time: duration,
                    code: code,
                    status: status,
                    response: Utilities.LimitarLogDB(response, 1000),
                    message: Utilities.LimitarLogDB(message, 230)
                }, DB.table.LOGS_API, `id=${req.id_log}`)
                .catch(err => { return console.log(err)});
            })
            .finally(() => {
                res.json(response);
                res.end();
            });
    };
    
    DB.insert({
        request_datetime: req.request_time.format("YYYY-MM-DD HH:mm:ss"),
        request_id: req.request_id,
        request: Utilities.LimitarLogDB(req.body, 1000)
    }, DB.table.LOGS_API)
    .then((id_log) => {
        req.Log(`Id log: ${id_log}`);
        req.id_log = id_log;
        next();
    })
    .catch((err) => {
        req.Log(`Error al insertar log registro log: ${err.message || err}`);
        res.response("error", "Error al recibir petición", null, 400);
    });
});

api.get("/", function(req, res) {
    res.send(`API ${process.env.APP_NAME} ${process.env.VERSION}`);
});

api.use("/registro", registro);

module.exports = api;
