// Puente de sesion para las paginas legado que NO forman parte de esta
// migracion (Reporte de Capacidad TI / Reporte MVP's). El portal ahora usa
// una cookie httpOnly (ver /login) en vez de guardar la sesion en
// localStorage. Estas dos paginas siguen leyendo localStorage, asi que este
// script la rellena a partir de la sesion real antes de que corran.
window.naveEnsureSession = async function () {
    try {
        const response = await fetch("/api/auth/session", { credentials: "same-origin" });
        if (!response.ok) {
            window.location.href = "/login";
            return false;
        }
        const user = await response.json();
        localStorage.setItem("correo", user.correo);
        localStorage.setItem("nombre", user.nombre);
        localStorage.setItem("apellido", user.apellido);
        localStorage.setItem("permisos", user.rol);
        return true;
    } catch (error) {
        window.location.href = "/login";
        return false;
    }
};
