var BD_solicitudes;
var BD_aprobaciones;
var year;
var id_solicitud_pendiente;
var array_usuarios;
var solicitud_solicitante;
var solicitud_aprobador;
var solicitud_desde;
var solicitud_hasta;
var solicitud_solicitante_nombre;
var solicitud_tipo_solicitud;
var solicitud_dias_solicitados;

const eventDic = {
    "vacation": "Vacaciones",
    "personal-day": "Dia Personal",
    "birthday": "Dia de Cumpleaños",
    "enfermedad": "Enfermedad",
    "medio-dia": "Medio dia",
    "nacimiento_adopcion_padre": "Nacimiento y/o adopción (padre)",
    "licencia_maternidad_madre": "Licencia de maternidad",
    "licencia_adopcion_madre": "Liciencia adopción (madre)",
    "fallecimiento_familiar": "Fallecimiento Familiar",
    "permiso": "Permiso sin goce sueldo",
    "enfermedad": "Enfermedad"
}

async function obtener_recursos() {
    var params = {
        TableName: "NAVE_Reporte_Usuarios_Web"
    };
    var response = await docClient.scan(params).promise();
    console.log(response);

    let data = [];

    await response.Items.forEach(async function(itemdata) {
        data.push(itemdata);
    });
    while (typeof response.LastEvaluatedKey != "undefined"){
        params.ExclusiveStartKey = response.LastEvaluatedKey;
        response = await docClient.scan(params).promise();
        await response.Items.forEach(async function(itemdata) {
            data.push(itemdata);
        });
    }

    array_usuarios = data;

    if (data.length === 0){
        return;
    }

    for (let i = 0; i < data.length; i++) {
        let insert_select = `<option value="${data[i].correo}">${data[i].nombre} ${data[i].apellido}</option>`;
        await $("#recurso").append(insert_select);
    }

    return;
}

async function obtener_solicitudes() {
    var params = {
        TableName: "NAVE_Vacaciones",
        FilterExpression: "#correo_solicitante = :correo_solicitante",
        ExpressionAttributeNames: {
            "#correo_solicitante":"correo_solicitante"
        },
        ExpressionAttributeValues: {
            ":correo_solicitante": localStorage.getItem('correo')
        }
    };
    var response = await docClient.scan(params).promise();
    console.log(response);

    let data = [];

    await response.Items.forEach(async function(itemdata) {
        data.push(itemdata);
    });
    while (typeof response.LastEvaluatedKey != "undefined"){
        params.ExclusiveStartKey = response.LastEvaluatedKey;
        response = await docClient.scan(params).promise();
        await response.Items.forEach(async function(itemdata) {
            data.push(itemdata);
        });
    }

    if (data.length === 0){
        return document.getElementById("text-solicitudes").innerHTML = "No hay registro de solicitudes de vacaciones";
    }

    BD_solicitudes = data;

    //Build Tabulator
    new Tabulator("#table-solicitudes", {
        data: BD_solicitudes,
        layout:"fitColumns",
        pagination:"local",
        paginationSize: 10,
        paginationSizeSelector:[3, 6, 8, 10, 25, 50],
        movableColumns:true,
        paginationCounter:"rows",
        columns:[
            {title:"ID", field:"id", formatter:"textarea", width:110, headerFilter:"input"},
            {title:"Solicitante", field:"solicitante", formatter:"textarea", width:240, headerFilter:"input"},
            // {title:"Correo Solicitante", field:"correo_solicitante", formatter:"textarea", width:260, headerFilter:"input"},
            {title:"Días Solicitados", field:"dias_solicitados", formatter:"textarea", width:140, headerFilter:"input"},
            {title:"Desde", field:"desde", formatter:"textarea", width:140, headerFilter:"input"},
            {title:"Hasta", field:"hasta", formatter:"textarea", width:140, headerFilter:"input"},
            {title:"Solicitud", field:"tipo_solicitud", formatter:"textarea", width:140, headerFilter:"input", formatter:function(cell, formatterParams){
                let value = cell.getValue();
                return "<p>"+ eventDic[value] +"</p>";
            }},
            {title:"Descripción", field:"descripcion", formatter:"textarea", width:200, headerFilter:"input"},
            {title:"Aprobador", field:"aprobador", formatter:"textarea", width:260, headerFilter:"input"},
            {title:"Estatus", field:"estatus", formatter:"textarea", width:180, headerFilter:"input"},
            {title:"Cancelar", formatter:"textarea", width:180, headerFilter:"input", formatter:function(cell, formatterParams){
                return "<a class='info-recurso'>Cancelar Solicitud</a>";
            },cellClick:async function(e, cell){
                let data = cell.getRow().getData();
                console.log(data);
                if (data.correo_solicitante !== localStorage.getItem('correo')){
                    return alert("No puedes cancelar esta solicitud, solo el solicitador puede hacerlo");
                }
                if (data.estatus === "Rechazado") {
                    return alert("Las vacaciones rechazadas ya no pueden cancelarse");
                }

                //Revisar si ya se disfruto el día
                let fechaActual = new Date().toLocaleDateString("es-MX", {// Obtener la fecha actual en la zona horaria de Monterrey, México
                    timeZone: "America/Monterrey",
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                });
                // Convertir ambas fechas a objetos Date para comparación
                let [dia, mes, año] = fechaActual.split("/");
                let fechaActualISO = new Date(`${año}-${mes}-${dia}`);
                let fechaConstISO = new Date(data.hasta);
                // Comparar fechas
                let yaPaso = fechaActualISO > fechaConstISO;
                if (yaPaso === true){
                    return alert("Los días ya disfrutados no pueden cancelarse");
                }

                id_solicitud_pendiente = data.id;
                solicitud_solicitante = data.correo_solicitante;
                solicitud_aprobador = data.aprobador;
                solicitud_desde = data.desde;
                solicitud_hasta = data.hasta;
                solicitud_solicitante_nombre = data.solicitante;
                solicitud_tipo_solicitud = data.tipo_solicitud;
                solicitud_dias_solicitados = data.dias_solicitados;

                $('#modal_cancelar').modal({
                    backdrop: 'static',
                    keyboard: false
                });
                $('#modal_cancelar').modal('show');
            
                return;
            }},
        ],
    });

    return;
}

