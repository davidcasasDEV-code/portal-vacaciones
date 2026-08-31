var BD;
var BD_filtro;
var year;

async function obtener_reporte() {
    year = document.getElementById("year").value;
    var params = {
        TableName: "NAVE_Reporte_Capacidades",
        Key:{
            "year": year
        }
    };
    var data = await docClient.get(params).promise();
    console.log(data);

    if(!data.Item.reporte){
        return alert("No se encontró información con los datos del filtro");
    }

    BD = data.Item.reporte;
    BD_filtro = BD;

    //Build Tabulator
    new Tabulator("#table-reporte", {
        data: BD,
        layout:"fitColumns",
        pagination:"local",
        paginationSize: 10,
        paginationSizeSelector:[3, 6, 8, 10],
        movableColumns:true,
        paginationCounter:"rows",
        columns:[
            {title:"Recurso", field:"Recurso", width:230, headerFilter:"input", formatter:function(cell, formatterParams){
                let value = cell.getValue();
                // return "<p>"+ value +"</p>" + "<a class='info-recurso'>Ver Información del Recurso</a>";
                return "<p>"+ value +"</p>";
            },
            // cellClick:function(e, cell){
            //     let data = cell.getRow().getData();
            //     console.log(data);
            //     document.getElementById("nombre_recurso").value = data.Recurso;
            //     document.getElementById("gerencia_recurso").innerHTML = data.gerencia;
            //     document.getElementById("jefe_directo_recurso").innerHTML = data.jefe_directo;
            //     document.getElementById("bus_recurso").innerHTML = data.bus;
            //     document.getElementById("programa_recurso").innerHTML = data.programa;
            //     abrir_info_recurso();
            // }
            },
            {title:"Folio", field:"Folio", formatter:"textarea", width:90, headerFilter:"input"},
            {title:"Prom Capacidad", field:"Promedio Capacidades", width:180, headerFilter:"input", formatter:function(cell, formatterParams){
                let value = cell.getValue();
                return "<p>"+ value +"</p>" + "<a class='info-recurso'>Ver Desgloce Capacidad</a>";
            },cellClick:async function(e, cell){
                let data = cell.getRow().getData();
                console.log(data);
                document.getElementById("nombre_capacidad").value = data.Recurso;
                document.getElementById("proyecto_area_capacidad").value = data["Proyecto (OPTI)"];
                document.getElementById("folio_capacidad").value = data.Folio;
                document.getElementById("prom_capacidad").value = data["Promedio Capacidades"];
                document.getElementById("fecha_fin_capacidad").value = data["Fecha Fin"];
                // document.getElementById("programa_recurso").innerHTML = data.programa;
                await registrar_capacidad(data.Capacidad);
                await abrir_desgloce_capacidad();
                return;
            }},
            {title:"Proyecto (OPTI)", field:"Proyecto (OPTI)", formatter:"textarea", width:260, headerFilter:"input"},
            {title:"Carretera", field:"Carretera", formatter:"textarea", width:140, headerFilter:"input"},
            {title:"Etapa", field:"Etapa", formatter:"textarea", width:140, headerFilter:"input"},
            {title:"Fecha Fin", field:"Fecha Fin", formatter:"textarea", width:140, headerFilter:"input"},
            {title:"Tier", field:"Tier", formatter:"textarea", width:140, headerFilter:"input"},
            // {title:"Driver", field:"car", hozAlign:"center", formatter:"tickCross"},
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

async function buscar_reporte() {
    var year_filtro = document.getElementById("year").value;
    var recurso_filtro = document.getElementById("recurso").value;
    if (year === year_filtro && recurso_filtro === "Todos"){
        //Build Tabulator
        new Tabulator("#table-reporte", {
            data: BD_filtro,
            layout:"fitColumns",
            pagination:"local",
            paginationSize:10,
            paginationSizeSelector:[3, 6, 8, 10],
            movableColumns:true,
            paginationCounter:"rows",
            columns:[
                {title:"Recurso", field:"Recurso", width:230, headerFilter:"input", formatter:function(cell, formatterParams){
                    let value = cell.getValue();
                    // return "<p>"+ value +"</p>" + "<a class='info-recurso'>Ver Información del Recurso</a>";
                    return "<p>"+ value +"</p>";
                },
                // cellClick:function(e, cell){
                //     let data = cell.getRow().getData();
                //     console.log(data);
                //     document.getElementById("nombre_recurso").value = data.Recurso;
                //     document.getElementById("gerencia_recurso").innerHTML = data.gerencia;
                //     document.getElementById("jefe_directo_recurso").innerHTML = data.jefe_directo;
                //     document.getElementById("bus_recurso").innerHTML = data.bus;
                //     document.getElementById("programa_recurso").innerHTML = data.programa;
                //     abrir_info_recurso();
                // }
                },
                {title:"Folio", field:"Folio", formatter:"textarea", width:90, headerFilter:"input"},
                {title:"Prom Capacidad", field:"Promedio Capacidades", width:180, headerFilter:"input", formatter:function(cell, formatterParams){
                    let value = cell.getValue();
                    return "<p>"+ value +"</p>" + "<a class='info-recurso'>Ver Desgloce Capacidad</a>";
                },cellClick:async function(e, cell){
                    let data = cell.getRow().getData();
                    console.log(data);
                    document.getElementById("nombre_capacidad").value = data.Recurso;
                    document.getElementById("proyecto_area_capacidad").value = data["Proyecto (OPTI)"];
                    document.getElementById("folio_capacidad").value = data.Folio;
                    document.getElementById("prom_capacidad").value = data["Promedio Capacidades"];
                    document.getElementById("fecha_fin_capacidad").value = data["Fecha Fin"];
                    // document.getElementById("programa_recurso").innerHTML = data.programa;
                    await registrar_capacidad(data.Capacidad);
                    await abrir_desgloce_capacidad();
                    return;
                }},
                {title:"Proyecto (OPTI)", field:"Proyecto (OPTI)", formatter:"textarea", width:260, headerFilter:"input"},
                {title:"Carretera", field:"Carretera", formatter:"textarea", width:140, headerFilter:"input"},
                {title:"Etapa", field:"Etapa", formatter:"textarea", width:140, headerFilter:"input"},
                {title:"Fecha Fin", field:"Fecha Fin", formatter:"textarea", width:140, headerFilter:"input"},
                {title:"Tier", field:"Tier", formatter:"textarea", width:140, headerFilter:"input"},
                // {title:"Driver", field:"car", hozAlign:"center", formatter:"tickCross"},
            ],
        });

        return;
    }
    if (year !== year_filtro && recurso_filtro === "Todos"){
        return obtener_reporte();
    }
    if (year !== year_filtro && recurso_filtro !== "Todos"){
        await obtener_reporte();
        await buscar_reporte();
        return;
    }
    var recurso_filtro = document.getElementById("recurso").value;
    const filtro_BD = BD.filter(reporte => reporte.Recurso === recurso_filtro);
    console.log(filtro_BD);
    BD_filtro = filtro_BD;

    if(BD_filtro.length === 0){
        return alert("No hay datos con los filtros actuales");
    }

    //Build Tabulator
    new Tabulator("#table-reporte", {
        data: BD_filtro,
        layout:"fitColumns",
        pagination:"local",
        paginationSize:10,
        paginationSizeSelector:[3, 6, 8, 10],
        movableColumns:true,
        paginationCounter:"rows",
        columns:[
            {title:"Recurso", field:"Recurso", width:230, headerFilter:"input", formatter:function(cell, formatterParams){
                let value = cell.getValue();
                // return "<p>"+ value +"</p>" + "<a class='info-recurso'>Ver Información del Recurso</a>";
                return "<p>"+ value +"</p>";
            },
            // cellClick:function(e, cell){
            //     let data = cell.getRow().getData();
            //     console.log(data);
            //     document.getElementById("nombre_recurso").value = data.Recurso;
            //     document.getElementById("gerencia_recurso").innerHTML = data.gerencia;
            //     document.getElementById("jefe_directo_recurso").innerHTML = data.jefe_directo;
            //     document.getElementById("bus_recurso").innerHTML = data.bus;
            //     document.getElementById("programa_recurso").innerHTML = data.programa;
            //     abrir_info_recurso();
            // }
            },
            {title:"Folio", field:"Folio", formatter:"textarea", width:90, headerFilter:"input"},
            {title:"Prom Capacidad", field:"Promedio Capacidades", width:180, headerFilter:"input", formatter:function(cell, formatterParams){
                let value = cell.getValue();
                return "<p>"+ value +"</p>" + "<a class='info-recurso'>Ver Desgloce Capacidad</a>";
            },cellClick:async function(e, cell){
                let data = cell.getRow().getData();
                console.log(data);
                document.getElementById("nombre_capacidad").value = data.Recurso;
                document.getElementById("proyecto_area_capacidad").value = data["Proyecto (OPTI)"];
                document.getElementById("folio_capacidad").value = data.Folio;
                document.getElementById("prom_capacidad").value = data["Promedio Capacidades"];
                document.getElementById("fecha_fin_capacidad").value = data["Fecha Fin"];
                // document.getElementById("programa_recurso").innerHTML = data.programa;
                await registrar_capacidad(data.Capacidad);
                await abrir_desgloce_capacidad();
                return;
            }},
            {title:"Proyecto (OPTI)", field:"Proyecto (OPTI)", formatter:"textarea", width:260, headerFilter:"input"},
            {title:"Carretera", field:"Carretera", formatter:"textarea", width:140, headerFilter:"input"},
            {title:"Etapa", field:"Etapa", formatter:"textarea", width:140, headerFilter:"input"},
            {title:"Fecha Fin", field:"Fecha Fin", formatter:"textarea", width:140, headerFilter:"input"},
            {title:"Tier", field:"Tier", formatter:"textarea", width:140, headerFilter:"input"},
            // {title:"Driver", field:"car", hozAlign:"center", formatter:"tickCross"},
        ],
    });

    return;
}

async function abrir_info_recurso(){
    $('#info_recurso').modal({
        backdrop: 'static',
        keyboard: false
    });
    $('#info_recurso').modal('show');
    return;
}

async function abrir_desgloce_capacidad(){
    $('#desgloce_capacidad').modal({
        backdrop: 'static',
        keyboard: false
    });
    $('#desgloce_capacidad').modal('show');
    return;
}

async function registrar_capacidad(capacidad){
    // Convertir 'capacidad' a un array de objetos para Tabulator
    var data = [];

    // Obtener las fechas ordenadas
    var fechas = Object.keys(capacidad).sort((a, b) => new Date(a) - new Date(b));

    // Crear una fila para cada conjunto de fechas
    var fila = {};
    fechas.forEach(fecha => {
        fila[fecha] = capacidad[fecha]; // Agregar el valor correspondiente a la fecha
    });

    // Agregar la fila al array de datos
    data.push(fila);

    // Crear columnas
    var columns_table = [];
    fechas.forEach(fecha => {
        columns_table.push({
            title: fecha,
            field: fecha,
            width: 140
        });
    });

    // Inicializar Tabulator
    new Tabulator("#table-capacidad", {
        data: data,
        columnHeaderVertAlign: "bottom",
        columns: columns_table
    });
    return;
}

async function descargar_reporte() {
    // Mapeamos los datos para que cada capacidad sea una columna
    const datosMapeados = await mapearDatos(BD_filtro);

    // Crear un libro de trabajo y añadir hojas
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Capacidades');

    // Agregar datos y estilos a cada hoja
    await agregarDatosYEstilos(worksheet, datosMapeados);

    // Guardar y descargar en el navegador
    workbook.xlsx.writeBuffer().then((buffer) => {
        const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "ReporteCapacidadOPTI.xlsx";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    return;
}

// Función para reordenar los datos según las columnas deseadas
async function mapearDatos(datos) {
    return datos.map(item => {
        let nuevoItem = {
            "Recurso": item["Recurso"],
            "Folio": item["Folio"],
            "Proyecto (OPTI)": item["Proyecto (OPTI)"],
            "Carretera": item["Carretera"],
            "Etapa": item["Etapa"],
            "Fecha Fin": item["Fecha Fin"],
            "Tier": item["Tier"],
            "Promedio Capacidades": item["Promedio Capacidades"]
        };

        // Obtener las fechas ordenadas
        let fechas = Object.keys(item.Capacidad).sort((a, b) => new Date(a) - new Date(b));

        // Crear una fila para cada conjunto de fechas
        var fila = {};
        fechas.forEach(fecha => {
            fila[fecha] = item.Capacidad[fecha]; // Agregar el valor correspondiente a la fecha
        });
        
        // Añadir las capacidades como columnas separadas
        for (let [fecha, porcentaje] of Object.entries(fila)) {
            if(!porcentaje){
                nuevoItem[fecha] = "";
            }
            else{
                nuevoItem[fecha] = porcentaje;
            }
        }
        return nuevoItem;
    });
}

// Función para dar formato personalizado a las celdas
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
        to: { row: 1, column: 1 }
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