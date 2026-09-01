// Globales para el calendario
const holidays = {
    '2024-01-01': 'Año Nuevo',
    '2024-02-05': 'Aniversario de la constitución',
    '2024-03-18': 'Natalicio Benito Juárez',
    '2024-05-01': 'Día del Trabajo',
    '2024-09-16': 'Día de la Independencia',
    '2024-11-18': 'Revolución Mexicana',
    '2024-12-25': 'Navidad',
    '2025-01-01': 'Año Nuevo',
    '2025-02-03': 'Aniversario de la constitución',
    '2025-03-17': 'Natalicio Benito Juárez',
    '2025-04-17': 'Semana Santa', 
    '2025-04-18': 'Semana Santa', 
    '2025-05-01': 'Día del Trabajo',
    '2025-09-16': 'Día de la Independencia',
    '2025-11-17': 'Revolución Mexicana',
    '2025-12-24': 'Noche Buena',
    '2025-12-25': 'Navidad',
    '2025-12-31': 'Ultimo día del Año',
    '2026-01-01': 'Año Nuevo',
    '2026-02-02': 'Aniversario de la constitución',
    '2026-03-16': 'Natalicio Benito Juárez',
    '2026-04-02': 'Semana Santa', 
    '2026-04-03': 'Semana Santa', 
    '2026-05-01': 'Día del Trabajo',
    '2026-09-16': 'Día de la Independencia',
    '2026-11-16': 'Revolución Mexicana',
    '2026-12-24': 'Noche Buena',
    '2026-12-25': 'Navidad',
    '2026-12-31': 'Ultimo día del Año',
    '2027-01-01': 'Año Nuevo',
};

const eventTypeClass = {
    "vacation": "event-day-vacation",
    "personal-day": "event-day-personal",
    "birthday": "event-day-birthday",
    "enfermedad": "event-day-enfermedad",
    "medio-dia": "event-day-medio-dia",
    "permiso": "event-day-permission",
    "nacimiento_adopcion_padre": "event-day-paternidad-maternidad",
    "licencia_maternidad_madre": "event-day-paternidad-maternidad",
    "licencia_adopcion_madre": "event-day-paternidad-maternidad",
    "fallecimiento_familiar": "event-day-fallemiento"
};

const eventDic = {
    "vacation": "Vacaciones",
    "personal-day": "Dia Personal",
    "birthday": "Dia de Cumpleaños",
    "enfermedad": "Enfermedad",
    "medio-dia": "Medio dia",
    "permiso": "Permiso sin goce de sueldo",
    "nacimiento_adopcion_padre": "Nacimiento y/o adopción (padre)",
    "licencia_maternidad_madre": "Licencia de maternidad",
    "licencia_adopcion_madre": "Liciencia adopción (madre)",
    "fallecimiento_familiar": "Fallecimiento Familiar"
}

// Globales para el mapeo de NAVE
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

const calendar = document.getElementById('calendar');
const eventModal = new bootstrap.Modal(document.getElementById('eventModal'));
let selectedDate = null;
var user_vacation_array; //Array de vacaciones
var pagina_calendario = 0;

function getPortalUrl() {
    if (window.NAVE_PORTAL_URL) {
        return window.NAVE_PORTAL_URL;
    }
    if (window.location.protocol === "http:" || window.location.protocol === "https:") {
        return window.location.origin;
    }
    return "";
}

/***********************************************************
*********************** [CALENDARIO] ***********************
***********************************************************/

