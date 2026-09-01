async function abrir_modal_perfil() {
    $('#modal_perfil').modal({
        backdrop: 'static',
        keyboard: false
    });
    $('#modal_perfil').modal('show');
    return;
}

async function cerrar_sesion(){
    localStorage.removeItem('nombre');
    localStorage.removeItem('apellido');
    localStorage.removeItem('correo');
    localStorage.removeItem('permisos');

    return window.location.href = "login.html";
}