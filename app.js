const config = require("./config"),
    express = require("express"),
    app = express(),
    fs = require("fs"),
    bodyParser = require("body-parser"),
    cors = require("cors"),
    helmet = require('helmet');

app.use(helmet());
app.use(helmet.frameguard({ action: 'deny' }));
app.disable('x-powered-by');
app.use(cors());
app.use(express.json({limit: '15mb'}));
app.use(express.urlencoded({limit: '15mb', extended: true }));
app.use(bodyParser.urlencoded({ limit: "15mb", extended: true}));
app.use(bodyParser.json({ limit: "15mb" }));
app.use('/uploads', express.static('uploads'));

app.get("/", function(req, res) {
    res.send(`API ${process.env.APP_NAME}`);
});

/****************** API **********************/
var api = require("./api/router.js");
app.use("/api", api);

app.listen(process.env.PORT, function() {
    console.log("Servidor escuchando en el puerto: " + process.env.PORT);
});