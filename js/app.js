
/***********variables globales********/
var mapajsRuta, mapajsTopo, mapajsGPS, mapajsDiario;
var geoJSONformat = new ol.format.GeoJSON();
var vectorSourceGPS = new ol.source.Vector();
var vectorSourceRuta = new ol.source.Vector();
var vectorSourceDiario = new ol.source.Vector();
var dias = null;
var hermandades = [];
hermandades.getByField = function (field, value) {
	for (i = 0; i < this.length; i++) { //forEach no interrumpe con return
		if (this[i][field] && this[i][field] != null &&
			this[i][field].toString().toUpperCase() === value.toString().toUpperCase()) return this[i];
	}
	return null;
};
hermandades.add = function (h) {
	this.push.apply(this, h);
};
//AYESA REQ6 Mejoras de sistema de avisos
/**
 * Indica si existen avisos pendientes de leer
 */
var hasPendingWarnings = false;
/**
 * Timestamp de la última actualización realizada
 */
var lastUpdateTimestampReceived = 0;
//END AYESA REQ6 Mejoras de sistema de avisos
/*************************************/

function getInfo(url, filtro, showLoading) {
	showLoading = showLoading !== undefined ? showLoading : true;
	showLoading && $.mobile.loading().show();
	if (filtro === undefined) filtro = {};
	filtro.apikey = apikey;
	return $.ajax({
		dataType: "jsonp",
		url: url,
		timeout: timeout * 1000,
		data: filtro
	}).then(function (data, textStatus, jqXHR) {
		if (data.error) {
			data.peticion = $(this)[0].url;
			return $.Deferred().reject(data);
		} else {
			return data;
		}
	}).fail(function (e) {
		//Captura de error genérica para todas las llamadas
		//console.error(e.peticion, e.error);
		if (e.statusText) { //ES UN ERROR NO CONTROLADO
			showDialog(errInesperado, 'ERROR INESPERADO', 'error');
		}
	}).always(function () {
		$.mobile.loading().hide();
	});
}

function cargarHermandades() {
	return getInfo(getHermandades).done(function (data) {
		hermandades.add(data.hermandades);
		$.each(hermandades, function (i, hermandad) {
			option = $("<option value=" + hermandad.codigo_hermandad + ">" + hermandad.nombre + "</option>");
			$("#dropHermandadCamino").append(option);
			if (hermandad.gps) {
				$("#dropHermandadGps").append(option.clone());
			}
		});
		cargarCamino($("#dropHermandadCamino").val());
	}).fail(function (e) {
		showError(e.error);;
	});
}

function cargarHermandadesRuta() {
	return getInfo(getHermandades, {
		"ruta": true
	}).done(function (data) {
		$.each(data.hermandades, function (i, hermandad) {
			option = $("<option value=" + hermandad.codigo_hermandad + ">" + hermandad.nombre + "</option>");
			$("#dropHermandadRuta").append(option);
		});
		cargarFechasHermandad($("#dropHermandadRuta").val());
	}).fail(function (e) {
		showError(e.error);;
	});
}

function cargarPasos() {
	return getInfo(getPasos).done(function (data) {
		pasos = data.pasos;
		$.each(pasos, function (i, paso) {
			option = $("<option value=" + paso.codigo_toponimo + ">" + paso.nombre_toponimo + "</option>");
			$("#dropPasos").append(option);
		});
		cargarDiasPaso($("#dropPasos").val()).done(function (data) {
			cargarHoras($("#dropPasos").val(), $("#dropDiasPaso").val());
		});
	}).fail(function (e) {
		showError(e.error);;
	});
}

function cargarCamino(idHermandad) {
	listCamino = $("#listCamino");
	return getInfo(getCamino + idHermandad).done(function (data) {
		listCamino.empty();
		$("#msjCamino").hide();
		$.each(data.pasos, function (i, paso) {
			ul = listCamino.find("#" + paso.codigo_fecha);
			if (ul.length == 1) {
				ul = $(ul[0]);
			} else {
				div = $("<div data-role='collapsible'><h1>" + paso.dia_semana + "</h1></div>");
				ul = $("<ul data-role='listview' id='" + paso.codigo_fecha + "'></ul>");
				div.append(ul);
			}
			texto_fecha = paso.texto_fecha.match(/\d{1,2}:\d{1,2}/);
			topoNombre = texto_fecha.input.substr(0, texto_fecha.index).trim();
			toponimo = {
				"topoX": paso.x,
				"topoY": paso.y,
				"topoNombre": topoNombre.replace('Paso', 'Paso por') + " (" + texto_fecha + ")",
				"topoHermandad": $("#dropHermandadCamino option:selected").text()
			};

			// li = $("<li><a href='javascript:$.mobile.changePage(\"#toponimo\"," + JSON.stringify(toponimo) + ")'>" + topoNombre.replace('Paso', 'Paso por') + "</a><p class='ui-li-aside'><strong>" + texto_fecha[0] + "</strong></p></li>");
			li = $("<li>" + topoNombre.replace('Paso', 'Paso por') + "<p class='ui-li-aside'><strong> Horario previsto: " + texto_fecha[0] + "</strong></p></li>");
			ul.append(li);
			listCamino.append(div);
		});
	}).fail(function (e) {
		listCamino.empty();
		$("#msjCamino").html(e.error.mensaje).show();
	});
}

