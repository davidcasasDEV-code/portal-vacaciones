// El portal de vacaciones se migro a /vacaciones (Next.js), con su propia
// autorizacion server-side. Aqui solo se decide que enlaces mostrar; el rol
// ya viene resuelto por el servidor (window.naveEnsureSession, en
// legacy-session.js) y no se vuelve a consultar DynamoDB desde el navegador.
async function obtener_permisos() {
    const permisos = localStorage.getItem('permisos');

    if (permisos === "Admin"){
        let insert_select = `
            <li><a class="dropdown-item" href="/aprobaciones">Aprobación de Vacaciones</a></li>
            <li><a class="dropdown-item" href="/reportes">Reporte de Vacaciones</a></li>
        `;
        await $("#lista_vacaciones").append(insert_select);
    }
    else {
        let insert_select = `
            <li><a class="dropdown-item" href="/vacaciones">Registrar Vacaciones</a></li>
            <li><a class="dropdown-item" href="/mis-solicitudes">Mis Solicitudes de Vacaciones</a></li>
        `;
        await $("#lista_vacaciones").append(insert_select);
    }
    return;
}
