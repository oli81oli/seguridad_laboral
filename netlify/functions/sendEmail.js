import nodemailer from "nodemailer";

// ===============================
// MEMORY SIMPLE RATE LIMIT (per instance)
// ===============================
const ipMemory = new Map();

const RATE_LIMIT_MS = 30 * 1000; // 30s entre envíos por IP

const sanitize = (str = "") =>
    str.toString().replace(/[<>]/g, ""); // básico anti HTML injection

export const handler = async (event) => {
    console.log("EMAIL_USER:", process.env.EMAIL_USER);
console.log("EMAIL_TO:", process.env.EMAIL_TO);
    if (event.httpMethod !== "POST") {
        return {
            statusCode: 405,
            body: JSON.stringify({ ok: false, message: "Method not allowed" }),
        };
    }

    try {
        const ip =
            event.headers["client-ip"] ||
            event.headers["x-nf-client-connection-ip"] ||
            "unknown";

        // ===============================
        // 1. RATE LIMIT
        // ===============================
        const lastRequest = ipMemory.get(ip);

        if (lastRequest && Date.now() - lastRequest < RATE_LIMIT_MS) {
            return {
                statusCode: 429,
                body: JSON.stringify({
                    ok: false,
                    message: "Demasiadas solicitudes. Espera un momento.",
                }),
            };
        }

        ipMemory.set(ip, Date.now());

        const data = JSON.parse(event.body);

        const {
            nombre,
            empleado,
            telefono,
            email,
            fecha,
            hora,
            base,
            vehiculo,
            matricula,
            descripcion,
            tipos,
            token,
            website, // honeypot
        } = data;

        // ===============================
        // 2. HONEYPOT (spam bots)
        // ===============================
        if (website) {
            return {
                statusCode: 400,
                body: JSON.stringify({ ok: false, message: "Spam detectado" }),
            };
        }

        // ===============================
        // 3. CAPTCHA
        // ===============================
        if (!token) {
            return {
                statusCode: 400,
                body: JSON.stringify({ ok: false, message: "Captcha requerido" }),
            };
        }

        const captchaRes = await fetch(
            "https://hcaptcha.com/siteverify",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({
                    secret: process.env.HCAPTCHA_SECRET,
                    response: token,
                }),
            }
        );

        const captchaData = await captchaRes.json();

        if (!captchaData.success) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    ok: false,
                    message: "Captcha inválido",
                }),
            };
        }

        // ===============================
        // 4. VALIDACIÓN BÁSICA
        // ===============================
        if (!nombre || !telefono || !descripcion) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    ok: false,
                    message: "Faltan campos obligatorios",
                }),
            };
        }

        // ===============================
        // 5. SANITIZACIÓN
        // ===============================
        const safeData = {
            nombre: sanitize(nombre),
            empleado: sanitize(empleado),
            telefono: sanitize(telefono),
            email: sanitize(email),
            fecha: sanitize(fecha),
            hora: sanitize(hora),
            base: sanitize(base),
            vehiculo: sanitize(vehiculo),
            matricula: sanitize(matricula),
            descripcion: sanitize(descripcion),
            tipos: (tipos || []).map(sanitize),
        };

        // ===============================
        // 6. EMAIL TRANSPORT
        // ===============================
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        const html = `
      <h2>Nueva incidencia UGT Madrid Río</h2>

      <h3>Trabajador</h3>
      <p><b>Nombre:</b> ${safeData.nombre}</p>
      <p><b>Empleado:</b> ${safeData.empleado}</p>
      <p><b>Teléfono:</b> ${safeData.telefono}</p>
      <p><b>Email:</b> ${safeData.email}</p>

      <h3>Incidencia</h3>
      <p><b>Fecha:</b> ${safeData.fecha}</p>
      <p><b>Hora:</b> ${safeData.hora}</p>
      <p><b>Base:</b> ${safeData.base}</p>
      <p><b>Vehículo:</b> ${safeData.vehiculo}</p>
      <p><b>Matrícula:</b> ${safeData.matricula}</p>

      <h3>Tipos</h3>
      <p>${safeData.tipos.join(", ")}</p>

      <h3>Descripción</h3>
      <p>${safeData.descripcion}</p>

      <hr/>
      <small>IP: ${ip}</small>
    `;

      const info = await transporter.sendMail({
            from: `"Incidencias UGT" <${process.env.EMAIL_USER}>`,
            to: process.env.EMAIL_TO,
            subject: "Nueva incidencia recibida",
            html,
        });
        console.log("EMAIL ENVIADO:", info.messageId);

        return {
            statusCode: 200,
            body: JSON.stringify({ ok: true }),
        };
    } catch (err) {
        console.error("ERROR:", err);

        return {
            statusCode: 500,
            body: JSON.stringify({
                ok: false,
                message: "Error interno del servidor",
            }),
        };
    }
};