function cargarDiario(idDia) {
	//JGL: no puedo usar las hermandades ya consultadas poque la respuesta no tiene los días de paso.
	return getInfo(getHermandades, {
		"codigo_fecha": idDia
	}).done(function (data) {
		listDiario = $("#listDiario");
		listDiario.empty();

		$.each(data.hermandades, function (i, hermandad) {
			gps = hermandad.nombre_largo.indexOf('(GPS)');
			if (gps > 0) {
				li = $("<li><a href='javascript:pintarMovimientoDiario(" + JSON.stringify(hermandad) + "," + idDia + ")' class='ui-btn ui-btn-icon-right ui-icon-eye'>" + hermandad.nombre_largo.substr(0, gps).trim() + "</a></li>");
				li.append("<p class='ui-li-aside'>GPS</p>");
			} else {
				li = $("<li><a href='javascript:pintarMovimientoDiario(" + JSON.stringify(hermandad) + "," + idDia + ")' class='ui-btn ui-btn-icon-right ui-icon-eye'>" + hermandad.nombre_largo + "</a></li>");
			}
			listDiario.append(li);
		});
	}).fail(function (e) {
		showError(e.error);;
	});
}

function cargarHoras(idPaso, idDia) {
	return getInfo(getHoras, {
		"codigo_toponimo": idPaso,
		"codigo_fecha": idDia
	}).done(function (data) {
		listHoras = $("#listHoras");
		listHoras.empty();
		$.each(data.hora_hermandad, function (i, horaPaso) {
			li = $("<li>" + horaPaso.nombre + "</li>");
			li.append("<p class='ui-li-aside'>" + horaPaso.hora + "</p>");
			listHoras.append(li);
		});
	}).fail(function (e) {
		showError(e.error);;
	});
}

function cargarDiasPaso(idPaso) {
	return getInfo(getFechasPaso + idPaso).done(function (data) {
		$("#dropDiasPaso").empty();
		$.each(data.dias_semana_paso, function (i, dia) {
			option = $("<option value=" + dia.codigo_fecha + ">" + dia.dia_semana + "</option>");
			$("#dropDiasPaso").append(option);
		});
	}).fail(function (e) {
		showError(e.error);
	});
}

function cargarDias() {
	return getInfo(getDias).done(function (data) {
		dias = data.dias_semana;
		$.each(dias, function (i, dia) {
			option = $("<option value=" + dia.codigo_fecha + ">" + dia.dia_semana + "</option>");
			$("#dropDiaDiario").append(option);
		});
		cargarDiario($("#dropDiaDiario").val());
	}).fail(function (e) {
		showError(e.error);;
	});
}

function cargarFechasHermandad(idHermandad) {
	return getInfo(getDias + idHermandad).done(function (data) {

		$("#dropDiaRuta").empty();
		opCompleta = $("<option value='completa'>Completa</option>");
		opIda = $("<option value='ida'>Ida</option>");
		opVuelta = $("<option value='vuelta'>Vuelta</option>");
		$("#dropDiaRuta").append(opCompleta);

		dias = data.dias_semana;

		ida = false;
		vuelta = false;
		$.each(dias, function (i, dia) {
			if (dia.dia_semana.toUpperCase().indexOf('IDA') > 0) ida = true;
			if (dia.dia_semana.toUpperCase().indexOf('VUELTA') > 0) vuelta = true;
			option = $("<option value=" + dia.codigo_fecha + ">" + dia.dia_semana + "</option>");
			$("#dropDiaRuta").append(option);
		});

		if (vuelta) $("#dropDiaRuta option:first").after(opVuelta);
		if (ida) $("#dropDiaRuta option:first").after(opIda);
	}).fail(function (e) {
		showError(e.error);;
	});
}

//AYESA 2020 REQ2 VIDEOS
/**
 * Obtiene del servidor el listado de vídeos y actualiza la sección audiovisuales con el contenido de los mismos
 */