// async function buscar_solicitudes() {
//     const correo_solicitante = document.getElementById("recurso").value;

//     if (correo_solicitante === "Todos"){
//         return obtener_solicitudes();
//     }

//     var params = {
//         TableName: "NAVE_Vacaciones",
//         FilterExpression: "(#correo_solicitante = :correo_solicitante)",
//         ExpressionAttributeNames: {
//             "#correo_solicitante":"correo_solicitante"
//         },
//         ExpressionAttributeValues: {
//             ":correo_solicitante": correo_solicitante
//         }
//     };
//     var response = await docClient.scan(params).promise();
//     console.log(response);

//     let data = [];

//     await response.Items.forEach(async function(itemdata) {
//         data.push(itemdata);
//     });
//     while (typeof response.LastEvaluatedKey != "undefined"){
//         params.ExclusiveStartKey = response.LastEvaluatedKey;
//         response = await docClient.scan(params).promise();
//         await response.Items.forEach(async function(itemdata) {
//             data.push(itemdata);
//         });
//     }

//     if (data.length === 0){
//         return alert("No se encontró información con los datos del filtro");
//     }

//     BD = data;

//     //Build Tabulator
//     new Tabulator("#table-solicitudes", {
//         data: BD,
//         layout:"fitColumns",
//         pagination:"local",
//         paginationSize: 3,
//         paginationSizeSelector:[3, 6, 8, 10],
//         movableColumns:true,
//         paginationCounter:"rows",
//         columns:[
//             {title:"ID", field:"id", formatter:"textarea", width:110, headerFilter:"input"},
//             {title:"Solicitante", field:"solicitante", formatter:"textarea", width:240, headerFilter:"input"},
//             {title:"Correo Solicitante", field:"correo_solicitante", formatter:"textarea", width:260, headerFilter:"input"},
//             {title:"Días Solicitados", field:"dias_solicitados", formatter:"textarea", width:140, headerFilter:"input"},
//             {title:"Desde", field:"desde", formatter:"textarea", width:140, headerFilter:"input"},
//             {title:"Hasta", field:"hasta", formatter:"textarea", width:140, headerFilter:"input"},
//             {title:"Solicitud", field:"tipo_solicitud", formatter:"textarea", width:140, headerFilter:"input"},
//             {title:"Descripción", field:"descripcion", formatter:"textarea", width:200, headerFilter:"input"},
//             {title:"Aprobador", field:"aprobador", formatter:"textarea", width:260, headerFilter:"input"},
//             {title:"Estatus", field:"estatus", formatter:"textarea", width:180, headerFilter:"input", formatter:function(cell, formatterParams){
//                 let value = cell.getValue();
//                 return "<p>"+ value +"</p>" + "<a class='info-recurso'>Aprobar Solicitud</a>";
//             },cellClick:async function(e, cell){
//                 let data = cell.getRow().getData();
//                 console.log(data);
//                 if (data.aprobador !== localStorage.getItem('correo')){
//                     return alert("No eres el aprobador para esta solicitud");
//                 }
//                 document.getElementById("solicitante").value = data.solicitante;
//                 document.getElementById("tipo").value = data.tipo_solicitud;
//                 document.getElementById("dias_solicitados").value = data.dias_solicitados;
//                 document.getElementById("desde").value = data["desde"];
//                 document.getElementById("hasta").value = data["hasta"];

