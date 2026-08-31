(function (window) {
    const config = Object.assign({
        apiBaseUrl: "",
        portalUrl: "",
        withCredentials: false
    }, window.NAVE_CONFIG || {});

    function trimTrailingSlash(value) {
        return String(value || "").replace(/\/+$/, "");
    }

    function resolveApiBaseUrl() {
        const configuredUrl = trimTrailingSlash(config.apiBaseUrl);
        if (configuredUrl) {
            return configuredUrl;
        }
        if (window.location.protocol === "http:" || window.location.protocol === "https:") {
            return `${window.location.origin}/api`;
        }
        return "";
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
        const apiBaseUrl = resolveApiBaseUrl();
        if (!apiBaseUrl) {
            throw new Error("NAVE_CONFIG.apiBaseUrl no esta configurado. Define el endpoint del API Gateway antes de publicar el portal.");
        }

        const headers = {
            "Content-Type": "application/json"
        };
        const correo = window.localStorage && window.localStorage.getItem("correo");
        if (correo) {
            headers["x-nave-user"] = correo;
        }

        const response = await fetch(`${apiBaseUrl}${path}`, {
            method: "POST",
            headers,
            credentials: config.withCredentials ? "include" : "same-origin",
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
    window.NAVE_BACKEND = {
        request: apiRequest,
        config
    };

    window.docClient = {
        get: function (params) {
            return requestWithPromise("/dynamodb/get", params);
        },
        scan: function (params) {
            return requestWithPromise("/dynamodb/scan", params);
        },
        update: function (params) {
            return requestWithPromise("/dynamodb/update", params);
        },
        put: function (params) {
            return requestWithPromise("/dynamodb/put", params);
        }
    };

    window.lambda = {
        invoke: function (params) {
            return requestWithPromise("/lambda/invoke", params, normalizeLambdaResponse);
        }
    };
})(window);