function cargarVideos() {
	return getInfo(getVideos).done(function (data) {

		let pageVids = $("#audiovisual .ui-content");
		
		pageVids.empty();
		if(data.videos!=null &&  data.videos.length>0){
			$(".menu-item-audiovisual").css("display", "block");
			let videos = data.videos.sort((a, b) => {
				
					return b.nOrden - a.nOrden	
		
			});

		
		$.each(videos, function (i,video) {
			
			
			let domDoc = $("<a>").addClass("ui-btn div-row-video");
			//domDoc.attr('href', `javascript:showVideo('${video.urlVideo.replace("https://www.youtube.com/watch?v=","")}')`);
			domDoc.attr('href', `javascript:openUrlExternal('${video.urlVideo}');`);
			//domDoc.attr('href', `javascript:loadVideoPlayer('${video.urlVideo}', \'_self\');`);
			
			let divTitle =  $("<div>").addClass("div-title-video");
			let divImage =  $("<div>").addClass("div-image-video");
			let domTitle =  $("<p>").addClass("p-title-video");
			let playImage =  $("<img>").addClass("img-play-video");
			playImage.attr('src', "img/play_button.png");
			domTitle.text(video.titulo);
			divTitle.append(domTitle);
			let domImg =  $("<img>").addClass("img-video");
			if(video.urlImagen != null && video.urlImagen != "")
			{
				domImg.attr('src', video.urlImagen);
			}else{
				domImg.attr('src', "img/default_video_image.jpg");
			}
			divImage.append(playImage);
			divImage.append(domImg);
			domDoc.append(divImage);
			domDoc.append(divTitle);
			pageVids.append(domDoc);
		});
	}else{
		let domDoc = $("<div>").addClass("no-content-message");
		domDoc.text(noContent);
		pageVids.append(domDoc);
		$(".menu-item-audiovisual").css("display", "none");
	}
	}).fail(function (e) {
		showError(e.error);
		$(".menu-item-audiovisual").css("display", "none");
	});
}

//Comentado, dejado por si se usa en web
/**
 * Crea un overlay con un reproductor de video y reproduce el video
 * @param {*} url 
 */
// function loadVideoPlayer(url){
// 	let divVideoPlayer= '<video class="video-player" width="320" height="240" controls="" autoplay="" name="media"><source src="' + url + '" type="video/mp4"></video>';
// 	let pageVids = $("#audiovisual .ui-content");
// 	let overlay =  $("<div>").addClass("div-overlay");
// 	overlay.append(divVideoPlayer);
// 	overlay.click(function (){
// 		overlay.remove();
// 	});
// 	pageVids.prepend(overlay);

// }

//Comentado para futuros usos, habilitar tb en config.xml
/**
 * Muestra los vídeos en youtube si está actualizada la app y sino los abre en el navegador
 * @param {*} videoId Identificador del vídeo (No url completa, sólo el Id)
 */
// function showVideo(videoId){
// 	try {
// 		//Este método no funciona con CLI sólo con APK generado
// 		YoutubeVideoPlayer.openVideo(videoId, function(result) { 
// 			//Result se devuelve despues de volver de la aplicación de youtube, no es util de momento pero dejo el callback planteado para el futuro
			
// 		}); 
//       } catch(e) {
// 		  showDialog(errVideoPlayer, "ERROR", "error");
//       }
// }
//END AYESA 2020 REQ2

function pintarRuta(hermandad, dia) {
	if (mapajsRuta === undefined) {
		mapajsRuta = M.map({
			controls: ["location", "scale", "layerswitcher"],
			container: "mapRuta",
			wmcfiles: ['romero_mapa', 'romero_satelite']
		});
		// mapajsRuta.on(M.evt.COMPLETED, function() { //M.evt.COMPLETED no está select
		// 	window.setTimeout(function(){
		// 		//$(".m-wmcselector-select").unbind("change");//no funciona
		// 	  //clono y reemplazo para eliminar todos los eventos
		// 	  var wmcSel = $(".m-wmcselector-select")[0],
		// 				wmcSelClone = wmcSel.cloneNode(true);
		// 	  wmcSel.parentNode.replaceChild(wmcSelClone, wmcSel);
		// 		wmcSelClone.addEventListener('change', function(e) {
		// 					 e.preventDefault(); //no funciona
		// 					 var selectedWMCLayer = mapajsRuta.getWMC($(this).find("option:selected").text())[0];
		// 	         selectedWMCLayer.select();
		// 	  })}, 1000);
		// });
		lyRuta = getLayerRuta(vectorSourceRuta);
		lyGPS = getLayerGPS();
		mapajsRuta.getMapImpl().addLayer(lyRuta);
		mapajsRuta.getMapImpl().addLayer(lyGPS);


	} else {}

	filtro = {};
	if ($.isNumeric(dia)) filtro.codigo_fecha = dia;

	getInfo(getRutas + hermandad, filtro).done(function (data) {
		vectorSourceRuta.clear();

		features = geoJSONformat.readFeatures(data);
		if (!$.isNumeric(dia)) {
			features = $.grep(features, function (f) {
				return (dia == 'completa' || f.get('sentido') == dia);
			});
		}
		if (features.length > 0) {
			vectorSourceRuta.addFeatures(features);
			//JGL: cálculo de ángulo
			/*vectorSourceRuta.forEachFeature(function (f){
				start = f.getGeometry().getFirstCoordinate();
				end = f.getGeometry().getLastCoordinate();
				angulo = Math.abs(Math.atan2(end[1] - start[1], end[0] - start[0])* 180 / Math.PI);
				//rad = Math.atan2(end[1] - start[1], end[0] - start[0]);
				//angulo = 270-(rad*180/Math.PI); //más preciso ¿por?
				f.set('angulo', angulo);
			});*/

			mapajsRuta.setBbox(vectorSourceRuta.getExtent());
		} else {
			//JGL: no debería ocurrir
			showDialog('El trayecto seleccionado no tiene elementos', 'INFORMACIÓN', 'warning');
		}
	}).fail(function (e) {
		showError(e.error);;
	});
}

