var BD;

async function obtener_reporte() {
    var params = {
        TableName: "NAVE_Reporte_General_MVPs"
    };
    var response = await docClient.scan(params).promise();
    var data = [];
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

    BD = data;

    //Build Tabulator
    new Tabulator("#table-reporte", {
        data: BD,
        layout:"fitColumns",
        pagination:"local",
        paginationSize: 5,
        paginationSizeSelector:[3, 6, 8, 10],
        movableColumns:true,
        paginationCounter:"rows",
        columns:[
            {title:"ID Iniciativa", field:"key_iniciativa", formatter:"textarea", width:120, headerFilter:"input"},
            {title:"Iniciativa", field:"nombre_iniciativa", formatter:"textarea", width:140, headerFilter:"input"},
            {title:"Folio", field:"folio", formatter:"textarea", width:90, headerFilter:"input"},
            {title:"Journey", field:"journey", formatter:"textarea", width:120, headerFilter:"input"},
            {title:"ID MVP", field:"key", formatter:"textarea", width:120, headerFilter:"input"},
            {title:"MVP", field:"nombre_mvp", formatter:"textarea", width:140, headerFilter:"input"},
            {title:"Fecha Inicio", field:"start_date", formatter:"textarea", width:140, headerFilter:"input"},
            {title:"Fecha Inicio MVP", field:"fecha_inicio_mvp", formatter:"textarea", width:150, headerFilter:"input"},
            {title:"Fecha Fin MVP", field:"fecha_fin_mvp", formatter:"textarea", width:150, headerFilter:"input"},
            {title:"Fecha Fin Real", field:"fecha_fin_real", formatter:"textarea", width:150, headerFilter:"input"},
            {title:"Estatus MVP", field:"estatus_mvp", formatter:"textarea", width:140, headerFilter:"input"},
            {title:"Estatus Iniciativa", field:"estatus_iniciativa", formatter:"textarea", width:140, headerFilter:"input"},
            {title:"Talla", field:"talla", formatter:"textarea", width:80, headerFilter:"input"},
            {title:"Marco Trabajo", field:"marco_trabajo", formatter:"textarea", width:130, headerFilter:"input"},
            {title:"CR/SI", field:"cr_si", formatter:"textarea", width:90, headerFilter:"input"},
            {title:"Tipo Proyecto DevSecOps", field:"tipo_proyecto_devsecops", formatter:"textarea", width:150, headerFilter:"input"},
            {title:"Tipo Infra", field:"tipo_infra", formatter:"textarea", width:130, headerFilter:"input"},
            {title:"Equipos", field:"equipos", formatter:"textarea", width:150, headerFilter:"input"},
            {title:"Plataformas Impactadas", field:"plataformas_impactadas", formatter:"textarea", width:150, headerFilter:"input"},
            {title:"Champions", field:"champions", formatter:"textarea", width:140, headerFilter:"input"},
            {title:"Roles", field:"roles", formatter:"textarea", width:140, headerFilter:"input"},
            {title:"TPO", field:"contacto_tpo", formatter:"textarea", width:140, headerFilter:"input"},
            {title:"SRE", field:"sre", formatter:"textarea", width:80, headerFilter:"input"},
            {title:"Líder Infra", field:"lider_infra", formatter:"textarea", width:130, headerFilter:"input"},
            {title:"Ing. Observabilidad", field:"ingeniero_observabilidad", formatter:"textarea", width:130, headerFilter:"input"},
            {title:"Consultor NAVE", field:"consultor_nave", formatter:"textarea", width:130, headerFilter:"input"},
            {title:"Coordinador NAVE", field:"coordinador_nave", formatter:"textarea", width:130, headerFilter:"input"},
            {title:"SRE Asignado", field:"sre_asignado", formatter:"textarea", width:150, headerFilter:"input"},
            {title:"Líder Infra Asignado", field:"lider_infraestructura_asignado", formatter:"textarea", width:170, headerFilter:"input"},
            {title:"Ing. Observabilidad Asignado", field:"ing_observabilidad_asignado", formatter:"textarea", width:170, headerFilter:"input"},
            {title:"Consultor NAVE Asignado", field:"consultor_nave_asignado", formatter:"textarea", width:170, headerFilter:"input"},
            {title:"Coordinador NAVE Asignado", field:"coordinador_nave_asignado", formatter:"textarea", width:170, headerFilter:"input"},
            {title:"Porcentaje SRE", field:"porcentaje_sre", formatter:"textarea", width:150, headerFilter:"input"},
            {title:"Porcentaje Líder Infra", field:"porcentaje_lider_infra", formatter:"textarea", width:200, headerFilter:"input"},
            {title:"Porcentaje Ing. Observabilidad", field:"porcentaje_ing_observabilidad", formatter:"textarea", width:200, headerFilter:"input"},
            {title:"Porcentaje Consultor NAVE", field:"porcentaje_consultor_nave", formatter:"textarea", width:200, headerFilter:"input"},
            {title:"Porcentaje Coordinador NAVE", field:"porcentaje_coordinador_nave", formatter:"textarea", width:200, headerFilter:"input"},
            {title:"Fecha Asignación SRE", field:"fecha_asignacion_sre", formatter:"textarea", width:200, headerFilter:"input"},
            {title:"Fecha Fin Asignación SRE", field:"fecha_fin_asignacion_sre", formatter:"textarea", width:200, headerFilter:"input"},
            {title:"Fecha Asignación Líder Infra", field:"fecha_asignacion_lider_infraestructura", formatter:"textarea", width:200, headerFilter:"input"},
            {title:"Fecha Fin Asignación Líder Infra", field:"fecha_fin_asignacion_lider_infraestructura", formatter:"textarea", width:200, headerFilter:"input"},
            {title:"Fecha Asignación Ing. Observabilidad", field:"fecha_asignacion_observabilidad", formatter:"textarea", width:200, headerFilter:"input"},
            {title:"Fecha Fin Asignación Ing. Observabilidad", field:"fecha_fin_asignacion_observabilidad", formatter:"textarea", width:200, headerFilter:"input"},
            {title:"Fecha Asignación Consultor NAVE", field:"fecha_asignacion_consultor_nave", formatter:"textarea", width:200, headerFilter:"input"},
            {title:"Fecha Fin Asignación Consultor NAVE", field:"fecha_fin_asignacion_consultor_nave", formatter:"textarea", width:200, headerFilter:"input"},
            {title:"Fecha Asignación Coordinador NAVE", field:"fecha_asignacion_coordinador_nave", formatter:"textarea", width:200, headerFilter:"input"},
            {title:"Fecha Fin Asignación Coordinador NAVE", field:"fecha_fin_asignacion_coordinador_nave", formatter:"textarea", width:200, headerFilter:"input"},
            // {title:"Descripción", field:"descripcion", formatter:"textarea", width:140, headerFilter:"input"},
        ],
    });

    const usuarios = [...new Set(BD.map(data => data.Recurso))];
    for (let i = 0; i < usuarios.length; i++) {
        const recurso_select = usuarios[i];
        let insert_select = `<option value="${usuarios[i]}">${usuarios[i]}</option>`;
        await $("#recurso").append(insert_select);
    }

    return;
}