//Función inicial para crear y mostrar el calendario
async function create_calendar() {

    const date_data = await get_date_data(); //Obtiene la informacion de la fecha actual o de pagina

    //Limpiar calendario y array de objetos de vacaciones
    calendar.innerHTML = '';
    user_vacation_array = [];
    
    await cargar_infor_user(date_data.year, date_data.month); //Actualizacion y carga de las vacaciones
    
    //Obtiene los días del mes y el primer día
    const daysInMonth = new Date(date_data.year, date_data.month, 0).getDate();
    const startDay = new Date(date_data.year, date_data.month - 1, 1).getDay();

    // Crear días vacíos para alineación
    Array.from({ length: startDay }).forEach(() => 
        calendar.appendChild(document.createElement('div')));
    
    // Crear días del mes
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(date_data.year, date_data.month - 1, day);
        //Transforma en formato "yyyy-mm-dd"
        let año = date.getFullYear();
        let mes = String(date.getMonth() + 1).padStart(2, '0');
        let dia = String(date.getDate()).padStart(2, '0');
        let formattedDate = `${año}-${mes}-${dia}`;
        const dayElement = await createDayElement(date, formattedDate);
        calendar.appendChild(dayElement);
    }

    await processVacationDays();
    await updateCalendarTitle(date_data.month, date_data.year);
}

// Función para obtener la fecha actual
async function get_date_data(){
    // Configurar la zona horaria 'America/Monterrey'
    const options = {
        timeZone: 'America/Monterrey',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false // Formato 24 horas
    };
    
    const formatter = new Intl.DateTimeFormat('es-MX', options);
    const parts = formatter.formatToParts(new Date());
    
    // Extraer las partes de la fecha
    const currentYear = Number(parts.find(p => p.type === 'year').value);
    const currentMonth = Number(parts.find(p => p.type === 'month').value);
    const day = parts.find(p => p.type === 'day').value;
    const hour = parts.find(p => p.type === 'hour').value;
    const minute = parts.find(p => p.type === 'minute').value;
    const second = parts.find(p => p.type === 'second').value;
    const monthCursor = currentMonth - 1 + pagina_calendario;
    const normalizedYear = currentYear + Math.floor(monthCursor / 12);
    const normalizedMonth = ((monthCursor % 12) + 12) % 12 + 1;

    return {
        year: String(normalizedYear),
        month: String(normalizedMonth).padStart(2, '0'),
        day: day,
        hour: hour,
        minute: minute,
        second: second
    }
}

//Scan de las vacaciones del usuario logeado
async function cargar_infor_user() {
    const correo_solicitante = localStorage.getItem('correo');
    const params = {
        TableName: "NAVE_Vacaciones",
        FilterExpression: "(#correo_solicitante = :correo_solicitante) and (#estatus = :estatus or #estatus = :estatus2)",
        ExpressionAttributeNames: {
            "#correo_solicitante": "correo_solicitante",
            "#estatus": "estatus"
        },
        ExpressionAttributeValues: {
            ":correo_solicitante": correo_solicitante,
            ":estatus": "Aprobado",
            ":estatus2": "Pendiente de Aprobación"
        }
    };

    try {
        let response = await docClient.scan(params).promise();
        user_vacation_array = [...response.Items];
        
        while (response.LastEvaluatedKey) {
            params.ExclusiveStartKey = response.LastEvaluatedKey;
            response = await docClient.scan(params).promise();
            user_vacation_array.push(...response.Items);
        }
    } catch (error) {
        console.error("Error al cargar información del usuario:", error);
        user_vacation_array = [];
    }
}

//Crea los días del calendario
async function createDayElement(date, formattedDate) {
    const dayElement = document.createElement('div');
    dayElement.classList.add('calendar-day');
    dayElement.textContent = date.getDate();
    dayElement.id = formattedDate;

    // Marcar fines de semana y festivos
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const isHoliday = holidays[formattedDate];
    
    
    if (isWeekend || isHoliday) {
        dayElement.classList.add('disabled');
        if (isHoliday) {
            dayElement.classList.add('holiday');
            dayElement.setAttribute('title', holidays[formattedDate]);
        }
    } else {
        dayElement.addEventListener('click', () => selectDate(formattedDate));
    }

    return dayElement;
}

