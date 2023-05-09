const express = require("express"),
    api = express.Router({ mergeParams: true }),
    v1 = require("./v1/router");

api.get("/", function(req, res) {
  	res.send(`API ${process.env.APP_NAME} ${process.env.VERSION}`);
});

api.use("/v1", v1);

module.exports = api;