async function descargar_reporte() {
    // Mapeamos los datos
    const datosMapeados1 = await mapearDatos(BD, "MVP");
    const datosMapeados2 = await mapearDatos(BD, "Asignaciones");
    const datosMapeados3 = await mapearDatos(BD, "Etapas");

    // Crear un libro de trabajo y añadir hojas
    const workbook = new ExcelJS.Workbook();
    const worksheet1 = workbook.addWorksheet('MVP');
    const worksheet2 = workbook.addWorksheet('Asignaciones');
    const worksheet3 = workbook.addWorksheet('Etapas');

    // Agregar datos y estilos a cada hoja
    await agregarDatosYEstilos(worksheet1, datosMapeados1);
    await agregarDatosYEstilos(worksheet2, datosMapeados2);
    await agregarDatosYEstilos(worksheet3, datosMapeados3);

    // Guardar y descargar en el navegador
    workbook.xlsx.writeBuffer().then((buffer) => {
        const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "Reporte_MVPs.xlsx";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
    return;
}

// Función para reordenar los datos según las columnas deseadas
async function mapearDatos(data, tipo) {
    if (tipo === "MVP") {
        return data.map(item => {
            let nuevoItem = {
                "Id Iniciativa (JIRA)": item.key_iniciativa,
                "Iniciativa": item.nombre_iniciativa,
                "Folio": item.folio,
                "Journey": item.journey,
                "MVP": item.nombre_mvp,
                "Id MVP (JIRA)": item.key,
                "Etapa MVP": item.estatus_mvp,
                "BAU": item.bau,
                "Avenida": item.avenida,
                "Fecha N 35": item.fecha_n_35,
                "Fecha Petición": item.fecha_peticion_roles,
                "Fecha inicio MVP": item.fecha_inicio_mvp,
                "Fecha Fin planeada MVP": item.fecha_fin_mvp,
                "Fecha Fin Real": item.fecha_fin_real,
                "Fecha ventana de Autorización": item.fecha_ventana_autorizacion,
                "SRE": item.sre,
                "Ing Observabilidad": item.ingeniero_observabilidad,
                "Líder de Infraestrctura": item.lider_infra,
                "Consultor NAVE Operativo": item.consultor_nave,
                "Coordinador NAVE": item.coordinador_nave,
                "02 T-Shirt": item.t_shirt,
                "02 Entro en la ventana de Autorización": item.entro_ventana_autorizacion,
                "02 SI Autorizada / Liberada": item.si_autorizada,
                "02 Envío cotización Roles DOTI": item.envio_cotizacion_roles_doti,
                "03 Calculadora Costos - TI Estimados": item.calculadora_costos_estimados,
                "03 NFRs": item.nfrs,
                "04 Acuerdos Niveles de Servicio": item.acuerdos_niveles_servicio,
                "04 Matriz de incidencia / Requerimientos": item.matriz_incidencia_requerimientos,
                "04 Checklist Obsevabilidad": item.checklist_obsevabilidad,
                "04 Checklist Infraestructura": item.checklist_infraestructura,
                "04 Estrategia de Despliegue": item.estrategia_despliegue,
                "04 Calculadora - Costos Refinados": item.calculadora_costos_refinados,
                "04 Sesión de entendimiento con Soporte": item.sesion_entendimiento_soporte,
                "05 Matriz de Incidencias": item.matriz_incidencias,
                "05 Checklist de Entrega / SDP": item.checklist_entrega_sdp,
                "05 Se entrego en tiempo en PROD": item.se_entrego_tiempo_prod,
                "05 Liberación éxitosa": item.liberacion_exitosa,
                "05 Causa de Liberación no exitosa": item.causa_liberacion_no_exitosa,
                "06 Carta de Cierre": item.carta_cierre
            };
            return nuevoItem;
        });
    }
    else if (tipo === "Asignaciones") {
        return data.map(item => {
            let nuevoItem = [
                {
                    "MVP": item.nombre_mvp,
                    "ID MVP": item.key,
                    "Rol": "SRE",
                    "Nombre, tal como aparece en JIRA": item.sre_asignado,
                    "Fecha Asignación": item.fecha_asignacion_sre,
                    "Fecha Finalización": item.fecha_fin_asignacion_sre,
                    "% Asignado": item.porcentaje_sre
                },
                {
                    "MVP": item.nombre_mvp,
                    "ID MVP": item.key,
                    "Rol": "Líder Infraestructura",
                    "Nombre, tal como aparece en JIRA": item.lider_infraestructura_asignado,
                    "Fecha Asignación": item.fecha_asignacion_lider_infraestructura,
                    "Fecha Finalización": item.fecha_fin_asignacion_lider_infraestructura,
                    "% Asignado": item.porcentaje_lider_infra
                },
                {
                    "MVP": item.nombre_mvp,
                    "ID MVP": item.key,
                    "Rol": "Ing. Observabilidad",
                    "Nombre, tal como aparece en JIRA": item.ing_observabilidad_asignado,
                    "Fecha Asignación": item.fecha_asignacion_observabilidad,
                    "Fecha Finalización": item.fecha_fin_asignacion_observabilidad,
                    "% Asignado": item.porcentaje_ing_observabilidad
                },
                {
                    "MVP": item.nombre_mvp,
                    "ID MVP": item.key,
                    "Rol": "Coordinador NAVE",
                    "Nombre, tal como aparece en JIRA": item.coordinador_nave_asignado,
                    "Fecha Asignación": item.fecha_asignacion_coordinador_nave,
                    "Fecha Finalización": item.fecha_fin_asignacion_coordinador_nave,
                    "% Asignado": item.porcentaje_coordinador_nave
                },
                {
                    "MVP": item.nombre_mvp,
                    "ID MVP": item.key,
                    "Rol": "Consultor NAVE",
                    "Nombre, tal como aparece en JIRA": item.consultor_nave_asignado,
                    "Fecha Asignación": item.fecha_asignacion_consultor_nave,
                    "Fecha Finalización": item.fecha_fin_asignacion_consultor_nave,
                    "% Asignado": item.porcentaje_consultor_nave
                }
            ];
            return nuevoItem;
        }).flat();
    }
    else { //"Etapas"
        return data.map(item => {
            let nuevoItem = {
                "MVP": item.nombre_mvp,
                "ID MVP": item.key,
                "Etapa": item.estatus_iniciativa,
                "Estado": item.estatus_mvp,
                "Fecha Inicio dd-mm-aaaa": item.fecha_inicio_mvp,
                "Fecha Final Tentativa": item.fecha_fin_mvp,
                "Fecha Final Real": item.fecha_fin_real
            };
    
            return nuevoItem;
        });
    }
}

async function agregarDatosYEstilos(worksheet, datos) {
    // Agregar datos al worksheet
    const headers = Object.keys(datos[0] || {}); // Obtiene encabezados de los datos
    worksheet.addRow(headers); // Agregar encabezados
    datos.forEach(dato => worksheet.addRow(Object.values(dato))); // Agregar filas de datos

    // Aplicar estilos al encabezado
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }; // Letra blanca y negrita
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } }; // Fondo rojo
        cell.alignment = { horizontal: 'center' };
        cell.border = {
            top: { style: 'thin' },
            bottom: { style: 'thin' },
            left: { style: 'thin' },
            right: { style: 'thin' }
        };
    });

    // Ajustar ancho de las columnas según el tamaño del encabezado
    headers.forEach((header, index) => {
        const headerWidth = Math.max(header.length + 2, 10); // Ajusta el ancho mínimo a 10
        worksheet.getColumn(index + 1).width = headerWidth;
    });

    // Aplicar filtros al encabezado
    worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: headers.length }
    };

    // Aplicar estilos a las filas de datos
    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber !== 1) { // Evita el encabezado
            row.eachCell((cell) => {
                cell.font = { color: { argb: 'FF000000' } }; // Letra negra
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } }; // Fondo blanco
                cell.alignment = { horizontal: 'center', wrapText: true }; // Centrado y ajuste de texto
                cell.border = {
                    top: { style: 'thin' },
                    bottom: { style: 'thin' },
                    left: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
        }
    });

    return;
}