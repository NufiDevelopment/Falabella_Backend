require('dotenv').config();

/*********** SERVER *************/
process.env.PORT = process.env.PORT || 4000;
process.env.BASE_DIR = __dirname;

/************ LOG ******************/
process.env.WRITE_CONSOLE = "true";
process.env.SAVE_LOG = "true";
process.env.PATH_LOG = __dirname + "/logs/";



