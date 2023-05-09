const fs = require("fs"),
    path = require("path"),
    moment = require("moment"),
    SAVE_LOG = process.env.SAVE_LOG == "true",
    WRITE_CONSOLE = process.env.WRITE_CONSOLE == "true",
    PATH_LOG = process.env.PATH_LOG,
    logStdout = process.stdout;

function MiddlewareLog(text, peticion_id = null){
  	if(WRITE_CONSOLE) process.stdout.write(`${text}\n`);

    try {
        if(!SAVE_LOG) return;
        if(!fs.existsSync(PATH_LOG)) fs.mkdirSync(PATH_LOG);
        let now = moment(),
        	log_text = `${now.format("DD/MM/YYYY HH:mm:ss.SSS")} ${text}\n`
            file_name = `${PATH_LOG}${peticion_id ? peticion_id + ".log" : now.format("YYYYMMDD")+ "_log.log"}`;
        
        fs.appendFile(file_name, log_text, function(err) {
            if(err) process.stdout.write(`${err}\n`);
        });
    }catch (err) {
        if(WRITE_CONSOLE) process.stdout.write(`${err}\n`);
    }
}

console.error = MiddlewareLog;
console.log = MiddlewareLog;