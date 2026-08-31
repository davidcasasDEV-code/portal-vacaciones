async function obtener_permisos() {
    const params = {
        TableName: "NAVE_Reporte_Usuarios_Web",
        Key: {
            "correo": localStorage.getItem('correo')
        }
    };

    const data = await docClient.get(params).promise();

    if (data.Item.permisos === "Admin"){
        let insert_select = `
            <li><a class="dropdown-item" href="aprobacion_vacaciones.html">Aprobación de Vacaciones</a></li>
            <li><a class="dropdown-item" href="reporte_vacaciones.html">Reporte de Vacaciones</a></li>
        `;
        await $("#lista_vacaciones").append(insert_select);
    }
    else if (data.Item.permisos === "Usuario"){
        let insert_select = `
            <li><a class="dropdown-item" href="vacaciones.html">Registrar Vacaciones</a></li>
            <li><a class="dropdown-item" href="solicitudes_vacaciones.html">Mis Solicitudes de Vacaciones</a></li>
        `;
        await $("#lista_vacaciones").append(insert_select);
    }
    else {
        let insert_select = `
            <li><a class="dropdown-item" href="vacaciones.html">Registrar Vacaciones</a></li>
            <li><a class="dropdown-item" href="solicitudes_vacaciones.html">Mis Solicitudes de Vacaciones</a></li>
            <li><a class="dropdown-item" href="aprobacion_vacaciones.html">Aprobación de Vacaciones</a></li>
            <li><a class="dropdown-item" href="reporte_vacaciones.html">Reporte de Vacaciones</a></li>
        `;
        await $("#lista_vacaciones").append(insert_select);
    }
    return;
}