//                 id_solicitud_pendiente = data.id;

//                 $('#modal_aprobacion').modal({
//                     backdrop: 'static',
//                     keyboard: false
//                 });
//                 $('#modal_aprobacion').modal('show');
            
//                 return;
//             }},
//             {title:"Cancelar", formatter:"textarea", width:180, headerFilter:"input", formatter:function(cell, formatterParams){
//                 return "<a class='info-recurso'>Cancelar Solicitud</a>";
//             },cellClick:async function(e, cell){
//                 let data = cell.getRow().getData();
//                 console.log(data);
//                 if (data.correo_solicitante !== localStorage.getItem('correo')){
//                     return alert("No puedes cancelar esta solicitud, solo el solicitador puede hacerlo");
//                 }

//                 id_solicitud_pendiente = data.id;

//                 $('#modal_cancelar').modal({
//                     backdrop: 'static',
//                     keyboard: false
//                 });
//                 $('#modal_cancelar').modal('show');
            
//                 return;
//             }},
//         ],
//     });

//     return;

// }

async function cancelar_solicitud(){
    const params = {
        TableName: "NAVE_Vacaciones",
        Key: {
            "id": id_solicitud_pendiente
        },
        ExpressionAttributeValues: {
            ":var1": "Cancelado"
        },
        UpdateExpression: "SET estatus = :var1"
    };
    await docClient.update(params).promise();

    var modal = $('#modal_cancelar');
    modal.modal('hide');

    // Envio del Correo al Solicitante
    const payload_lambda = {
        "email_to": solicitud_solicitante,
        "body": `Se cancelo una solicitud de tipo: "${solicitud_tipo_solicitud}" por parte de ${solicitud_solicitante_nombre} 
            Días Solicitados: ${solicitud_dias_solicitados.toString()}, 
            Desde: ${solicitud_desde} 
            Hasta: ${solicitud_hasta}` ,
        "subject": `Cancelación Solicitud ${solicitud_tipo_solicitud} de ${solicitud_solicitante_nombre}`

    };
    // Envio del Correo al Aprobador
    const payload_lambda_aprobador = {
        "email_to": solicitud_aprobador,
        "body": `Se cancelo una solicitud de tipo: "${solicitud_tipo_solicitud}" por parte de ${solicitud_solicitante_nombre} 
            Días Solicitados: ${solicitud_dias_solicitados.toString()}, 
            Desde: ${solicitud_desde} 
            Hasta: ${solicitud_hasta}` ,
        "subject": `Cancelación Solicitud ${solicitud_tipo_solicitud} de ${solicitud_solicitante_nombre}`
    };
    const params_lambda = {
        FunctionName: 'Send_Email',
        InvocationType: 'Event', //RequestResponse or Event
        LogType: 'Tail',
        Payload: JSON.stringify(payload_lambda)
    };
    const params_lambda_aprobador = {
        FunctionName: 'Send_Email',
        InvocationType: 'Event', //RequestResponse or Event
        LogType: 'Tail',
        Payload: JSON.stringify(payload_lambda_aprobador)
    };
    await lambda.invoke(params_lambda).promise();
    await lambda.invoke(params_lambda_aprobador).promise();

    await obtener_solicitudes();

    return;
}