function getLayerRuta(vectorSource) {
	return new ol.layer.Vector({
		source: vectorSource,
		zIndex: 99999999,
		name: 'Ruta',
		style: function (feature, resolution) {
			return [new ol.style.Style({
				stroke: new ol.style.Stroke({
				color: '#84fffc',
				width: 8,
				lineCap: 'butt'
				})
				/*,
								text: new ol.style.Text({
									text: feature.get('codigoTramo'),
									rotation: feature.get('angulo'), //si se usa, descomentar el cáculo
									font: 'bold 11px arial',
									fill: new ol.style.Fill({color: "#000"}),
									stroke: new ol.style.Stroke({
										color: "#ffffff",
										width: 3
									})
								})*/

				/*,geometry: function(feature) {
						// return the coordinates of the first ring of the polygon
						var coordinates = feature.getGeometry().getCoordinates()[0];
						console.log(coordinates);
					}*/
			}),
				new ol.style.Style({
				stroke: new ol.style.Stroke({
				color: feature.get('color'),
				width: 4
			})})];
		}
	});
}

function pintarMovimientoDiario(hermandad, dia, jornada) {
	jornada = jornada !== undefined ? jornada : 0;
	var jsonPois = {
		"type": "FeatureCollection",
		"crs": {
			"type": "name",
			"properties": {
				"name": "urn:ogc:def:crs:EPSG:25830"
			}
		},
		"features": []
	};
	//if (mapajsDiario===undefined){
	(mapajsDiario && mapajsDiario.destroy());
	mapajsDiario = M.map({
		controls: ["location", "scale", "layerswitcher"],
		container: "mapDiario",
		wmcfiles: ['romero_mapa', 'romero_satelite']
	});
	//}else{
	//	mapajsDiario.removeLayers(mapajsDiario.getLayers());

	//}

	lyRuta = getLayerRuta(vectorSourceDiario);
	lyGPS = getLayerGPS();
	mapajsDiario.getMapImpl().addLayer(lyRuta);
	mapajsDiario.getMapImpl().addLayer(lyGPS);
	getInfo(getCamino + hermandad.codigo_hermandad, {
		"codigo_fecha": dia
	}).done(function (data) {
		$.each(data.pasos, function (i, paso) {
			texto_fecha = paso.texto_fecha.match(/\d{1,2}:\d{1,2}/);
			topoNombre = texto_fecha.input.substr(0, texto_fecha.index).trim();
			fPoi = {
				"type": "Feature",
				"geometry": {
					"type": "Point",
					"coordinates": [paso.x, paso.y]
				},
				"properties": {
					"nombre": topoNombre,
					"hora de paso": texto_fecha[0]
				}
			};
			jsonPois.features.push(fPoi);
		});
		lyPois = new M.layer.GeoJSON({
			name: 'Información',
			source: JSON.stringify(jsonPois)
		}, {
			hide: attrNotShow
		});

		mapajsDiario.addLayers(lyPois);
		lyPois.setZIndex(99999999);
		lyPois.getImpl().getOL3Layer().setStyle(poiStyle)
	}).fail(function (e) {
		console.error(e);
	});

	//en este caso el dia siempre es numérico
	getInfo(getRutas + hermandad.codigo_hermandad, {
		"codigo_fecha": dia
	}).done(function (data) {
		vectorSourceDiario.clear();
		features = geoJSONformat.readFeatures(data);
		if (features.length > 0) {
			$("#mapaDiario .subheader").text(hermandad.nombre + " - " + $("#dropDiaDiario option:selected").text());
			vectorSourceDiario.addFeatures(features);
			$.mobile.changePage('#mapaDiario');
		} else {
			//JGL: no debería ocurrir
			showDialog('El trayecto seleccionado no tiene elementos', 'INFORMACIÓN', 'warning');
		}
	}).fail(function (e) {
		showError(e.error);;
	});
}

