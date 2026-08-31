const meses = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

const dias = [
    "Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sá"
];

const festivos = [
    "2024-01-01", 
    "2024-02-05", 
    "2024-03-18", 
    "2024-05-01", 
    "2024-09-16", 
    "2024-11-18", 
    "2024-12-25", 
    "2025-01-01", 
    "2025-02-03", 
    "2025-03-17", 
    "2025-04-17", 
    "2025-04-18", 
    "2025-05-01", 
    "2025-09-16", 
    "2025-11-17",
    "2025-12-24",
    "2025-12-25",
    "2025-12-31",
    "2026-01-01",
    "2026-02-02",
    "2026-03-16",
    "2026-04-02", 
    "2026-04-03", 
    "2026-05-01",
    "2026-09-16",
    "2026-11-16",
    "2026-12-24",
    "2026-12-25",
    "2026-12-31",
    "2027-01-01"
];

async function obtener_reporte(){
    // Fecha de inicio del año actual
    const inicioAño = new Date(new Date().getFullYear(), 0, 1);
    const fechaInicio = inicioAño.toISOString().split('T')[0];

    // Fecha de fin del año actual
    const finAño = new Date(new Date().getFullYear(), 11, 31);
    const fechaFin = finAño.toISOString().split('T')[0];

    var data = await scan_vacaciones(fechaInicio, fechaFin);
    await buscar_reporte_mes("General");

    var reporte = {}

    // Ordenar Datos
    for (let i = 0; i < data.length; i++) {
        if (!reporte[data[i].solicitante]){
            reporte[data[i].solicitante] = {
                "personal-day": 0,
                "vacation": 0,
                "birthday": 0,
                "enfermedad": 0,
                "permiso": 0,
                "medio-dia": 0,
                "total": 0
            }
        }
        reporte[data[i].solicitante][data[i].tipo_solicitud] += Number(data[i].dias_solicitados);
        if (data[i].tipo_solicitud === "medio-dia"){
            reporte[data[i].solicitante]["total"] += Number(data[i].dias_solicitados) * 0.5;
        }
        else {
            reporte[data[i].solicitante]["total"] += Number(data[i].dias_solicitados);
        }
    }

    console.log(reporte);

    // Insertas datos
    for (var solicitante in reporte) {
        var detalles = reporte[solicitante];
        let insert_select = `
            <tr>
                <th scope="row">${solicitante}</th>
                <th>${detalles["total"]}</th>
                <th>${detalles["personal-day"]}</th>
                <th>${detalles["vacation"]}</th>
                <th>${detalles["medio-dia"]}</th>
                <th>${detalles["enfermedad"]}</th>
                <th>${detalles["permiso"]}</th>
                <th>${detalles["birthday"]}</th>
            </tr>
        `;
        await $("#reporte_table").append(insert_select);
    }

    return;
}

