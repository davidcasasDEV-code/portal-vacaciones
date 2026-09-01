async function registrarse() {
    var nombre_registro = document.getElementById("nombre").value;
    var apellido_registro = document.getElementById("apellido").value;
    var correo_registro = document.getElementById("email").value;
    var contra_registro = document.getElementById("password").value;
    var genero_registro = document.getElementById("genero").value;
    var fecha_ingreso_registro = document.getElementById("fecha_ingreso").value;
    var fecha_nacimiento_registro = document.getElementById("fecha_nacimiento").value;

    if (
        !nombre_registro || !apellido_registro || !correo_registro || !contra_registro || !genero_registro || !fecha_ingreso_registro || !fecha_nacimiento_registro || 
        nombre_registro === "" || apellido_registro === "" || correo_registro === "" || genero_registro === "" || fecha_ingreso_registro === "" || fecha_nacimiento_registro === "" || contra_registro === ""
    ) {
        document.getElementById("mensaje_modal").innerHTML = "Favor de llenar todos los campos para el registro";
        $('#loginModal').modal('show');
        return;
    }

    const validate_user = await validar_usuario(correo_registro);

    if(validate_user.response === 400){
        return;
    }

    var hash_pass = await sjcl.codec.hex.fromBits(sjcl.hash.sha256.hash(contra_registro));

    fecha_ingreso_registro = fecha_ingreso_registro.split("-");
    fecha_nacimiento_registro = fecha_nacimiento_registro.split("-");

    const params = {
        TableName: "NAVE_Reporte_Usuarios_Web",
        Key: {
            "correo": correo_registro.toLowerCase()
        },
        ExpressionAttributeValues: {
            ":var1": nombre_registro,
            ":var2": apellido_registro,
            ":var3": hash_pass,
            ":var4": genero_registro,
            ":var5": `${fecha_ingreso_registro[2]}/${fecha_ingreso_registro[1]}/${fecha_ingreso_registro[0]}`,
            ":var6": `${fecha_nacimiento_registro[2]}/${fecha_nacimiento_registro[1]}/${fecha_nacimiento_registro[0]}`,
        },
        UpdateExpression: "SET nombre = :var1, apellido = :var2, password = :var3, sexo = :var4, fecha_ingreso = :var5, fecha_nacimiento = :var6"
    };

    await docClient.update(params).promise();

    // Guardar datos en localStorage
    localStorage.setItem('nombre', nombre_registro);
    localStorage.setItem('apellido', apellido_registro);
    localStorage.setItem('correo', correo_registro);
    localStorage.setItem('permisos', validate_user.permisos);
    
    return window.location.href = "index.html";
}

async function validar_usuario(correo) {
    const params = {
        TableName: "NAVE_Reporte_Usuarios_Web",
        Key: {
            "correo": correo.toLowerCase()
        }
    };

    const data = await docClient.get(params).promise();
    const user = data.Item;

    if (user && user.password) {
        document.getElementById("mensaje_modal").innerHTML = "Ya cuenta con un usuario, favor de iniciar sesión o recuperar tu cuenta";
        $('#loginModal').modal('show');
        return {"response": 400};
    }
    else if (user && user.permisos){
        return {"response": 200, "permisos": user.permisos};
    }
    else{
        document.getElementById("mensaje_modal").innerHTML = "Tu correo no cuenta con acceso a este sitio, favor de validar con los administradores";
        $('#loginModal').modal('show');
        return {"response": 400};
    }
}