//Selección de día para el formulario
async function selectDate(formattedDate) {
    selectedDate = formattedDate;
    document.getElementById("startDate").value = selectedDate;
    document.getElementById("endDate").value = selectedDate;
    await validar_dias_form();
    eventModal.show();
}

//Función que pinta los días en el calendario
async function processVacationDays() {
    for (const vacation of user_vacation_array) {
        const dates = await getDatesInRange_BD(vacation.desde, vacation.hasta); //Obtiene los días dentro del rango
        
        for (const date of dates) {
            try {
                const isHoliday = holidays[date.toISOString().split('T')[0]];
                if (date.getDay() !== 0 && date.getDay() !== 6  && !isHoliday) {
                    const element = date.toISOString().split('T')[0];
                    const dayElement = document.getElementById(element);
                    if (dayElement) {
                        dayElement.classList.add(eventTypeClass[vacation.tipo_solicitud]);
                        dayElement.dataset.eventType = vacation.tipo_solicitud;
                        dayElement.classList.add('disabled');
                    }
                }
            } catch (error) {
                console.error("Error procesando día de vacaciones:", error);
            }
        }
    }
}

//Función para obtener los días dentro de un rango
async function getDatesInRange_BD(startDate, endDate) {
    // Asegurar que las fechas sean tratadas en hora local
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);
    
    // Validación para fechas iguales
    if (start.getTime() === end.getTime()) {
        return [new Date(start)];
    }

    const dateArray = [];
    let currentDate = new Date(start);

    while (currentDate <= end) {
        dateArray.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
    }

    return dateArray;
}

//Actualiza el titulo del calendario (MES)
async function updateCalendarTitle(month, year) {
    const currentMonthLabel = document.getElementById('currentMonth');
    currentMonthLabel.textContent = `${meses[parseInt(month, 10) - 1]} ${year}`;
    return;
}

// Agregar eventos a los botones de navegación
document.getElementById('prevMonth').addEventListener('click', () => changeMonth("-"));
document.getElementById('nextMonth').addEventListener('click', () => changeMonth("+"));

// Función para cambiar de mes
async function changeMonth(offset) {
    if (offset === "-"){
        pagina_calendario -= 1;
    }
    else { // +
        pagina_calendario += 1;
    }
    await create_calendar();
    return;
}

/***********************************************************
************************ [MAPA NAVE] ***********************
***********************************************************/

//Función para cargar el mapa NAVE
async function mostrar_mapa() {
    await crear_mapa_nave();

    $('#programacion_modal').modal({
        backdrop: 'static',
        keyboard: false
    });
    $('#programacion_modal').modal('show');

    return;
}

