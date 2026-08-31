var BD_aprobaciones;

function getPortalUrl() {
    if (window.NAVE_PORTAL_URL) {
        return window.NAVE_PORTAL_URL;
    }
    if (window.location.protocol === "http:" || window.location.protocol === "https:") {
        return window.location.origin;
    }
    return "";
}

const solicitud = {
    "id": "",
    "correo_solicitante": "",
    "aprobador": "",
    "desde": "",
    "hasta": "",
    "nombre_solicitante": "",
    "tipo_solicitud": "",
    "dias_solicitados": ""
}

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

async function obtener_aprobaciones_pendientes() {
    var params = {
        TableName: "NAVE_Vacaciones",
        FilterExpression: "(#aprobador = :aprobador) and (#estatus = :estatus)",
        ExpressionAttributeNames: {
            "#aprobador":"aprobador",
            "#estatus": "estatus"
        },
        ExpressionAttributeValues: {
            ":aprobador": localStorage.getItem('correo'),
            ":estatus": "Pendiente de Aprobación"
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
        document.getElementById("text-aprobaciones").innerHTML = "No hay solicitudes pendientes por aprobar";
    }

    BD_aprobaciones = data;

    //Build Tabulator
    new Tabulator("#table-aprobaciones", {
        data: BD_aprobaciones,
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
            // {title:"Aprobador", field:"aprobador", formatter:"textarea", width:260, headerFilter:"input"},
            {title:"Estatus", field:"estatus", formatter:"textarea", width:180, headerFilter:"input", formatter:function(cell, formatterParams){
                let value = cell.getValue();
                return "<p>"+ value +"</p>" + "<a class='info-recurso'>Ver solicitud</a>";
            },cellClick:async function(e, cell){
                let data = cell.getRow().getData();
                console.log(data);
                if (data.aprobador !== localStorage.getItem('correo')){
                    return alert("No eres el aprobador para esta solicitud");
                }
                if (data.estatus === "Rechazado") {
                    return alert("La solicitud ya ha sido Rechazada, favor de levantar otra solicitud en dado caso de requerirlo");
                }
                //Imprimir la info en el Modal
                document.getElementById("solicitante").value = data.solicitante;
                document.getElementById("tipo").value = eventDic[data.tipo_solicitud];
                document.getElementById("dias_solicitados").value = data.dias_solicitados;
                document.getElementById("desde").value = data["desde"];
                document.getElementById("hasta").value = data["hasta"];

                solicitud["id"] = data.id;
                solicitud["correo_solicitante"] = data.correo_solicitante;
                solicitud["aprobador"] = data.aprobador;
                solicitud["desde"] = data.desde;
                solicitud["hasta"] = data.hasta;
                solicitud["nombre_solicitante"] = data.solicitante;
                solicitud["tipo_solicitud"] = eventDic[data.tipo_solicitud];
                solicitud["dias_solicitados"] = data.dias_solicitados;

                $('#modal_aprobacion').modal({
                    backdrop: 'static',
                    keyboard: false
                });
                $('#modal_aprobacion').modal('show');
            
                return;
            }}
        ],
    });

    return;
}

async function aprobar_solicitud(){
    const params = {
        TableName: "NAVE_Vacaciones",
        Key: {
            "id": solicitud["id"]
        },
        ExpressionAttributeValues: {
            ":var1": "Aprobado"
        },
        UpdateExpression: "SET estatus = :var1"
    };
    await docClient.update(params).promise();

    var modal = $('#modal_aprobacion');
    modal.modal('hide');

    const portalUrl = getPortalUrl();
    const portalMessage = portalUrl
        ? `Se ha aprobado tu solicitud del portal de Vacaciones: ${portalUrl}`
        : "Se ha aprobado tu solicitud del portal de Vacaciones.";

    // Envio del Correo al Solicitante
    const payload_lambda = {
        "email_to": solicitud["correo_solicitante"],
        "body": `${portalMessage}
            Tipo de solicitud: "${solicitud["tipo_solicitud"]}"
            Días Solicitados: ${solicitud["dias_solicitados"]}, 
            Desde: ${solicitud["desde"]} 
            Hasta: ${solicitud["hasta"]}
        `,
        "subject": `Solicitud Aprobada Portal Vacaciones`
    };
    const params_lambda = {
        FunctionName: 'Send_Email',
        InvocationType: 'Event', //RequestResponse or Event
        LogType: 'Tail',
        Payload: JSON.stringify(payload_lambda)
    };

    await lambda.invoke(params_lambda).promise();
    
    await obtener_aprobaciones_pendientes();

    return;
}

async function rechazar_solicitud(){
    const params = {
        TableName: "NAVE_Vacaciones",
        Key: {
            "id": solicitud["id"]
        },
        ExpressionAttributeValues: {
            ":var1": "Rechazado"
        },
        UpdateExpression: "SET estatus = :var1"
    };
    await docClient.update(params).promise();

    var modal = $('#modal_aprobacion');
    modal.modal('hide');

    const portalUrl = getPortalUrl();
    const portalMessage = portalUrl
        ? `Se ha rechazado tu solicitud del portal de Vacaciones: ${portalUrl}`
        : "Se ha rechazado tu solicitud del portal de Vacaciones.";

    // Envio del Correo al Solicitante
    const payload_lambda = {
        "email_to": solicitud["correo_solicitante"],
        "body": `${portalMessage}
            Tipo de solicitud: "${solicitud["tipo_solicitud"]}"
            Días Solicitados: ${solicitud["dias_solicitados"]}, 
            Desde: ${solicitud["desde"]} 
            Hasta: ${solicitud["hasta"]}
        `,
        "subject": `Solicitud rechazada Portal Vacaciones`
    };
    const params_lambda = {
        FunctionName: 'Send_Email',
        InvocationType: 'Event', //RequestResponse or Event
        LogType: 'Tail',
        Payload: JSON.stringify(payload_lambda)
    };

    await lambda.invoke(params_lambda).promise();

    await obtener_aprobaciones_pendientes();

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
