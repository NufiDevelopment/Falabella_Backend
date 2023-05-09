const request = require('request').defaults({ encoding: null }),
	fs = require("fs"),
	path = require("path");

module.exports = {
	LimitarLogDB: function(json, max = 100){
		let result = RecursiveObject(json, max);
		return typeof result == "object" ? JSON.stringify(result) : result;
	}
}

function RecursiveObject(obj, max){
	if(typeof obj == "string") return obj.length >= max ? obj.substring(0, max) + "...." : obj.substring(0, max);
	if(typeof obj == "object"){
		for (var k in obj)
			if (typeof obj[k] == "object" && obj[k] !== null)
		    	obj[k] = RecursiveObject(obj[k], max);
		return obj;
	}
	return null;
}