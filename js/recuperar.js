async function recuperar(){
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const codigo = document.getElementById("codigo").value;

    if (!codigo) {
        // Generar Codigo
        const codigo_verificacion = await generar_codigo();
        // Insertar Codigo en la BD
        await insertar_codigo(codigo_verificacion, email);
        // Envio del Correo para el codigo
        const payload_lambda = {
            "email_to": email,
            "body": `Se recibio una solicitud para cambio de contraseña, el codigo es: ${codigo_verificacion}`,
            "subject": `Restablecer Contraseña Portal DOTI`
        };
        const params_lambda = {
            FunctionName: 'Send_Email',
            InvocationType: 'Event', //RequestResponse or Event
            LogType: 'Tail',
            Payload: JSON.stringify(payload_lambda)
        };
        await lambda.invoke(params_lambda).promise();

        document.getElementById("codigo-recuperar").classList.remove('codigo-recuperar-hide');

        return;
    }

    const response_validacion = await validar_codigo(email, codigo);

    if (response_validacion === true){
        await cambiar_contra(email, password);
        const user = await obtener_datos(email);
        // Guardar datos en localStorage
        localStorage.setItem('nombre', user.nombre);
        localStorage.setItem('apellido', user.apellido);
        localStorage.setItem('correo', email);
        localStorage.setItem('permisos', user.permisos);

        return window.location.href = "index.html";
    }
    else{
        document.getElementById("mensaje_modal").innerHTML = "Codigo incorrecto, favor de validar el correo e intentar de nuevo";
        $('#loginModal').modal('show');
        return;
    }
}

async function generar_codigo() {
    let codigo = '';
    for (let i = 0; i < 5; i++) {
        codigo += Math.floor(Math.random() * 10);
    }
    return codigo;
}

async function insertar_codigo(codigo_verificacion, email) {
    const params = {
        TableName: "NAVE_Recuperar_Cuenta",
        Item: {
            "correo": email.toLowerCase(),
            "codigo": codigo_verificacion
        }
    };
    await docClient.put(params).promise();
    return;
}

async function validar_codigo(email, codigo) {
    const params = {
        TableName: "NAVE_Recuperar_Cuenta",
        Key: {
            "correo": email.toLowerCase()
        }
    };
    const data = await docClient.get(params).promise();
    if (data.Item.codigo === codigo) {
        return true;
    }
    else{
        return false;
    }
}

async function cambiar_contra(email, password) {
    var hash_pass = await sjcl.codec.hex.fromBits(sjcl.hash.sha256.hash(password));
    const params = {
        TableName: "NAVE_Reporte_Usuarios_Web",
        Key: {
            "correo": email.toLowerCase()
        },
        ExpressionAttributeValues: {
            ":var1": hash_pass,
        },
        UpdateExpression: "SET password = :var1"
    };
    await docClient.update(params).promise();
    return;
}

async function obtener_datos(email) {
    const params = {
        TableName: "NAVE_Reporte_Usuarios_Web",
        Key: {
            "correo": email.toLowerCase()
        }
    };
    const data = await docClient.get(params).promise();
    const user = data.Item;
    return user;
}