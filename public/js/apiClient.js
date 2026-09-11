// Cliente minimo para las 2 paginas legado que NO forman parte de esta
// migracion (Reporte de Capacidad TI / Reporte MVP's). Todas las llamadas
// van al mismo origen (Next.js), que valida sesion y tabla/lambda
// permitidos server-side. Ya no existe un modo con credenciales de AWS en
// el navegador.
(function (window) {
    const config = Object.assign({ apiBaseUrl: "", portalUrl: "" }, window.NAVE_CONFIG || {});

    function trimTrailingSlash(value) {
        return String(value || "").replace(/\/+$/, "");
    }

    function resolvePortalUrl() {
        const configuredUrl = trimTrailingSlash(config.portalUrl);
        if (configuredUrl) {
            return configuredUrl;
        }
        if (window.location.protocol === "http:" || window.location.protocol === "https:") {
            return window.location.origin;
        }
        return "";
    }

    async function parseResponse(response) {
        const text = await response.text();
        if (!text) {
            return {};
        }
        try {
            return JSON.parse(text);
        } catch (error) {
            return { message: text };
        }
    }

    async function apiRequest(path, body) {
        const apiBaseUrl = trimTrailingSlash(config.apiBaseUrl);
        const response = await fetch(`${apiBaseUrl}${path}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify(body || {})
        });
        const payload = await parseResponse(response);

        if (!response.ok) {
            const message = payload.message || payload.error || response.statusText;
            throw new Error(`Error del backend (${response.status}): ${message}`);
        }

        return payload;
    }

    function requestWithPromise(path, params, normalize) {
        return {
            promise: async function () {
                const response = await apiRequest(path, params);
                return normalize ? normalize(response) : response;
            }
        };
    }

    function normalizeLambdaResponse(response) {
        if (response && Object.prototype.hasOwnProperty.call(response, "Payload") && typeof response.Payload !== "string") {
            response.Payload = JSON.stringify(response.Payload);
        }
        return response;
    }

    window.NAVE_CONFIG = config;
    window.NAVE_PORTAL_URL = resolvePortalUrl();
    window.NAVE_BACKEND = { request: apiRequest, config };

    window.docClient = {
        get: (params) => requestWithPromise("/api/dynamodb/get", params),
        scan: (params) => requestWithPromise("/api/dynamodb/scan", params),
        update: (params) => requestWithPromise("/api/dynamodb/update", params),
        put: (params) => requestWithPromise("/api/dynamodb/put", params)
    };

    window.lambda = {
        invoke: (params) => requestWithPromise("/api/lambda/invoke", params, normalizeLambdaResponse)
    };
})(window);