//Se ejecuta con el boton de mostrar_mapa y hace la carga de la información
async function crear_mapa_nave(){
    const date_data = await get_date_data(); //Obtiene la informacion de la fecha actual o de pagina
    
    const daysInMonth = new Date(date_data.year, date_data.month, 0).getDate(); //Obtiene los días del mes

    // Obtener el número del mes (0-11) y el nombre en español
    const nombre_mes = meses[parseInt(date_data.month, 10) - 1];

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
        let date = new Date(Number(date_data.year), Number(date_data.month) - 1, day);
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
    var data = await scan_mapa_nave(date_data.year, date_data.month);

    //Si no hay datos, regresa el mapa sin información
    if(data.length === 0){
        return;
    }

    //Array de los colaboradores con Vacaciones en el mes
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
        const fechasDelMes = filtrarFechasPorMes(rangoFechas, parseInt(date_data.month),parseInt(date_data.year));

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

/***********************************************************
************************ [FORMULARIO] **********************
***********************************************************/

//Valida el saldo y los días a pedir
async function validar_dias_form() {
    const saldo = await obtener_saldo();
    const startDate = document.getElementById("startDate").value;
    const endDate = document.getElementById("endDate").value;
    const eventType = document.getElementById("eventType").value;
    const event_dic = {
        "vacation": "vacaciones",
        "personal-day": "dias_personales",
        "birthday": "cumpleaños",
        "nacimiento_adopcion_padre": "paternidad",
        "licencia_maternidad_madre": "maternidad",
        "licencia_adopcion_madre": "adopcion_madre",
        "fallecimiento_familiar": "fallecimiento"
    }

    //Obtiene las fecha a solicitar quitando Fin de semana y Festivos
    const dates = await getDatesInRange_BD(startDate, endDate);
    const workDays = dates.filter(date => {
        // Asegurar que sea objeto Date si viene como string
        const fecha = date instanceof Date ? date : new Date(date);
        
        // Obtener día de la semana (0=domingo, 1=lunes,..., 6=sábado)
        const diaSemana = fecha.getUTCDay(); // Usar UTC para evitar problemas horarios
        
        // Convertir a formato ISO para comparar con festivos (YYYY-MM-DD)
        const fechaISO = fecha.toISOString().split('T')[0];
        
        // Filtrar: no es fin de semana (domingo=0 o sábado=6) ni es festivo
        return diaSemana !== 0 && diaSemana !== 6 && !festivos.includes(fechaISO);
    });

    let saldo_event;
    if (eventType === "enfermedad"){
        saldo_event = "-";
        document.getElementById("saldo_formulario").value = saldo_event;
        document.getElementById("dias_pedir_formulario").value = workDays.length;    
    }
    else if (eventType === "permiso"){
        saldo_event = "-";
        document.getElementById("saldo_formulario").value = saldo_event;
        document.getElementById("dias_pedir_formulario").value = workDays.length;    
    }
    else if (eventType === "medio-dia"){
        saldo_event = saldo["dias_personales"];
        document.getElementById("saldo_formulario").value = saldo_event;
        document.getElementById("dias_pedir_formulario").value = workDays.length / 2;    
    }
    else { //Resto de eventos
        saldo_event = saldo[event_dic[eventType]];
        document.getElementById("saldo_formulario").value = saldo_event;
        document.getElementById("dias_pedir_formulario").value = workDays.length;    
    }

    if (saldo_event === "-"){
        document.getElementById("dias_pedir_formulario").className = "form-control form_dias_solicitar_correcto"
        return;
    }

    const dias_pedir = Number(document.getElementById("dias_pedir_formulario").value);
    if (Number(saldo_event) < dias_pedir) {
        document.getElementById("dias_pedir_formulario").className = "form-control form_dias_solicitar_insuficiente"
        return;
    }
    else {
        document.getElementById("dias_pedir_formulario").className = "form-control form_dias_solicitar_correcto"
        return;
    }
}

// Manejar el formulario de eventos para el alta de vacaciones
document.getElementById('eventForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = await getFormData();
    const validation = await validateRequest(formData);
    
    if (!validation.valid) {
        showAlert(validation.message);
        eventModal.hide();
        return;
    }

    const requestData = await prepareRequestData(formData);
    await saveRequest(requestData);
    
    await sendNotifications(requestData);
    showAlert(`La solicitud ha sido enviada a: ${formData.aprobador_email} con éxito!!`);
    eventModal.hide();
});

//Obtiene la información llenada por el usuario en el formulario
async function getFormData() {
    return {
        eventType: document.getElementById('eventType').value,
        startDate: document.getElementById('startDate').value,
        endDate: document.getElementById('endDate').value,
        aprobador_email: document.getElementById('aprobador_email').value,
        descripcion_solicitud: document.getElementById('descripcion_solicitud').value || "N/A"
    };
}