function pintarToponimo(data) {

	if (mapajsTopo === undefined) {

		mapajsTopo = M.map({
			controls: ["location", "scale", "layerswitcher"],
			zoom: zoomToPoint,
			center: data.topoX + "," + data.topoY + "*true",
			container: "mapToponimo",
			wmcfiles: ['romero_mapa', 'romero_satelite']
		});
		mapajsTopo.getImpl().getDrawLayer().getOL3Layer().setStyle(poiStyle);
	} else {
		mapajsTopo.setCenter(data.topoX + "," + data.topoY + "*true").setZoom(zoomToPoint);
	}
	lyGPS = getLayerGPS();
	mapajsTopo.getMapImpl().addLayer(lyGPS);
	$("#toponimo .ui-title").text(data.topoNombre);
	$("#toponimo .subheader").text(data.topoHermandad);
}

function updateLastPos() {
	filtro = {
		"emp": "grea"
	};
	return getInfo(getGPS, filtro, false).done(function (data) {
		vectorSourceGPS.clear();
		vectorSourceGPS.addFeatures(geoJSONformat.readFeatures(data, {
			featureProjection: 'EPSG:25830'
		}));
		
		if (vectorSourceGPS.getFeatures().length > 0) {
			vectorSourceGPS.forEachFeature(function (f) {
				h = hermandades.getByField('etiqueta_gps', f.get('name'));
				if (h != null) {
					f.set('color', h.color);
					h.lastPos = f.getGeometry().getCoordinates();
				} else {
					f.set('color', "#000");
				}
			});
		}
	}).fail(function (e) {
		showError(e.error);;
	});
}
//AYESA REQ6 Mejoras de sistema de avisos
/**
 * guarda de manera persistente timestamp con última actualización 
 * @param {*} lastUpdateTimestamp 
 */
function saveLastUpdate(lastUpdateTimestamp){
	localStorage.setItem('lastUpdateWarnings', lastUpdateTimestamp);
}
/**
 * Comprueba si es necesario actualizar la app indicando que hay avisos pendientes
 * @param {*} lastUpdateServerTimestamp 
 */
function needToUpdatePendingWarnings(lastUpdateServerTimestamp){
	let lastUpdate = localStorage.getItem('lastUpdateWarnings');
	if(lastUpdate != null && lastUpdateServerTimestamp <= lastUpdate)
	{
		return false;
	}else{
		return true;
	}
}

/**
 * Procesa la actualización de avisos recibida, y actualiza el UI si es necesario
 * @param {*} lastUpdateServerTimestamp 
 */
function processWarningsUpdate(lastUpdateServerTimestamp){
	
	if(needToUpdatePendingWarnings(lastUpdateServerTimestamp)  || hasPendingWarnings == true)
	{
		hasPendingWarnings = true;
		$('#alert-avisos').text(pendingWarningsText);
		lastUpdateTimestampReceived = lastUpdateServerTimestamp;
		
	}


}
/**
 * Limpia la lista de avisos 
 */
function clearPendingWarnings(){
		saveLastUpdate(lastUpdateTimestampReceived);
		hasPendingWarnings = false;
		$('#alert-avisos').text(noPendingWarningsText);
}

//END AYESA REQ6 Mejoras de sistema de avisos