async function buscar_reporte_mes(tipo_busqueda){
    var year;
    var month;
    if(!tipo_busqueda){
        year = document.getElementById("year_filtro1").value;
        month = document.getElementById("mes_filtro1").value;
        if(month === "Actual"){
            let today = new Date();
            month = today.getMonth() + 1; // Obtiene el mes actual (0 = Enero, 11 = Diciembre) + 1
        }
    }
    else{
        let today = new Date();
        year = today.getFullYear(); // Obtiene el año actual
        month = today.getMonth() + 1; // Obtiene el mes actual (0 = Enero, 11 = Diciembre) + 1
    }

    // Asegurarse de que el mes y el día siempre tienen dos dígitos
    let formattedMonth = String(month).padStart(2, '0'); // Mes entre 0 y 11
    
    const daysInMonth = new Date(year, formattedMonth, 0).getDate();

    // Obtener el número del mes (0-11) y el nombre en español
    const nombre_mes = meses[parseInt(formattedMonth, 10) - 1];

    // Limpiar tabla previa
    const table = document.getElementById("vacationTable");
    table.innerHTML = "";

    // Crear encabezados
    const headerDayName = document.createElement("tr");
    const headerRow = document.createElement("tr");

    // Columna del nombre mes
    const mesHeader = document.createElement("th");
    mesHeader.textContent = nombre_mes;
    mesHeader.classList.add("nombre_dia");
    headerDayName.appendChild(mesHeader);

    // Columna para el nombre
    const nameHeader = document.createElement("th");
    nameHeader.textContent = "Colaborador";
    nameHeader.classList.add("dias_mes");
    headerRow.appendChild(nameHeader);

    // Encabezados de días del mes
    for (let day = 1; day <= daysInMonth; day++) {
        let formattedDay = String(day).padStart(2, '0'); // Día con dos dígitos
        // Crear un objeto Date con el formato YYYY-MM-DD
        let date = new Date(Number(year), Number(formattedMonth) - 1, day);
        // Obtener el número del día de la semana (0-6) y el nombre en español
        let diaSemana = dias[date.getDay()];
        // Fila de Nombre de los días
        let thDia = document.createElement("th");
        thDia.textContent = diaSemana;
        thDia.classList.add("nombre_dia");
        headerDayName.appendChild(thDia);
        // Fila de los días
        let th = document.createElement("th");
        th.textContent = day;
        th.classList.add("dias_mes");
        headerRow.appendChild(th);
    }
    table.appendChild(headerDayName);
    table.appendChild(headerRow);

    // Obtiene el Reporte por el mes y año seleccionado
    var data = await scan_mapa_nave(year, formattedMonth);

    if(data.length === 0){
        return;
    }

    var array_colaboradores = {}

    //Separa a los colaboradores
    for (let i = 0; i < data.length; i++){
        if (!array_colaboradores[data[i].solicitante]){
            array_colaboradores[data[i].solicitante] = {
                "vacation": [],
                "personal-day": [],
                "birthday": [],
                "enfermedad": [],
                "medio-dia": [],
                "nacimiento_adopcion_padre": [],
                "licencia_maternidad_madre": [],
                "licencia_adopcion_madre": [],
                "fallecimiento_familiar": [],
                "permiso": []
            };
        }
    }

    // For para asignación de los días
    for (let y = 0; y < data.length; y++) {
        const desde = data[y].desde;
        const hasta = data[y].hasta;
        const tipo_solicitud = data[y].tipo_solicitud;
        const solicitante = data[y].solicitante;
        
        const fechaInicio = new Date(`${desde}T00:00:00Z`);
        const fechaFin = new Date(`${hasta}T00:00:00Z`);
        const rangoFechas = [];
        
        // Verificar que las fechas sean válidas
        if (isNaN(fechaInicio.getTime()) || isNaN(fechaFin.getTime())) {
            throw new Error('Fechas no válidas');
        }
        
        // Verificar que la fecha de inicio no sea posterior a la fecha fin
        if (fechaInicio > fechaFin) {
            throw new Error('La fecha de inicio no puede ser posterior a la fecha fin');
        }
        
        // Agregar cada fecha al array hasta llegar a la fecha fin
        while (fechaInicio <= fechaFin) {
            const año = fechaInicio.getUTCFullYear();
            const mes = String(fechaInicio.getUTCMonth() + 1).padStart(2, '0');
            const dia = String(fechaInicio.getUTCDate()).padStart(2, '0');
            
            rangoFechas.push(`${año}-${mes}-${dia}`);
            fechaInicio.setUTCDate(fechaInicio.getUTCDate() + 1);
        }

        // Filtrar solo las fechas del mes actual
        const fechasDelMes = filtrarFechasPorMes(rangoFechas, parseInt(month),parseInt(year));

        // For para limpiar los días que son Fin de semana y Festivos
        const fechas_limpias = [];
        for (let x = 0; x < fechasDelMes.length; x++) {
            let fecha = new Date(`${fechasDelMes[x]}T00:00:00Z`);
            // IF para determinar si una fecha es fin de semana o festivo
            const esFinDeSemana = [0, 6].includes(fecha.getUTCDay()); // 0=domingo, 6=sábado
            const esFestivo = festivos.includes(fechasDelMes[x]);           
            if (!esFinDeSemana && !esFestivo) {
                fechas_limpias.push(fechasDelMes[x]);
            }
        }

        // Separa unicamente el día (dd) para la insertar
        const formattedOutput = await formatOutput(fechas_limpias);

        // For por Fecha para guardar los días por colaborador
        for (let z = 0; z < formattedOutput.length; z++) {
            array_colaboradores[solicitante][tipo_solicitud].push(formattedOutput[z]);
        }
    }

    console.log(array_colaboradores);

    // Insertar datos a la tabla
    for (var colaborador in array_colaboradores) {
        // Crear fila para el colaborador
        const vacationRow = document.createElement("tr");
        // Transformar al Colaborador con 2 Nombres
        const split_nombre = colaborador.split(" ");
        // Celda para el nombre del colaborador
        const nameCell = document.createElement("td");
        nameCell.textContent = `${split_nombre[0]} ${split_nombre[1]}`;
        nameCell.classList.add("nombre");
        vacationRow.appendChild(nameCell);

        // Días de Vacaciones
        const vacationDays = array_colaboradores[colaborador]["vacation"];
        // Días de Personales
        const personalDays = array_colaboradores[colaborador]["personal-day"];
        // Días de Cumpleaños
        const birthdayDays = array_colaboradores[colaborador]["birthday"];
        // Días de Medio Día
        const medioDays = array_colaboradores[colaborador]["medio-dia"];
        // Días de Medio Día
        const nacimiento_adopcion_padre_Days = array_colaboradores[colaborador]["nacimiento_adopcion_padre"];
        // Días de Medio Día
        const licencia_maternidad_madre_Days = array_colaboradores[colaborador]["licencia_maternidad_madre"];
        // Días de Medio Día
        const licencia_adopcion_madre_Days = array_colaboradores[colaborador]["licencia_adopcion_madre"];
        // Días de Medio Día
        const fallemientoDays = array_colaboradores[colaborador]["fallecimiento_familiar"];
        // Días de Permisos
        const permisosDays = array_colaboradores[colaborador]["permiso"];
        // Días de Enfermedad
        const enfermedadDays = array_colaboradores[colaborador]["enfermedad"];

        // Celdas para Vacaciones
        for (let day = 1; day <= daysInMonth; day++) {
            const td = document.createElement("td");
            // td.textContent = vacationDays.includes(day) ? "V" : "";
            // Mapeo Vacaciones
            if (vacationDays.includes(day)) {
                td.textContent = "V";
                td.classList.add("event-day-vacation");
            }
            // Mapeo Personales
            if (personalDays.includes(day)) {
                td.textContent = "PD";
                td.classList.add("event-day-personal");
            }
            // Mapeo Cumpleaños
            if (birthdayDays.includes(day)) {
                td.textContent = "C";
                td.classList.add("event-day-birthday");
            }
            // Mapeo Enfermedad
            if (enfermedadDays.includes(day)) {
                td.textContent = "E";
                td.classList.add("event-day-enfermedad");
            }
            // Mapeo Permisos
            if (permisosDays.includes(day)) {
                td.textContent = "P";
                td.classList.add("event-day-permission");
            }
            // Mapeo Medio Día
            if (medioDays.includes(day)) {
                td.textContent = "M";
                td.classList.add("event-medio-dia");
            }
            // Mapeo Maternidad/Paternidad
            if (nacimiento_adopcion_padre_Days.includes(day)) {
                td.textContent = "M/P";
                td.classList.add("event-day-paternidad-maternidad");
            }
            if (licencia_maternidad_madre_Days.includes(day)) {
                td.textContent = "M/P";
                td.classList.add("event-day-paternidad-maternidad");
            }
            if (licencia_adopcion_madre_Days.includes(day)) {
                td.textContent = "M/P";
                td.classList.add("event-day-paternidad-maternidad");
            }
            // Mapeo Fallemiento Familar
            if (fallemientoDays.includes(day)) {
                td.textContent = "F";
                td.classList.add("event-day-fallemiento");
            }
            vacationRow.appendChild(td);
        }

        // Mostrar los días
        table.appendChild(vacationRow);
    }

    return;
}

