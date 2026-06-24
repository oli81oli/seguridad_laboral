import nodemailer from "nodemailer";
import crypto from "crypto";

// ===============================
// RATE LIMIT SIMPLE (in-memory)
// ===============================
const ipMemory = new Map();
const RATE_LIMIT_MS = 30 * 1000; // 30 segundos

// ===============================
// CONFIG SEGURIDAD
// ===============================
const MIN_FORM_TIME = 5000;
const MAX_DESC_LENGTH = 5000;

const SECRET = process.env.HMAC_SECRET;

// ===============================
// SANITIZADOR
// ===============================
const sanitize = (str = "") =>
  String(str).replace(/[<>]/g, "").trim();

// ===============================
// HMAC VERIFY (opcional)
// ===============================
const verifySignature = (payload, signature) => {
  if (!SECRET || !signature) return true;

  const expected = crypto
    .createHmac("sha256", SECRET)
    .update(payload)
    .digest("hex");

  return expected === signature;
};

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({
        ok: false,
        message: "Method not allowed",
      }),
    };
  }

  try {
    // ===============================
    // IP
    // ===============================
    const ip =
      event.headers["client-ip"] ||
      event.headers["x-nf-client-connection-ip"] ||
      event.headers["x-forwarded-for"] ||
      "unknown";

    // ===============================
    // RATE LIMIT
    // ===============================
    const lastRequest = ipMemory.get(ip);

    if (lastRequest && Date.now() - lastRequest < RATE_LIMIT_MS) {
      return {
        statusCode: 429,
        body: JSON.stringify({
          ok: false,
          message: "Demasiadas solicitudes. Espera unos segundos.",
        }),
      };
    }

    ipMemory.set(ip, Date.now());

    // ===============================
    // BODY
    // ===============================
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

      riesgo,
      gravedad,
      continua,

      comunicada,
      comunicadoA,
      respuesta,
      detalleRespuesta,

      observaciones,

      autorizacion,

      website,
      formStartedAt,

      timestamp,
      nonce,
      signature,
    } = data;

    // ===============================
    // HONEYPOT
    // ===============================
    if (website && website.trim() !== "") {
      return {
        statusCode: 400,
        body: JSON.stringify({
          ok: false,
          message: "Spam detectado",
        }),
      };
    }

    // ===============================
    // TIME CHECK
    // ===============================
    if (formStartedAt) {
      const elapsed = Date.now() - Number(formStartedAt);

      if (elapsed < MIN_FORM_TIME) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            ok: false,
            message: "Envío demasiado rápido",
          }),
        };
      }
    }

    // ===============================
    // VALIDACIONES
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

    if (telefono.length < 6) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          ok: false,
          message: "Teléfono inválido",
        }),
      };
    }

    if (descripcion.length > MAX_DESC_LENGTH) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          ok: false,
          message: "Descripción demasiado larga",
        }),
      };
    }

    if (!autorizacion || autorizacion.trim() === "") {
      return {
        statusCode: 400,
        body: JSON.stringify({
          ok: false,
          message: "Falta la autorización",
        }),
      };
    }

    // ===============================
    // HMAC
    // ===============================
    if (SECRET && signature) {
      const payload = JSON.stringify({
        nombre,
        telefono,
        descripcion,
        timestamp,
        nonce,
      });

      const valid = verifySignature(payload, signature);

      if (!valid) {
        return {
          statusCode: 403,
          body: JSON.stringify({
            ok: false,
            message: "Firma inválida",
          }),
        };
      }
    }

    // ===============================
    // SANITIZACIÓN
    // ===============================
    const safe = {
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

      riesgo: sanitize(riesgo),
      gravedad: sanitize(gravedad),
      continua: sanitize(continua),

      comunicada: sanitize(comunicada),
      comunicadoA: sanitize(comunicadoA),
      respuesta: sanitize(respuesta),
      detalleRespuesta: sanitize(detalleRespuesta),

      observaciones: sanitize(observaciones),
      autorizacion: sanitize(autorizacion),

      tipos: Array.isArray(tipos)
        ? tipos.map((t) => sanitize(t))
        : [],
    };

    // ===============================
    // TRANSPORTER (SMTP PRO)
    // ===============================
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // ===============================
    // HTML PRO
    // ===============================
    const html = `
<div style="font-family: Arial, Helvetica, sans-serif; background:#f4f6f8; padding:20px;">
  <div style="max-width:800px; margin:0 auto; background:#fff; border-radius:10px; overflow:hidden; box-shadow:0 2px 10px rgba(0,0,0,0.08);">

    <div style="background:#e4002b; color:#fff; padding:18px 20px;">
      <h2 style="margin:0; font-size:18px;">Nueva incidencia registrada</h2>
      <p style="margin:5px 0 0; font-size:13px;">UGT Madrid Río</p>
    </div>

    <div style="padding:20px;">

      <h3 style="color:#e4002b;">Resumen</h3>
      <p style="font-size:13px;">
        <b>Nombre:</b> ${safe.nombre}<br/>
        <b>Teléfono:</b> ${safe.telefono}<br/>
        <b>Base:</b> ${safe.base}<br/>
        <b>Fecha:</b> ${safe.fecha} ${safe.hora}
      </p>

      <h3 style="color:#e4002b;">Incidencia</h3>
      <p style="font-size:13px;">
        <b>Vehículo:</b> ${safe.vehiculo}<br/>
        <b>Matrícula:</b> ${safe.matricula}
      </p>

      <h3 style="color:#e4002b;">Tipos</h3>
      <p style="font-size:13px;">${safe.tipos.join(", ")}</p>

      <h3 style="color:#e4002b;">Riesgo</h3>
      <p style="font-size:13px;">
        <b>Riesgo:</b> ${safe.riesgo}<br/>
        <b>Gravedad:</b> ${safe.gravedad}<br/>
        <b>Continúa:</b> ${safe.continua}
      </p>

      <h3 style="color:#e4002b;">Descripción</h3>
      <p style="font-size:13px; white-space:pre-wrap;">${safe.descripcion}</p>

      <h3 style="color:#e4002b;">Autorización</h3>
      <p style="font-size:13px;">${safe.autorizacion}</p>

      <h3 style="color:#e4002b;">Observaciones</h3>
      <p style="font-size:13px; white-space:pre-wrap;">${safe.observaciones}</p>

    </div>
  </div>
</div>
`;

    // ===============================
    // TEXT (ANTI-SPAM)
    // ===============================
    const text = `
NUEVA INCIDENCIA UGT MADRID RÍO

Nombre: ${safe.nombre}
Teléfono: ${safe.telefono}
Base: ${safe.base}
Fecha: ${safe.fecha} ${safe.hora}

Vehículo: ${safe.vehiculo}
Matrícula: ${safe.matricula}

Tipos: ${safe.tipos.join(", ")}

Riesgo: ${safe.riesgo}
Gravedad: ${safe.gravedad}
Continúa: ${safe.continua}

Descripción:
${safe.descripcion}

Autorización: ${safe.autorizacion}

Observaciones:
${safe.observaciones}
`;

    // ===============================
    // SEND EMAIL
    // ===============================
    await transporter.sendMail({
      from: `"UGT Incidencias" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_TO,
      replyTo: email || process.env.EMAIL_USER,
      subject: "Nueva incidencia recibida",
      html,
      text,
      headers: {
        "X-Entity-Ref-ID": "ugt-incidencias",
      },
    });

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