function updateAvisos() {
	filtro = {
		tiempo: 0
	};
	return getInfo(getAvisos, filtro, false).done(function (data) {
		
		//AYESA REQ6 Mejoras de sistema de avisos
		let lastUpdateServerTimestamp = data.lastUpdate;
		if(lastUpdateServerTimestamp != null){
			processWarningsUpdate(lastUpdateServerTimestamp);
		}

		let avisos = data.avisos.sort((a, b) => {
			
			if(a.prioridad != b.prioridad){
			return a.prioridad - b.prioridad
			}else{
				let fechaA = a.fecha.substr(6, 4)+a.fecha.substr(3,2)+a.fecha.substr(0,2)+a.hora.substr(0,2)+a.hora.substr(3,2);
				let fechaB = b.fecha.substr(6, 4)+b.fecha.substr(3,2)+b.fecha.substr(0,2)+b.hora.substr(0,2)+b.hora.substr(3,2);
				return fechaA.parseInt() - fechaB.parseInt()	
			}
		});
		//END AYESA 2020 REQ6
		let avisoHome = $("#home > div.ui-content > a.lista-avisos");
		avisos.length > 0 ? avisoHome.css("display", "block") : avisoHome.hide();
		let page = $("#avisos > div.ui-content");
		page.empty();
		for (let i = 0; i < avisos.length; i++) {
			const aviso = avisos[i];
			if (i === 0) avisoHome.addClass(getClassAviso(aviso.prioridad)); //el primero, ya que están ordenados por prioridad
			let divAviso = $("<div/>", {
				"class": "lista-avisos"
			});
			//AYESA 2020 REQ2
			let titAviso = $("<h4/>");
			let fechaAviso =  $("<p/>");
			let descAviso = $("<p/>");
			titAviso.addClass("titulo-aviso");
			fechaAviso.addClass("fecha-aviso");
			let divTituloAviso = $("<div/>");
			divTituloAviso.addClass('div-titulo-aviso');
			titAviso.text(aviso.titulo);
			fechaAviso.text(aviso.fecha);
			descAviso.text(aviso.descripcion);

			divTituloAviso.append(fechaAviso).append(titAviso);
			
			divAviso.append(divTituloAviso).append(descAviso);
			
			if(aviso.urlEnlace != null && aviso.tituloEnlace != null){
				let enlaceAviso = $("<a/>");
				enlaceAviso.attr('href', `javascript:openUrlExternal('${aviso.urlEnlace}');`);
				enlaceAviso.text(aviso.tituloEnlace);
				divAviso.append(enlaceAviso);
			} 
			//END AYESA 2020 REQ2
			divAviso.addClass(getClassAviso(aviso.prioridad));
			page.append(divAviso);
		}
	}).fail(function (e) {
		console.log(e.error.mensaje);
	});
}

function getClassAviso(prioridad) {
	switch (prioridad) {
		case 1:
			return "severity-high";
		case 2:
			return "severity-mid";
		case 3:
			return "severity-low";
		default:
			return "";
	}
}

function pintarGPS(hermandad) {
	if (hermandad != null) { //por si se quiere sólo pintar una hermandad
		features = vectorSourceGPS.getFeatures();
		vectorSourceGPS.clear();
		$.grep(features, function (f) {
			h = hermandades.getByField('etiqueta_gps', f.get('name'));
			return (h.codigo_hermandad === hermandad);
		});
		vectorSourceGPS.addFeatures(features);
	}
	bbox = vectorSourceGPS.getFeatures().length > 0 ? vectorSourceGPS.getExtent() : bboxContext;

	if (mapajsGPS === undefined) {
		mapajsGPS = M.map({
			controls: ["location", "scale", "layerswitcher"],
			container: "mapGPS",
			bbox: bbox[0] + "," + bbox[1] + "," + bbox[2] + "," + bbox[3],
			wmcfiles: ['romero_mapa', 'romero_satelite']
		});

		lyGPS = getLayerGPS()
		mapajsGPS.getMapImpl().addLayer(lyGPS);
	}
}

function getLayerGPS() {
	//TODO: estudiar una única instancia
	return new ol.layer.Vector({
		source: vectorSourceGPS,
		zIndex: 99999999,
		name: 'GPS',
		style: function (feature, resolution) {
			return [new ol.style.Style({
				image: new ol.style.Circle({
					radius: 5,
					fill: new ol.style.Fill({
						color: feature.get('color')
					}),
					stroke: new ol.style.Stroke({
						color: "#000",
						width: 1
					})
				}),
				text: new ol.style.Text({
					text: feature.get('name') + "\n\r" + formatDate(new Date(feature.get('ts'))),
					font: 'bold 9px arial',
					offsetY: -18,
					fill: new ol.style.Fill({
						color: "#000"
					}),
					stroke: new ol.style.Stroke({
						color: "#ffffff",
						width: 3
					})
				})
			})];
		}
	});
}