async function buscar_reporte_year() {
    const year_filtro = document.getElementById("year_filtro2").value;

    // Fecha de inicio del año actual
    const inicioAño = new Date(year_filtro, 0, 1);
    const fechaInicio = inicioAño.toISOString().split('T')[0];

    // Fecha de fin del año actual
    const finAño = new Date(year_filtro, 11, 31);
    const fechaFin = finAño.toISOString().split('T')[0];

    var data = await scan_vacaciones(fechaInicio, fechaFin);

    var reporte = {}

    // Limpiar tabla previa
    const table = document.getElementById("reporte_table");
    table.innerHTML = "";

    if (data === 0){
        return;
    }

    // Ordenar Datos
    for (let i = 0; i < data.length; i++) {
        if (!reporte[data[i].solicitante]){
            reporte[data[i].solicitante] = {
                "personal-day": 0,
                "vacation": 0,
                "birthday": 0,
                "enfermedad": 0,
                "permiso": 0,
                "medio-dia": 0,
                "total": 0
            }
        }
        reporte[data[i].solicitante][data[i].tipo_solicitud] += Number(data[i].dias_solicitados);
        if (data[i].tipo_solicitud === "medio-dia"){
            reporte[data[i].solicitante]["total"] += Number(data[i].dias_solicitados) * 0.5;
        }
        else {
            reporte[data[i].solicitante]["total"] += Number(data[i].dias_solicitados);
        }
    }

    console.log(reporte);

    // Insertas datos
    for (var solicitante in reporte) {
        var detalles = reporte[solicitante];
        let insert_select = `
            <tr>
                <th scope="row">${solicitante}</th>
                <th>${detalles["total"]}</th>
                <th>${detalles["personal-day"]}</th>
                <th>${detalles["vacation"]}</th>
                <th>${detalles["medio-dia"]}</th>
                <th>${detalles["enfermedad"]}</th>
                <th>${detalles["permiso"]}</th>
                <th>${detalles["birthday"]}</th>
            </tr>
        `;
        await $("#reporte_table").append(insert_select);
    }

    return;
}

