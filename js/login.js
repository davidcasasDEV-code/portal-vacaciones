async function iniciar_sesion() {
    var correo_login = document.getElementById("email").value;
    var contra_login = document.getElementById("password").value;

    if (!correo_login || !contra_login || correo_login === "" || contra_login === "") {
        document.getElementById("mensaje_modal").innerHTML = "Favor de llenar los campos de Correo y Contraseña";
        $('#loginModal').modal('show');
        return;
    }

    var hash_pass = await sjcl.codec.hex.fromBits(sjcl.hash.sha256.hash(contra_login));

    const params = {
        TableName: "NAVE_Reporte_Usuarios_Web",
        Key: {
            "correo": correo_login.toLowerCase()
        }
    };
    const data = await docClient.get(params).promise();
    const user = data.Item;

    if (!user || hash_pass !== user.password) {
        document.getElementById("mensaje_modal").innerHTML = "Correo o Contraseña incorrectas, favor de validar la información";
        $('#loginModal').modal('show');
        return;
    }

    // Guardar datos en localStorage
    localStorage.setItem('nombre', user.nombre);
    localStorage.setItem('apellido', user.apellido);
    localStorage.setItem('correo', correo_login);
    localStorage.setItem('permisos', user.permisos);

    return window.location.href = "index.html";
}