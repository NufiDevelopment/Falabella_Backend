const moment = require("moment"),
    fs = require("fs"),
	async = require("async"),
	{ FormRecognizerClient, AzureKeyCredential, DocumentAnalysisClient } = require("@azure/ai-form-recognizer"),
    { ModelIFETipoC, ModelIFETipoD, ModelINETipoE, ModelINETipoG, ModelReversoTipoC, ModelReversoTipoD, ModelReversoTipoG} = require("../utils/Models"),
	FORM_API_KEY = process.env.FORM_API_KEY,
	FORM_ENDPOINT = process.env.FORM_ENDPOINT,
    PYTHON_PATH = process.env.PYTHON_PATH,
	spawn = require("child_process").spawn,
	Utilities = require("./Utilities"),
    CustomVision = require('../utils/customvision'),
	intersection = require("rectangle-overlap"),
	stringSimilarity = require("string-similarity");

module.exports = {
	ProcesarCredencialFrente: function(file_path_output, req){
		return Promise.resolve()
	        .then(() => this.ProcesarAzureOCR(file_path_output, req))
	        .then((ocr) => {
	            let lines = ocr.lines,
	                Model = (new ModelIFETipoC()).validar(lines, req) || (new ModelIFETipoD()).validar(lines, req) || (new ModelINETipoE()).validar(lines, req) || (new ModelINETipoG()).validar(lines, req);
	            
	            if(!Model) return Promise.reject({message: "Error al reconocer frente de credencial.", code: 503});
	            if(Model.angle == 0) return [ocr, Model];

	            return this.PreProcessorImage(file_path_output, file_path_output, ocr.angle, "", false, req)
	                    .then(() => this.ProcesarAzureOCR(file_path_output, req))
	                    .then((ocr) => {return [ocr, Model]});
	        })
	        .then(([ocr, Model]) => {
	            req.Log(`Revalidando modelo: ${Model.name}`);
	            Model = Model.validar(ocr.lines, req);
	            if(!Model) return Promise.reject({message: "Error al reconocer frente de credencial.", code: 503});
	            return this.AplicarReglasModelo(Model, ocr.lines, req);
	        })
	},
	ProcesarCredencialReverso(file_path_output, req){
		return Promise.resolve()
			.then(() => this.ProcesarAzureOCR(file_path_output, req))
	        .then((ocr) => {
	        	 console.log(ocr);
	            let lines = ocr.lines,
	                Model = (new ModelReversoTipoC()).validar(lines, req) || (new ModelReversoTipoD()).validar(lines, req) || (new ModelReversoTipoG()).validar(lines, req);
	            if(!Model) return Promise.reject({message: "Error al reconocer reverso de credencial", code: 503});
	            return [ocr, Model];
	        })
	        .then(([ocr, Model]) => {
	            return this.AplicarReglasModelo(Model, ocr.lines, req);
	        });
	},
	UploadImagesStorage: function(file_path_input, file_path_output, req){
		return new Promise((resolve, reject) => {
            Utilities.uploadToStorageFromPath(file_path_input, true, req)
                .then((url_input) => {
                    req.url_input = url_input;
                    return Utilities.uploadToStorageFromPath(file_path_output, true, req)
                                .then((url_output) => {
                                    req.url_output = url_output;
                                });
                })
                .catch((err) => {
                    req.Log(`Eror al subir imagenes a storage: ${err.message || err}`);
                })
                .finally(() => {
                    resolve();
                });
        });
	},
	ProcesarAzureOCR: function(path_input, req){
		if(process.env.OCR_SERVICE == "CUSTOM_VISION"){
			return new Promise((resolve, reject) => {
				req.Log(`ProcesarAzureOCR: Inicia modelo > CUSTOM_VISION`);
				Promise.resolve()
		            .then(() => {
		                return new Promise((resolveBuffer, rejectBuffer) => {
		                    fs.readFile(path_input, function (err, data) {
		                        if(!err) return resolveBuffer(data);
		                        req.Log(`Error al obtener buffer: ${err.message || err}`);
		                        return rejectBuffer({message: `Error procesar registro`, code: 501});
		                    });
		                }); 
		            })
		            .then((buffer) => {
		                return CustomVision.Analize(buffer, req);
		            })
		            .then((result) => {
		                let angle = Math.floor((result && result.analyzeResult && result.analyzeResult.readResults && result.analyzeResult.readResults[0] && result.analyzeResult.readResults[0].angle) ? result.analyzeResult.readResults[0].angle : 0);
		                let _lines = result && result.analyzeResult && result.analyzeResult.readResults && result.analyzeResult.readResults[0] && result.analyzeResult.readResults[0].lines ? result.analyzeResult.readResults[0].lines : [];
		                let lines = _lines.map((line) => {
					        	const boundingBox = line.boundingBox;
					            return {
					                text: line.text,
					                left: boundingBox[0],
					                top: boundingBox[1],
					                bottom: boundingBox[7],
					                width: boundingBox[2] - boundingBox[0],
					                height: boundingBox[7] - boundingBox[1]
					            }
					        });

		                req.Log(`Termina ProcesarAzureOCR`);
		                resolve({angle, lines});
		            })
		            .catch((err) => {
		                req.Log(`Catch ProcesarAzureOCR: ${err.message || err}`);
		                reject(err)
		            })
			});
		}else{
			return new Promise( async (resolve, reject) => {
				req.Log(`ProcesarAzureOCR: Inicia modelo > FORM_RECOGNIZER`);
				const readStream = fs.createReadStream(path_input),
				client = new DocumentAnalysisClient(FORM_ENDPOINT, new AzureKeyCredential(FORM_API_KEY)),
				poller = await client.beginAnalyzeDocument("prebuilt-read", readStream, {}),
				forms = await poller.pollUntilDone();

				let angle = Math.floor(forms && form.pages && form.pages[0] && form.pages[0] && form.pages[0].angle || 0),
			        _lines = forms && forms.pages && forms.pages[0] && forms.pages[0].lines || [];
	            	lines = _lines.map((line) => {
			            return {
			                text: line.content,
			                left: line.polygon[0].x,
			                top: line.polygon[0].y,
			                bottom: line.polygon[3].y,
			                width: line.polygon[1].x - line.polygon[0].x,
			                height: line.polygon[3].y - line.polygon[0].y
			            }
			        });
				
				req.Log(`ProcesarAzureOCR: termino`);
	            resolve({angle, lines});
			});
		}
	},
	DrawWords: function(words, path_input, path_output, req){
		return new Promise((resolve, reject) => {
            req.Log(`DrawWords: Inicia`);
            req.Log(`DrawWords path_input: ${path_input}`);
            req.Log(`DrawWords path_output: ${path_output}`);
			Utilities.DrawProcessedRectangles(words, path_input, path_output)
				.then(() => {
            		req.Log(`DrawWords: Termina`);
					resolve("OK");
				})
				.catch((ex) => {
            		req.Log(`DrawWords: Error al dibujar palabras: ${ex.message || ex}`);
					resolve("Error");
				});
		});
	},
	AplicarReglasModelo: function(model, lines, req){
		req.Log(`AplicarReglasModelo -> Inicia procesamiento de reglas de OCR: ${model.name}`);
		let bounding_box_credencial = model.bounding_box_credencial;
		bounding_box_credencial.text = "";
		
        return new Promise((resolve, reject) => {
        	let fields = model.fields,
        		lines_boundingbox = [];

        	req.Log(`AplicarReglasModelo -> Paso 0. Lineas OCR`, lines.map(l => {return l.text}));
    		lines.map( line => {
		    	let r1 = {
			    		width: bounding_box_credencial.width,
	    				height: line.height,
	    				left: bounding_box_credencial.left,
	    				left_word: line.left,
	    				top: line.top,
	    				bottom: line.bottom,
	    				text: line.text,
	    				words: [{left: line.left, text: line.text}]
			    	},
			    	insert = true;

		    	lines_boundingbox.forEach((r2, index) => {
		    		let percent = Utilities.CalculateInsersectionPercent(r1.left, r1.top, r1.width, r1.height, r2.left, r2.top, r2.width, r2.height);
		    		if(percent > 50){
		    			insert = false;
		    			lines_boundingbox[index].words.push({left: line.left, text: line.text}); //`${r2.text} ${r1.text}`;
		    		}
		    	});

		    	if(insert) lines_boundingbox.push(r1);
        	});

    		//Se ordenal las palabras por posición left
    		lines_boundingbox = lines_boundingbox.map((l => {
    			l.text = l.words.sort((a,b) => a.left - b.left).map(l => l.text).join(" ");
    			return l;
    		}))

    		const lines_array = lines_boundingbox.map(l => {return l.text}),
    			texto_ocr = lines_array.join(" ");

        	req.Log(`AplicarReglasModelo -> Paso 1. Crear lineas horizontales de texto que encuadren dentro del bounding_box_credencial`, lines_array);
        	req.Log(`AplicarReglasModelo -> Paso 2. Seleccionar las lineas que coincidan con la propiedad select_line del modelo`);
        	fields = fields.map( field => {
		    	let select_line_text = field && field.select_line ? field.select_line.join(" ") : "";
        		field["line_text"] = Utilities.findBestMatchString(select_line_text, lines_array);
        		req.Log(`AplicarReglasModelo -> Paso 2. ${field.label}: ${field["line_text"]}`);
        		return field;
        	});

        	model.texto = texto_ocr;
    		model.lines = lines_array;    		
    		model.json = {};

        	req.Log(`AplicarReglasModelo -> Paso 3. Se aplican las reglas select.right, select.left y select.between`);
        	fields = fields.map( field => {
        		let select = field.select || {},
        			line_text = field.line_text,
			    	array_text_field = line_text.split(" ");

        		if(select.right){
        			let best_match_text = Utilities.findBestMatchString(select.right, array_text_field) || "",
			    		regex = new RegExp(`^(.*?)(${best_match_text})`);
        			field["value"] = line_text.replace(regex, "").trim();
        		}else if(select.left){
        			let best_match_text = Utilities.findBestMatchString(select.left, array_text_field) || "",
			    		regex = new RegExp(`${best_match_text}.*?$`);
        			field["value"] = line_text.replace(regex, "").trim();
        		}else if(select.between){
			    	let left = Utilities.findBestMatchString(select.between.left, array_text_field),
			    		right = Utilities.findBestMatchString(select.between.right, array_text_field),
			    		regex = new RegExp(`(?<=${left}).*?(?=${right})`);
	        		
	        		field["value"] = Utilities.ApplyExpression(line_text, regex).trim();
        		}else{
	        		field["value"] = field.value || "";
        		}

        		req.Log(`AplicarReglasModelo -> Paso 3. ${field["label"]}: ${field["value"]}`);
        		return field;
        	});

        	req.Log(`AplicarReglasModelo -> Paso 4. Se aplica la regla bounding`);
        	fields = fields.map( field => {
				if(field.bounding){
        			// Bounding box 
					//-------------------------------> +x 
					//|	(bounding.top)		(bounding.reference) => Bounuding que se tomara como referencia para sumar las y_axis_lines 
					//|	     |-------|
					//|	     |-------|
					//|					(bounding.line) => Linea que se toma como area coincidente entre ambos bounding ( 1 linea = y_axis_lines)
					//|					(bounding.y_axis_lines) => Cantidad de lineas que caben entre los bounding (top - bottom)
					//|
					//|	(bounding.bottom)
					//|	     |-------|
					//|	     |-------|
			    	//y

			    	try{
	        			let bounding = field.bounding,
	        				top_bounding = processLabel(bounding.top, lines_array, lines_boundingbox, 0),
	        				y_axis = 0;

	        			if(!top_bounding) throw `Error al reconocer label ${bounding.top}`;

				    	if(bounding.top && bounding.bottom){
		                    let bottom_bounding = processLabel(bounding.bottom, lines_array, lines_boundingbox, 0);
			                y_axis = ((bottom_bounding.top - top_bounding.top) / bounding.y_axis_lines);
				    	}else{
				    		y_axis = top_bounding.height;
				    	}

		               	bounding_result = processLabel(bounding.reference, lines_array, lines_boundingbox, (y_axis * bounding.line));
	        			field["value"] = bounding_result && bounding_result.text ? bounding_result.text : "";
        				req.Log(`AplicarReglasModelo -> Paso 4. ${field["label"]}: ${field["value"]} `);
			    	}catch(ex){
        				req.Log(`AplicarReglasModelo -> Paso 4. ${field["label"]}: Error: ${ex.message ? ex.message : ex}`);
			    	}
        		}
        		return field;
        	});


        	//Apply regex to validate type data
        	req.Log(`AplicarReglasModelo -> Paso 5. Se aplica regex de validación de tipo de dato`);
        	fields = fields.map( field => {
        		let value = typeof field.value == "string" ? field.value.trim() : "";
        			type = field && field.type ? field.type : null;

        		if(type == "numerico")
        			field["value"] = value.replace(/[^0-9\s]/gi, "").trim();
        		else if(type == "alfabetico")
        			field["value"] = value.replace(/[^A-Z\s]/gi, "").trim();
        		else if(type == "alfanumerico")
        			field["value"] = value.replace(/[^A-Z0-9\s]/gi, "").trim();
        		else if(type == "special")
        			field["value"] = value.replace(/[^A-Z0-9\s,.//-]/gi, "").trim();
        		else if(type == "mrz")
        			field["value"] = value.replace(/[^A-Z0-9< ]/gi, "").trim();
        		else
        			field["value"] = value;
        		
        		req.Log(`AplicarReglasModelo -> Paso 5. ${field["label"]} (${type}): ${field["value"]} `);
        		return field;
        	});

        	//Actualiza la variable json dentro del modelo para almacenar el valor calculado y acceder a el desde la function execute_after
	    	fields.map((field, index) => {
	    		model.json[field.label] = field["value"].trim() || "";
	    		field["value"] = field["value"].trim() || "";
	    		return field;
	    	});
        	
        	//Execute custom functions
        	req.Log(`AplicarReglasModelo -> Paso 6. Se aplica ejecución de function: execute`);
        	let execute_functions = [];
        	fields.forEach((field, index) => {
        		field.index = index;
	        	field.model = model;
	        	field.log = [];
        		field.Log = (text) => {
        			field.log.push(text);
        		}
        		if((typeof field.execute) === "function")
        			execute_functions.push(field.execute.bind(field));
        	});

        	async.series(execute_functions, (err, results) => {
        		results.map(field => {
	        		field.value = typeof field.value == "string" ? field.value.trim() : "";
        			fields[field.index] = field;
        			field.log.map((text) => {
    					req.Log(`AplicarReglasModelo -> Paso 6. ${field["label"]}: ${text}`);
        			});
        			req.Log(`AplicarReglasModelo -> Paso 6. ${field["label"]}: ${field["value"]}`);
        		});

        		//Actualiza el valor dentro de la variable json del modelo y asi poder acceder a el desde la function execute_after
		    	fields.map((field, index) => {
		    		model.json[field.label] = field["value"].trim() || "";
		    		field["value"] = field["value"].trim() || "";
		    		return field;
		    	});

		    	//Execute after functions
        		req.Log(`AplicarReglasModelo -> Paso 7. Se aplica ejecución de function: execute_after`);
	        	let execute_after_functions = [];
	        	fields.forEach((field, index) => {
	        		field.index = index;
	        		field.model = model;
	        		field.log = [];
	        		field.Log = (text) => {
	        			field.log.push(text);
	        		}
	        		if((typeof field.execute_after) === "function")
	        			execute_after_functions.push(field.execute_after.bind(field));
	        	});

	        	async.series(execute_after_functions, (err, results) => {
				    results.map(field => {
		        		field.value = typeof field.value == "string" ? field.value.trim() : "";
	        			fields[field.index] = field;
	        			field.log.map((text) => {
        					req.Log(`AplicarReglasModelo -> Paso 7. ${field["label"]}: ${text}`);
	        			});
	        			req.Log(`AplicarReglasModelo -> Paso 7. ${field["label"]}: ${field["value"]}`);
		        	});

        			req.Log(`AplicarReglasModelo -> Paso 8. Se aplica regex de validación de tipo de dato`);
		        	fields = fields.map( field => {
		        		let value = typeof field.value == "string" ? field.value.trim() : "";
		        			type = field && field.type ? field.type : null;

		        		if(type == "numerico")
		        			field["value"] = value.replace(/[^0-9\s]/gi, "").trim();
		        		else if(type == "alfabetico")
		        			field["value"] = value.replace(/[^A-Z\s]/gi, "").trim();
		        		else if(type == "alfanumerico")
		        			field["value"] = value.replace(/[^A-Z0-9\s]/gi, "").trim();
		        		else if(type == "special")
		        			field["value"] = value.replace(/[^A-Z0-9\s,.//]/gi, "").trim();
		        		else if(type == "mrz")
        					field["value"] = value.replace(/[^A-Z0-9< ]/gi, "").trim();

        				req.Log(`AplicarReglasModelo -> Paso 8. ${field["label"]}: ${field["value"]}`);
		        		return field;
		        	});

        			//Actualiza la variable json dentro del modelo para almacenar el valor calculado
			    	fields.map((field, index) => {
			    		model.json[field.label] = field["value"].trim() || "" ;
			    	});

					req.Log(`AplicarReglasModelo: Termina procesamiento...`);
					lines_boundingbox.push(bounding_box_credencial);
				    resolve({json: model.json, bounding: lines_boundingbox});
				});
			});
		});
	},
	PreProcessorImage: function(path_input, path_output, rotation_degrees, crop_area, optimize = false, req){
		let path_script = `${__dirname}/PreProcessor.py`;

		return new Promise((resolve, reject) =>{
			if(!fs.existsSync(path_script)) return reject("Script no existe");
			if(!fs.existsSync(path_input)) return reject("Imagen no existe");
			
			req.Log(`PreProcessorImage: ejecutando script de preprocesamiento de imagen`);
			req.Log(`PreProcessorImage rotation_degrees: ${rotation_degrees}, crop_area: ${crop_area}`);
			let spawn_process = spawn(PYTHON_PATH, [path_script, path_input, path_output, rotation_degrees, optimize, crop_area])
		    
		    spawn_process.stdout.on("data", data =>{
				let data_string = data.toString();
				req.Log(`PreProcessorImage: resultado script preprocesamiento de imagen: ${data_string}`);
				try{
				    let json = JSON.parse(data_string);
				    if(json && json.status == "success") resolve(json);
				    else reject(`Error al preprocesar imagen`);
				}catch(err){
					req.Log(`PreProcessorImage: Error al preprocesar imagen: ${err}`);
			        reject("Error al preprocesar imagen");
				}
		    });

		    spawn_process.stderr.on("data", (err) =>{
				req.Log(`Error al preprocesar imagen: ${err}`);
		        reject("Error al preprocesar imagen");
		    });
		});
	}
}

function processLabel(reference_label, lines_array, lines_boundingbox, y_axis){
	let bestMatch = Utilities.findBestMatch(reference_label, lines_array),
        bounding = lines_boundingbox[bestMatch.index],
        r1 = {
            width: bounding.width,
            height: bounding.height,
            left: bounding.left,
            top: bounding.top + y_axis
        };

    if(!(bestMatch.rating > 0.5)) return null;
    let intersactions = lines_boundingbox.map((r2) => {
    		let width = r1.width,
    			height = r1.height;//Fix same width & height
            r2.percent = Utilities.CalculateInsersectionPercent(r1.left, r1.top, width, height, r2.left, r2.top, width, height);
            return r2;
        }).sort((a, b) => b.percent - a.percent);
    bounding = intersactions[0];
    return bounding && bounding.percent > 50 ? bounding : null;
}