const request = require('request'),
    moment = require("moment"),
    APP_NAME = process.env.APP_NAME,
    NUFI_API_KEY = process.env.NUFI_API_KEY,
    NUFI_URL = process.env.NUFI_URL,
    OCR_URL = `http://ocrinenufi001.southcentralus.cloudapp.azure.com:3002/api/v1/`;

module.exports = {
	INEfrente: function(base64, req){
		req.Log(`INE Frente`, `Inicia consumo de servicio`);
		return new Promise((resolve, reject) => {
			POST(`${NUFI_URL}ocr/v4/frente`, {base64_credencial_frente: base64})
			    .then( result => {
					req.Log(`INE Frente`, `Respuesta de servicio, estatus: ${result.status || ""}, message: ${result.message}`);
			    	if(result.status == "success") return resolve(result.data);
			        reject("Error al obtener respuesta de servicio, intentelo nuevamente.");
			    })
			    .catch( err => {
					req.Log(`INE Frente Error`, err.messsage || err);
			        reject(err);
			    });
		})
	},
	INEreverso: function(base64, req){
		req.Log(`INE Reverso`, `Inicia consumo de servicio`);
		return new Promise((resolve, reject) => {
			POST(`${NUFI_URL}ocr/v1/reverso`, {base64_credencial_reverso: base64})
			    .then( result => {
					req.Log(`INE Reverso`, `Respuesta de servicio, estatus: ${result.status || ""}, message: ${result.message}`);
			    	if(result.status == "success") return resolve(result.data);
			        reject("Error al obtener respuesta de servicio, intentelo nuevamente.");
			    })
			    .catch( err => {
					req.Log(`INE Reverso Error`, err.messsage || err);
			        reject(err);
			    });
		})
	},
	calcularCURP: function(nombre, primer_apellido, segundo_apellido, fecha_nacimiento, sexo, clave_entidad, req){
		let fecha_nacimiento_date = moment(fecha_nacimiento, "YYYY-MM-DD"),
			data = {
			  	"tipo_busqueda": "datos",
			  	"clave_entidad": clave_entidad,
			  	"anio_nacimiento": fecha_nacimiento_date.format("YYYY"),
			  	"mes_nacimiento": fecha_nacimiento_date.format("MM"),
			  	"dia_nacimiento": fecha_nacimiento_date.format("DD"),
			  	"nombres": nombre,
			  	"primer_apellido": primer_apellido,
			  	"segundo_apellido": segundo_apellido,
			  	"sexo": sexo
			};

		req.Log(`Calcular CURP`, `Inicia consumo de servicio ${JSON.stringify(data)}`);
		return new Promise((resolve, reject) => {
			POST(`${NUFI_URL}curp/v1/consulta`, data)
			    .then( result => {
					req.Log(`Calcular CURP`, `Respuesta de servicio, estatus: ${result.status || ""}, message: ${result.message}`);
			    	if(result.status == "success") return resolve(result.data);
			        reject("Los datos ingresados no son correctos para validar su curp, porfavor ingreselos correctamente.");
			    })
			    .catch( err => {
					req.Log(`Calcular CURP`, err.messsage || err);
			        reject(err);
			    });
		})
	},
	calcularRFC: function(nombre, apellido_paterno, apellido_materno, fecha_nacimiento, req){
		let fecha_nacimiento_date = moment(fecha_nacimiento, "YYYY-MM-DD"),
			data = {
			  	"nombres": nombre,
			  	"apellido_paterno": apellido_paterno,
			  	"apellido_materno": apellido_materno,
			  	"fecha_nacimiento": fecha_nacimiento_date.format("DD/MM/YYYY")
			};

		req.Log(`Calcular RFC`, `Inicia consumo de servicio: ${JSON.stringify(data)}`);
		return new Promise((resolve, reject) => {
			POST(`${NUFI_URL}api/v1/calcular_rfc`, data)
			    .then( result => {
					req.Log(`Calcular RFC`, `Respuesta de servicio, estatus: ${result.status || ""}, message: ${result.message}`);
			    	if(result.status == "success") return resolve(result.data);
			        reject("Los datos ingresados no son correctos para validar su rfc, porfavor ingreselos correctamente.");
			    })
			    .catch( err => {
					req.Log(`Calcular RFC`, err.messsage || err);
			        reject(err);
			    });
		});
	},
	enviarOTP: function(phone, req){
		let data = {
			  	"numero": phone,
			  	"aplicacion": APP_NAME,
			  	"longitud": 6,
			  	"tipo": 6
			};

		req.Log(`Envio OTP`, `Inicia consumo de servicio ${JSON.stringify(data)}`);
		return new Promise((resolve, reject) => {
			POST(`${NUFI_URL}otp/v2/enviar`, data)
			    .then( result => {
					req.Log(`Envio OTP`, `Respuesta de servicio, estatus: ${result.status || ""}, message: ${result.message}`);
			    	if(result.status == "success") return resolve(result.data);
			        reject(`Error al enviar verificación OTP: ${result.message}`);
			    })
			    .catch( err => {
					req.Log(`Envio OTP`, err.messsage || err);
			        reject(err);
			    });
		});
	},
	validarOTP: function(identificador, codigo, req){
		let data = {
			  codigo: codigo,
			  identificador: identificador
			};

		req.Log(`Validar OTP`, `Inicia consumo de servicio ${JSON.stringify(data)}`);
		return new Promise((resolve, reject) => {
			POST(`${NUFI_URL}otp/v2/validar`, data)
			    .then( result => {
					req.Log(`Validar OTP`, `Respuesta de servicio, estatus: ${result.status || ""}, message: ${result.message}`);
			    	if(result.status == "success") return resolve(result.data);
			        reject(`Error al validar OTP: ${result.message}`);
			    })
			    .catch( err => {
					req.Log(`Validar OTP`, err.messsage || err);
			        reject(err);
			    });
		});
	},
}


function POST(url, body){
    return new Promise((resolve, reject) => {
        request({
            url: url,
            method: 'POST',
            json: body,
            headers:{
                'Content-Type': 'application/json',
                'Ocp-Apim-Subscription-Key': NUFI_API_KEY,
                'NUFI-API-KEY': NUFI_API_KEY
            }
        }, (error, response, body) => {
        	if(!body) return reject("Error al obtener respuesta de servicio");
        	//if(body.status != "success") return reject("Error al obtener respuesta de servicio");
        	resolve(body);
        });
    });
}