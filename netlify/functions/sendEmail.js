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
const MIN_FORM_TIME = 5000; // 5s mínimo
const MAX_DESC_LENGTH = 5000;

const SECRET = process.env.HMAC_SECRET;

// ===============================
// SANITIZADOR BÁSICO
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
    // IP DETECTION
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
    // PARSE BODY
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
    // TIEMPO FORMULARIO
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
    // VALIDACIONES BÁSICAS
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
    // HMAC CHECK (opcional)
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

      autorizacion: sanitize(autorizacion),

      observaciones: sanitize(observaciones),

      tipos: Array.isArray(tipos)
        ? tipos.map((t) => sanitize(t))
        : [],
    };

    // ===============================
    // EMAIL TRANSPORTER
    // ===============================
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // ===============================
    // HTML EMAIL
    // ===============================
    const html = `
<div style="font-family: Arial, Helvetica, sans-serif; background:#f4f6f8; padding:20px;">

  <div style="max-width:800px; margin:0 auto; background:#ffffff; border-radius:10px; overflow:hidden; box-shadow:0 2px 10px rgba(0,0,0,0.08);">

    <!-- HEADER -->
    <div style="background:#e4002b; color:white; padding:18px 20px;">
      <h2 style="margin:0; font-size:18px;">Nueva incidencia registrada</h2>
      <p style="margin:5px 0 0; font-size:13px; opacity:0.9;">
        UGT Madrid Río · Sistema de incidencias
      </p>
    </div>

    <!-- BODY -->
    <div style="padding:20px;">

      <!-- RESUMEN -->
      <div style="background:#f9f9f9; padding:12px 15px; border-radius:8px; margin-bottom:20px;">
        <h3 style="margin:0 0 10px; font-size:14px; color:#333;">Resumen rápido</h3>
        <p style="margin:0; font-size:13px;">
          <strong>Nombre:</strong> ${safe.nombre || "-"}<br/>
          <strong>Teléfono:</strong> ${safe.telefono || "-"}<br/>
          <strong>Base:</strong> ${safe.base || "-"}<br/>
          <strong>Fecha:</strong> ${safe.fecha || "-"} ${safe.hora || ""}
        </p>
      </div>

      <!-- TRABAJADOR -->
      <h3 style="font-size:14px; color:#e4002b; border-bottom:1px solid #eee; padding-bottom:5px;">
        Datos del trabajador
      </h3>

      <p style="font-size:13px; line-height:1.6;">
        <strong>Nombre:</strong> ${safe.nombre || "-"}<br/>
        <strong>Empleado:</strong> ${safe.empleado || "-"}<br/>
        <strong>Teléfono:</strong> ${safe.telefono || "-"}<br/>
        <strong>Email:</strong> ${safe.email || "-"}
      </p>

      <!-- INCIDENCIA -->
      <h3 style="font-size:14px; color:#e4002b; border-bottom:1px solid #eee; padding-bottom:5px;">
        Incidencia
      </h3>

      <p style="font-size:13px; line-height:1.6;">
        <strong>Fecha:</strong> ${safe.fecha || "-"}<br/>
        <strong>Hora:</strong> ${safe.hora || "-"}<br/>
        <strong>Base:</strong> ${safe.base || "-"}<br/>
        <strong>Vehículo:</strong> ${safe.vehiculo || "-"}<br/>
        <strong>Matrícula:</strong> ${safe.matricula || "-"}
      </p>

      <!-- TIPOS -->
      <h3 style="font-size:14px; color:#e4002b; border-bottom:1px solid #eee; padding-bottom:5px;">
        Tipo de incidencia
      </h3>

      <p style="font-size:13px; line-height:1.6;">
        ${safe.tipos.length ? safe.tipos.join(", ") : "-"}
      </p>

      <!-- CONDICIONES -->
      <h3 style="font-size:14px; color:#e4002b; border-bottom:1px solid #eee; padding-bottom:5px;">
        Evaluación del riesgo
      </h3>

      <p style="font-size:13px; line-height:1.6;">
        <strong>Riesgo:</strong> ${safe.riesgo || "-"}<br/>
        <strong>Gravedad:</strong> ${safe.gravedad || "-"}<br/>
        <strong>Continúa:</strong> ${safe.continua || "-"}
      </p>

      <!-- COMUNICACIÓN -->
      <h3 style="font-size:14px; color:#e4002b; border-bottom:1px solid #eee; padding-bottom:5px;">
        Comunicación previa
      </h3>

      <p style="font-size:13px; line-height:1.6;">
        <strong>Comunicada:</strong> ${safe.comunicada || "-"}<br/>
        <strong>Comunicado a:</strong> ${safe.comunicadoA || "-"}<br/>
        <strong>Respuesta:</strong> ${safe.respuesta || "-"}<br/>
        <strong>Detalle:</strong> ${safe.detalleRespuesta || "-"}
      </p>

      <!-- DESCRIPCIÓN -->
      <h3 style="font-size:14px; color:#e4002b; border-bottom:1px solid #eee; padding-bottom:5px;">
        Descripción
      </h3>

      <p style="font-size:13px; line-height:1.6; white-space:pre-wrap;">
        ${safe.descripcion || "-"}
      </p>

      <!-- OBSERVACIONES -->
      <h3 style="font-size:14px; color:#e4002b; border-bottom:1px solid #eee; padding-bottom:5px;">
        Observaciones
      </h3>

      <p style="font-size:13px; line-height:1.6; white-space:pre-wrap;">
        ${safe.observaciones || "-"}
      </p>

      <!-- AUTORIZACIÓN -->
      <h3 style="font-size:14px; color:#e4002b; border-bottom:1px solid #eee; padding-bottom:5px;">
        Autorización
      </h3>

      <p style="font-size:13px;">
        <strong>Uso de información:</strong> ${safe.autorizacion || "-"}
      </p>

      <!-- FOOTER -->
      <div style="margin-top:25px; font-size:11px; color:#777; border-top:1px solid #eee; padding-top:10px;">
        IP registrada: ${ip}
      </div>

    </div>
  </div>
</div>
`;;

    // ===============================
    // SEND EMAIL
    // ===============================
    await transporter.sendMail({
      from: `"Incidencias UGT" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_TO,
      subject: "Nueva incidencia recibida",
      html,
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