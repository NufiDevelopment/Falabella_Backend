const request = require('request'),
    moment = require("moment"),
    NUFI_URL = process.env.NUFI_URL,
    APP_NAME = process.env.APP_NAME,
    NUFI_API_KEY = process.env.NUFI_API_KEY;

module.exports = {
	INEfrente: function(base64){
		return new Promise((resolve, reject) => {
			POST(`ocr/v1/frente`, {base64_credencial_frente: base64})
			    .then( result => {
			    	if(result.status == "success") return resolve(result.data);
			        reject("Error al obtener respuesta de servicio, intentelo nuevamente.");
			    })
			    .catch( err => {
			        reject(err);
			    });
		})
	},
	INEreverso: function(base64){
		return new Promise((resolve, reject) => {
			POST(`ocr/v1/reverso`, {base64_credencial_reverso: base64})
			    .then( result => {
			    	if(result.status == "success") return resolve(result.data);
			        reject("Error al obtener respuesta de servicio, intentelo nuevamente.");
			    })
			    .catch( err => {
			        reject(err);
			    });
		})
	},
	calcularCURP: function(nombre, primer_apellido, segundo_apellido, fecha_nacimiento, sexo, clave_entidad){
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

		return new Promise((resolve, reject) => {
			POST(`curp/v1/consulta`, data)
			    .then( result => {
			    	if(result.status == "success") return resolve(result.data);
			        reject("Los datos ingresados no son correctos para validar su curp, porfavor ingreselos correctamente.");
			    })
			    .catch( err => {
			        reject(err);
			    });
		})
	},
	calcularRFC: function(nombre, apellido_paterno, apellido_materno, fecha_nacimiento){
		let fecha_nacimiento_date = moment(fecha_nacimiento, "YYYY-MM-DD"),
			data = {
			  	"nombres": nombre,
			  	"apellido_paterno": apellido_paterno,
			  	"apellido_materno": apellido_materno,
			  	"fecha_nacimiento": fecha_nacimiento_date.format("DD/MM/YYYY")
			};

		return new Promise((resolve, reject) => {
			POST(`api/v1/calcular_rfc`, data)
			    .then( result => {
			    	if(result.status == "success") return resolve(result.data);
			        reject("Los datos ingresados no son correctos para validar su rfc, porfavor ingreselos correctamente.");
			    })
			    .catch( err => {
			        reject(err);
			    });
		});
	},
	enviarOTP: function(phone){
		let data = {
			  	"numero": phone,
			  	"aplicacion": APP_NAME,
			  	"longitud": 6,
			  	"tipo": 6
			};

		//Eliminar
		return  Promise.resolve({"identificador": "4d6a6a302c9646c8b4eafb8b7769b119"});
		return new Promise((resolve, reject) => {
			POST(`otp/v2/enviar`, data)
			    .then( result => {
			    	if(result.status == "success") return resolve(result.data);
			        reject(`Error al enviar verificación OTP: ${result.message}`);
			    })
			    .catch( err => {
			        reject(err);
			    });
		});
	},
	validarOTP: function(identificador, codigo){
		let data = {
			  codigo: codigo,
			  identificador: identificador
			};

		//Eliminar
		return  Promise.resolve({"evento": "13000001575CDE3B", "precio": "0.05000000", "moneda": "EUR"});
		return new Promise((resolve, reject) => {
			POST(`otp/v2/validar`, data)
			    .then( result => {
			    	if(result.status == "success") return resolve(result.data);
			        reject(`Error al validar OTP: ${result.message}`);
			    })
			    .catch( err => {
			        reject(err);
			    });
		});
	},
}


function POST(endpoint, body){
	const url = `${NUFI_URL}${endpoint}`;

    return new Promise((resolve, reject) => {
        request({
            url: url,
            method: 'POST',
            json: body,
            headers:{
                'Content-Type': 'application/json',
                'Ocp-Apim-Subscription-Key': NUFI_API_KEY,
            }
        }, (error, response, body) => {
        	if(!body) return reject("Error al obtener respuesta de servicio");
        	//if(body.status != "success") return reject("Error al obtener respuesta de servicio");
        	resolve(body);
        });
    });
}