//Valida que no se haya pedido días
async function validateRequest({ startDate, endDate }) {
    // Validacion Saldo
    const saldo = Number(document.getElementById("saldo_formulario").value);
    const dias_pedir = Number(document.getElementById("dias_pedir_formulario").value);    
    if (saldo < dias_pedir) {
        return {
            valid: false,
            message: "Error al enviar la solicitud, no tiene el suficiente saldo. Favor de validar"
        };
    }

    // Validaciones en BD
    const validation = await validar_dias(startDate, endDate);
    if (validation.response === 400) {
        return {
            valid: false,
            message: "La solicitud no se pudo procesar ya que el rango de fechas ya coincide con otras solicitudes"
        };
    }
    //Obtiene las fecha a solicitar quitando Fin de semana y Festivos
    const dates = await getDatesInRange_BD(startDate, endDate);
    const workDays = dates.filter(date => {
        // Asegurar que sea objeto Date si viene como string
        const fecha = date instanceof Date ? date : new Date(date);
        
        // Obtener día de la semana (0=domingo, 1=lunes,..., 6=sábado)
        const diaSemana = fecha.getUTCDay(); // Usar UTC para evitar problemas horarios
        
        // Convertir a formato ISO para comparar con festivos (YYYY-MM-DD)
        const fechaISO = fecha.toISOString().split('T')[0];
        
        // Filtrar: no es fin de semana (domingo=0 o sábado=6) ni es festivo
        return diaSemana !== 0 && diaSemana !== 6 && !festivos.includes(fechaISO);
    });
    if (workDays.length === 0){
        return {
            valid: false,
            message: "Error al mandar la solcitud, favor de verificar las fechas a solicitar"
        };
    }
    return { valid: true };
}

//Scan para saber si ya existe días registrados por el colaborador que empate con su solicitud
async function validar_dias(startDate, endDate) {
    const correo_solicitante = localStorage.getItem('correo');
    const params = {
        TableName: "NAVE_Vacaciones",
        FilterExpression: "#correo_solicitante = :correo AND #desde <= :fcF AND #hasta >= :fcI AND (#estatus = :estatus OR #estatus = :estatus2)",
        ExpressionAttributeNames: {
            "#correo_solicitante": "correo_solicitante",
            "#desde": "desde",
            "#hasta": "hasta",
            "#estatus": "estatus"
        },
        ExpressionAttributeValues: {
            ":correo": correo_solicitante,
            ":fcI": startDate,
            ":fcF": endDate,
            ":estatus": "Aprobado",
            ":estatus2": "Pendiente de Aprobación"
        }
    };

    try {
        const data = await getAllScanResults(params);
        return { response: data.length === 0 ? 200 : 400 };
    } catch (error) {
        console.error("Error validando días:", error);
        return { response: 400 };
    }
}

//En caso que se requiera escanea más datos
async function getAllScanResults(params) {
    let results = [];
    let response = await docClient.scan(params).promise();
    results = [...response.Items];
    
    while (response.LastEvaluatedKey) {
        params.ExclusiveStartKey = response.LastEvaluatedKey;
        response = await docClient.scan(params).promise();
        results.push(...response.Items);
    }
    
    return results;
}

//Prepara la información a insertar
async function prepareRequestData({ eventType, startDate, endDate, descripcion_solicitud }) {
    const dates = await getDatesInRange_BD(startDate, endDate);
    const workDays = dates.filter(date => {
        // Asegurar que sea objeto Date si viene como string
        const fecha = date instanceof Date ? date : new Date(date);
        
        // Obtener día de la semana (0=domingo, 1=lunes,..., 6=sábado)
        const diaSemana = fecha.getUTCDay(); // Usar UTC para evitar problemas horarios
        
        // Convertir a formato ISO para comparar con festivos (YYYY-MM-DD)
        const fechaISO = fecha.toISOString().split('T')[0];
        
        // Filtrar: no es fin de semana (domingo=0 o sábado=6) ni es festivo
        return diaSemana !== 0 && diaSemana !== 6 && !festivos.includes(fechaISO);
    });
    for (let i = 0; i < workDays.length; i++) {
        try {
            const element = workDays[i].toISOString().split('T')[0];
            const selectedDayElement = document.getElementById(element);
            selectedDayElement.classList.add(eventTypeClass[eventType]);
            selectedDayElement.dataset.eventType = eventType;
            selectedDayElement.classList.add('disabled');
        } catch (error) {}
    }
    // const workDays = dates.filter(date => date.getDay() !== 5 && date.getDay() !== 6 && !festivos.includes(date));
    
    return {
        eventType,
        startDate,
        endDate,
        descripcion_solicitud,
        dias_solicitados: workDays.length,
        userData: {
            nombre: localStorage.getItem('nombre'),
            apellido: localStorage.getItem('apellido'),
            correo: localStorage.getItem('correo')
        }
    };
}

