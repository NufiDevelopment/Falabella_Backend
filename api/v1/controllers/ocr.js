const api = require("express").Router(),
    fs = require("fs"),
    path = require('path'),
    moment = require("moment"),
    uuid = require("uuid"),
    DB = require("../utils/DB");
    
api.post("/inbound", function(req, res) {
    const body = req.body.Body || "";
    req.Log(`Estatus del registro: `, req.user.whatsapp_status);
});

module.exports = api;