function bindEvents() {
	$(document).on("pagechange", function (e, data) {
		if ($.type(data.toPage) == "object") {
			switch (data.toPage[0].id) {
				case 'ruta':
					pintarRuta($("#dropHermandadRuta").val(), $("#dropDiaRuta").val());
					mapajsRuta.getMapImpl().updateSize();
					//AYESA 2020 REQ5 CAmbio mensaje error GPS
					if (vectorSourceGPS.getFeatures().length <= 0) showDialog(noGPS, 'AVISO', 'error');
					//END AYESA 2020 REQ5 CAmbio mensaje error GPS
					break;
				case 'toponimo':
					let coordsGeo = transformar([data.options.topoX, data.options.topoY]);
					let geolink = getGeoLink(coordsGeo, data.options.topoNombre);
					$("#iralli a").attr("onclick", `javascript:openUrlExternal('${geolink}');`);
					pintarToponimo(data.options);
					mapajsTopo.getMapImpl().updateSize();
					//AYESA 2020 REQ5 CAmbio mensaje error GPS
					if (vectorSourceGPS.getFeatures().length <= 0) showDialog(noGPS, 'AVISO', 'error');
					//END AYESA 2020 REQ5 CAmbio mensaje error GPS
					break;
				case 'mapaDiario':
					mapajsDiario.setBbox(vectorSourceDiario.getExtent());
					mapajsDiario.getMapImpl().updateSize();
					//AYESA 2020 REQ5 CAmbio mensaje error GPS
					if (vectorSourceGPS.getFeatures().length <= 0) showDialog(noGPS, 'AVISO', 'error');
					//END AYESA 2020 REQ5 CAmbio mensaje error GPS
					break;
					//AYESA 2020 REQ2 Videos
				//AYESA 2020 REQ6 Mejora sistema avisos
				case 'home':
					updateAvisos();
					break;
				//END AYESA 2020 REQ6 Mejora sistema avisos
				//AYESA 2020 REQ2 VIDEOS
				case 'docs':
					cargarVideos();
					break;
					//END AYESA 2020 REQ2 VIDEOS
					//AYESA 2020 REQ6 Mejorar sistema de avisos
				case 'avisos':
					clearPendingWarnings();
					break;
					//END AYESA 2020 REQ6 Mejorar sistema de avisos
				case 'gps':
					updateLastPos().done(function () {
						//AYESA 2020 REQ3C llévame en localización en vivo
						if(vectorSourceGPS != null && vectorSourceGPS.getFeatures() != null && vectorSourceGPS.getFeatures().length > 0 )
						{
						let coords = vectorSourceGPS.getFeatures()["0"].getGeometry().getCoordinates();
						let coordsGeo = transformar([coords[0], coords[1]]);
						let geolink = getGeoLink(coordsGeo, data.options.topoNombre);
						$("#iralli a").attr("onclick", `javascript:openUrlExternal('${geolink}');`);
						}
						//END AYESA 2020 REQ3C llévame en localización en vivo
						
						pintarGPS();
						
						//JGL: si sólo se quiere pintar la hermandad seleccionada
						//pintarGPS($("#dropHermandadGps").val());
						mapajsGPS.getMapImpl().updateSize();
						//AYESA 2020 REQ5 CAmbio mensaje error GPS
						if (vectorSourceGPS.getFeatures().length <= 0) showDialog(noGPS, 'AVISO', 'error');
						//END AYESA 2020 REQ5 CAmbio mensaje error GPS
					});
					break;
				default:
					break;
			}
		}
	});

	$("#dropHermandadCamino").on("change", function () {
		cargarCamino($(this).val()).done(function () {
			$("#listCamino").collapsibleset().trigger("create");
		});
	});
	$("#dropDiaDiario").on("change", function () {
		cargarDiario($(this).val()).done(function () {
			$("#listDiario").listview("refresh");
		});
	});
	$("#dropPasos").on("change", function () {
		cargarDiasPaso($(this).val()).done(
			function () {
				$("#dropDiasPaso").selectmenu("refresh");
				cargarHoras($("#dropPasos").val(), $("#dropDiasPaso").val()).done(function () {
					$("#listHoras").listview("refresh");
				});
			});
	});
	$("#dropDiasPaso").on("change", function () {
		cargarHoras($("#dropPasos").val(), $("#dropDiasPaso").val()).done(
			function () {
				$("#listHoras").listview("refresh");
			});
	});
	$("#dropHermandadRuta").on("change", function () {
		cargarFechasHermandad($("#dropHermandadRuta").val()).done(function () {
			$("#dropDiaRuta").selectmenu("refresh");
			pintarRuta($("#dropHermandadRuta").val(), $("#dropDiaRuta").val());
		});
	});
	$("#dropDiaRuta").on("change", function () {
		pintarRuta($("#dropHermandadRuta").val(), $("#dropDiaRuta").val());
	});
	$("#dropHermandadGps").on("change", function () {
		//pintarGPS($(this).val()); //JGL: para sólo pintar la hermandad
		if ($(this).val() != 0) {
			h = hermandades.getByField('codigo_hermandad', $(this).val());
			if (h != null && h.lastPos) {
				mapajsGPS.setCenter(h.lastPos[0] + "," + h.lastPos[1]).setZoom(zoomToPoint);
			} else {
				showDialog(noPosicion, "AVISO", "error");
			}
		} else {
			if (vectorSourceGPS.getFeatures().length > 0) {
				mapajsGPS.setBbox(vectorSourceGPS.getExtent());
			} else {
				showDialog(noGPS, 'AVISO', 'error');
			}
		}
	});
}