//Guarda la solicitud en la Base de datos DynamoDB
async function saveRequest({ eventType, startDate, endDate, descripcion_solicitud, dias_solicitados, userData }) {
    const params = {
        TableName: "NAVE_Vacaciones",
        Item: {
            id: await obtenerId(),
            tipo_solicitud: eventType,
            desde: startDate,
            hasta: endDate,
            aprobador: document.getElementById('aprobador_email').value,
            descripcion: descripcion_solicitud,
            dias_solicitados: dias_solicitados.toString(),
            solicitante: `${userData.nombre} ${userData.apellido}`,
            correo_solicitante: userData.correo,
            estatus: "Pendiente de Aprobación"
        }
    };
    
    await docClient.put(params).promise();
    return params.Item;
}

//Envia la notificacion via Email y Teams
async function sendNotifications({ eventType, startDate, endDate, dias_solicitados, userData }) {
    const eventName = eventDic[eventType];
    const portalUrl = getPortalUrl();
    const portalMessage = portalUrl
        ? `La aprobación o rechazo es mediante el portal de Vacaciones: ${portalUrl}`
        : "La aprobación o rechazo es mediante el portal de Vacaciones.";
    const baseMessage = `Se recibió una solicitud de tipo: "${eventName}" por parte de ${userData.nombre} ${userData.apellido}
Días Solicitados: ${dias_solicitados}
Desde: ${startDate}
Hasta: ${endDate}`;

    const approverPayload = {
        email_to: document.getElementById('aprobador_email').value,
        body: `${baseMessage}\n${portalMessage}`,
        subject: `Solicitud ${eventName} de ${userData.nombre} ${userData.apellido}`
    };

    const userPayload = {
        email_to: userData.correo,
        body: `${baseMessage}\nSe le notificará cuando esta sea aprobada o rechazada`,
        subject: `Solicitud ${eventName} de ${userData.nombre} ${userData.apellido}`
    };

    const teamsPayload = {
        Mensaje: `${baseMessage}\n${portalMessage}`
    };

    await Promise.all([
        invokeLambda('Send_Email', approverPayload),
        invokeLambda('Send_Email', userPayload),
        invokeLambda('Send_Team_MSG', teamsPayload)
    ]);
}

//Lambda para envio de notificaciones
async function invokeLambda(functionName, payload) {
    const params = {
        FunctionName: functionName,
        InvocationType: 'Event',
        Payload: JSON.stringify(payload)
    };
    return lambda.invoke(params).promise();
}

//Obtiene el saldo de vacaciones o beneficio a solicitar
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

    return data_lambda.response.saldo; 
}

function showAlert(message) {
    document.getElementById("mensaje_solicitud").textContent = message;
    document.getElementById("myAlert").classList.add('show');
    setTimeout(() => {
        try {
            document.getElementById("myAlert").classList.remove('show');
        } catch (error) {}
    }, 10000);
}

async function cerrar_alerta() {
    document.getElementById("myAlert").classList.remove('show');
}

//OBTENER ID
async function obtenerId() {
    const now = new Date();
    return [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0'),
        String(now.getHours()).padStart(2, '0'),
        String(now.getMinutes()).padStart(2, '0'),
        String(now.getSeconds()).padStart(2, '0')
    ].join('');
}

function esperar(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