async function scan_vacaciones(fechaInicio, fechaFin) {
    var params = {
        TableName: "NAVE_Vacaciones",
        FilterExpression: "(#desde <= :fcF and #hasta >= :fcI) and (#estatus = :estatus or #estatus = :estatus2)",
        ExpressionAttributeNames: {
            "#hasta": "hasta",
            "#desde": "desde",
            "#estatus": "estatus"
        },
        ExpressionAttributeValues: {
            ":fcI": fechaInicio,
            ":fcF": fechaFin,
            ":estatus": "Aprobado",
            ":estatus2": "Pendiente de Aprobación"
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
    return data;    
}

//Scan de la información de todo el equipo NAVE
async function scan_mapa_nave(year, month) {
    const daysInMonth = new Date(year, month, 0).getDate();
    var params = {
        TableName: "NAVE_Vacaciones",
        FilterExpression: "(#desde <= :fcF and #hasta >= :fcI) and (#estatus = :estatus or #estatus = :estatus2)",
        ExpressionAttributeNames: {
            "#hasta": "hasta",
            "#desde": "desde",
            "#estatus": "estatus"
        },
        ExpressionAttributeValues: {
            ":fcI": `${year}-${month}-01`,
            ":fcF": `${year}-${month}-${daysInMonth}`,
            ":estatus": "Aprobado",
            ":estatus2": "Pendiente de Aprobación"
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
    return data;    
}

//Divide los días de la fecha para insertarlos en un array
async function formatOutput(outputArray) {
    return outputArray.map(dateString => {
        const dateParts = dateString.split('-');
        const day = parseInt(dateParts[2]);
        return day;
    });
}

//Filtrado de fechas por el mes seleccionado
function filtrarFechasPorMes(fechas, mes, año) {
    // mes es 1-12 (enero=1, febrero=2, ..., diciembre=12)
    return fechas.filter(fecha => {
        const partes = fecha.split('-');
        return parseInt(partes[0]) === año && parseInt(partes[1]) === mes;
    });
}

//Obtener Colaboradores en los filtros
async function obtener_colaboradores() {
    var params = {
        TableName: "NAVE_Vacaciones",
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

    const colaboradores = {};

    for (let i = 0; i < data.length; i++) {
        const nombre = data[i].solicitante;
        const correo = data[i].correo_solicitante;

        if(!colaboradores[nombre]){
            colaboradores[nombre] = {
                "correo": correo
            };
        }
    }

    for (var colaborador in colaboradores) {
        let insert_select = `
            <option value="${colaboradores[colaborador].correo}">${colaborador}</option>
        `;
        await $("#colaborador_saldo").append(insert_select);

    }

    return
}

async function buscar_saldo_colaborador() {
    const colaborador = document.getElementById("colaborador_saldo").value;
    if (colaborador === "null") {
        return;
    }
    const payload_lambda = {
        "correo": colaborador,
    };
    const params_lambda = {
        FunctionName: 'Obtener_Saldos_Beneficios',
        InvocationType: 'RequestResponse', //RequestResponse or Event
        LogType: 'Tail',
        Payload: JSON.stringify(payload_lambda)
    };
    var data_lambda = await lambda.invoke(params_lambda).promise();
    data_lambda = JSON.parse(data_lambda.Payload);

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