function openUrlExternal(url) {
	if (window.isApp) {
		//_system abre siempre en la misma pestaña del navegador 
		// para evitar que se abra multiples veces lo mismo.
		// Cambiar a _blank si se quieren abrir multiples pestañas.
		cordova.InAppBrowser.open(url, '_system');
	} else
		window.open(url);

}

//AYESA 2020 REQ11 Boton Atras 

// $(document).ready(function () {
// 	if (window.isApp) {
// 		document.addEventListener("deviceready", onDeviceReady, false);
// 	} else {
// 		onDeviceReady();
// 	}
// });


$(document).ready(function () {
	if (window.isApp) {
		document.addEventListener("deviceready", onDeviceReady, false);
		document.addEventListener('backbutton', function (evt) {
			switch ($.mobile.activePage.attr('id')) {
				case 'avisos':
				case 'diario':
				case 'horas':
				case 'mapaOcupados':
				case 'docs':
				//case 'hermandad':
				case 'ruta':
				case 'camino':
				case 'gps':
					$.mobile.changePage('#home');
					break;
				case 'toponimo':
					backToponimo();
					break;
				case 'mapaDiario':
					$.mobile.changePage('#diario');
					break;
				case 'audiovisual':
					$.mobile.changePage('#docs');
					break;
				default:
					navigator.app.exitApp();
					break;
			}
		}, false);
	} else {
		onDeviceReady();
	}
});
//END REQ 11 AYESA 2020
function onDeviceReady() {
	//JGL: actualización dinámica
	updateLastPos().always(function () {
		window.setInterval(updateLastPos, updateGPS * 1000);
	});
	//AYESA 2020 REQ6 Mejora sistema avisos
	// updateAvisos().always(function () {
	// 	window.setInterval(updateAvisos, intervalAvisos * 1000);
	// });
	//La primera vez que entra en la app se tiene que ejecutar la actualización de avisos, el resto al navegar a home
	updateAvisos();
	//END AYESA 2020 REQ6 Mejora sistema avisos 
	$.when.apply($, [cargarDias(),
		cargarHermandades(),
		cargarPasos(),
		cargarHermandadesRuta()
	]).always(function () {
		//JGL: oculto splash cuando se han cargado todos los datos básicos o ha dado error
		if (window.isApp) {
			setTimeout(function () {
				navigator.splashscreen.hide();
			}, 2000);
		}
	});
	generarDocs();
	bindEvents();
};

function generarDocs() {
	let pageDocs = $("#docs .ui-content")
	docsPDF.forEach(doc => {
		let domDoc = $("<a>").addClass("ui-btn ui-icon-arrow-d ui-btn-icon-right");
		domDoc.attr('href', `javascript:openUrlExternal('${doc.url}')`);
		domDoc.text(doc.nombre);
		pageDocs.append(domDoc);
	});

//AYESA 2020 REQ2 Material audiovisual

let domDoc = $("<a>").addClass("ui-btn ui-icon-arrow-d ui-btn-icon-right menu-item-audiovisual");
		domDoc.attr('href', `#audiovisual`);
		domDoc.text("Material audivisual");
		pageDocs.append(domDoc);
//END AYESA 2020 REQ2 Material audiovisual		
}

function showDialog(message, title, severity) {
	if (message && message != null && message != '') {
		M.dialog.show(message, title, severity, document.body).then(function (html) {
			var okButton = $(this).find('div.m-button > button');
			$(okButton).on("click", function () {
				if (!window.iOS && title.toUpperCase().indexOf('INESPERADO') > -1) {
					navigator.app.exitApp();
				} else {
					dialog.remove();
				}
			});
		});
	}
};

function showInfo() {
	showDialog(htmlAcercade, 'Acerca de', 'info');
}

function showError(e) {
	errTxt = errMsg[errCode.indexOf(e.codigo)] || e.mensaje;
	showDialog(errTxt, 'ERROR', 'error');
}

function transformar(arrCoords) {
	var epsg4326 = proj4.defs('EPSG:4326');
	var epsg25830 = proj4.defs('EPSG:25830');
	coordTrans = proj4(epsg25830, epsg4326, arrCoords);
	return coordTrans[1] + "," + coordTrans[0];
}

function getGeoLink(coords, label) {
	if (window.isApp) {
		if (window.iOS)
			return `maps://?ll=${coords}&q=${label}`;
		else
			return `geo:${coords}?q=${coords}(${label})`;
	} else
		return `http://maps.google.com?q=${coords}`;
}