async function mostrar_conteo() {
    $('#modal_conteo').modal({
        backdrop: 'static',
        keyboard: false
    });
    $('#modal_conteo').modal('show');

    return;
}

async function obtener_saldo() {
    const payload_lambda = {
        "correo": localStorage.getItem('correo'),
    };
    const params_lambda = {
        FunctionName: 'Obtener_Saldos_Beneficios',
        InvocationType: 'RequestResponse', //RequestResponse or Event
        LogType: 'Tail',
        Payload: JSON.stringify(payload_lambda)
    };
    var data_lambda = await lambda.invoke(params_lambda).promise();
    data_lambda = JSON.parse(data_lambda.Payload);
    console.log(data_lambda);

    //Otorgados
    document.getElementById("beneficio_vacaciones").innerHTML = data_lambda.response.saldo_beneficios["vacaciones"];
    document.getElementById("beneficio_personalDay").innerHTML = data_lambda.response.saldo_beneficios["dias_personales"];
    document.getElementById("beneficio_cumple").innerHTML = data_lambda.response.saldo_beneficios["cumpleaños"];
    document.getElementById("beneficio_paternidad").innerHTML = data_lambda.response.saldo_beneficios["paternidad"];
    document.getElementById("beneficio_maternidad").innerHTML = data_lambda.response.saldo_beneficios["maternidad"];
    document.getElementById("beneficio_adopcion_madre").innerHTML = data_lambda.response.saldo_beneficios["adopcion_madre"];
    document.getElementById("beneficio_fallecimiento").innerHTML = data_lambda.response.saldo_beneficios["fallecimiento"];

    //SALDO
    document.getElementById("saldo_vacaciones").innerHTML = data_lambda.response.saldo["vacaciones"];
    document.getElementById("saldo_personalDay").innerHTML = data_lambda.response.saldo["dias_personales"];
    document.getElementById("saldo_cumple").innerHTML = data_lambda.response.saldo["cumpleaños"];
    document.getElementById("saldo_paternidad").innerHTML = data_lambda.response.saldo["paternidad"];
    document.getElementById("saldo_maternidad").innerHTML = data_lambda.response.saldo["maternidad"];
    document.getElementById("saldo_adopcion_madre").innerHTML = data_lambda.response.saldo["adopcion_madre"];
    document.getElementById("saldo_fallecimiento").innerHTML = data_lambda.response.saldo["fallecimiento"];

    //USADO
    document.getElementById("usado_vacaciones").innerHTML = data_lambda.response.usado["vacaciones"];
    document.getElementById("usado_personalDay").innerHTML = data_lambda.response.usado["dias_personales"];
    document.getElementById("usado_cumple").innerHTML = data_lambda.response.usado["cumpleaños"];
    document.getElementById("usado_paternidad").innerHTML = data_lambda.response.usado["paternidad"];
    document.getElementById("usado_maternidad").innerHTML = data_lambda.response.usado["maternidad"];
    document.getElementById("usado_adopcion_madre").innerHTML = data_lambda.response.usado["adopcion_madre"];
    document.getElementById("usado_fallecimiento").innerHTML = data_lambda.response.usado["fallecimiento"];
    document.getElementById("usado_permiso").innerHTML = data_lambda.response.usado["permisos"];
    document.getElementById("usado_enfermedad").innerHTML = data_lambda.response.usado["enfermedad"];

    //AGENDADO
    document.getElementById("agendado_vacaciones").innerHTML = data_lambda.response.agendado["vacaciones"];
    document.getElementById("agendado_personalDay").innerHTML = data_lambda.response.agendado["dias_personales"];
    document.getElementById("agendado_cumple").innerHTML = data_lambda.response.agendado["cumpleaños"];
    document.getElementById("agendado_paternidad").innerHTML = data_lambda.response.agendado["paternidad"];
    document.getElementById("agendado_maternidad").innerHTML = data_lambda.response.agendado["maternidad"];
    document.getElementById("agendado_adopcion_madre").innerHTML = data_lambda.response.agendado["adopcion_madre"];
    document.getElementById("agendado_fallecimiento").innerHTML = data_lambda.response.agendado["fallecimiento"];
    document.getElementById("agendado_permiso").innerHTML = data_lambda.response.agendado["permisos"];
    document.getElementById("agendado_enfermedad").innerHTML = data_lambda.response.agendado["enfermedad"];

    return;
}
