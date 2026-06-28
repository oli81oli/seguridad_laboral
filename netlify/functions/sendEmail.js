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
const MAX_PHOTOS = 5;
const CLOUDINARY_URL_PREFIX = "https://res.cloudinary.com/";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SECRET = process.env.HMAC_SECRET;

// ===============================
// SANITIZADOR
// ===============================
const sanitize = (str = "") => String(str).replace(/[<>]/g, "").trim();

const escapeHtml = (str = "") =>
  sanitize(str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const isCloudinaryUrl = (url) =>
  typeof url === "string" && url.trim().startsWith(CLOUDINARY_URL_PREFIX);

const sanitizeCloudinaryUrls = (fotos) =>
  Array.isArray(fotos)
    ? fotos.filter(isCloudinaryUrl).map((url) => encodeURI(url.trim()))
    : [];

const EMAIL_TO_BY_BASE = {
  Miravete: process.env.MIRAVETE,
  "San Epi": process.env.SAN_EPI,
  Ventas: process.env.VENTAS,
  "Madrid Rio": process.env.MADRID_RIO,
  Vistalegre: process.env.VISTALEGRE,
  Vaguada: process.env.VAGUADA,
};

const getRecipientByBase = (base) => {
  const email = EMAIL_TO_BY_BASE[base];
  return email || process.env.MADRID_RIO;
};

const renderHtmlSection = (title, body) =>
  '<h3 style="color:#e4002b;">' + title + '</h3>' + body;

const renderHtmlParagraph = (lines) =>
  '<p style="font-size:13px;">' + lines.join('<br/>') + '</p>';

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
    const data = JSON.parse(event.body || "{}");

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
      fotos = [],

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
    if (!nombre || !telefono || !descripcion || !base) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          ok: false,
          message: "Faltan campos obligatorios",
        }),
      };
    }

    if (String(telefono).length < 6) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          ok: false,
          message: "Teléfono inválido",
        }),
      };
    }

    if (String(descripcion).length > MAX_DESC_LENGTH) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          ok: false,
          message: "Descripción demasiado larga",
        }),
      };
    }

    if (!autorizacion || String(autorizacion).trim() === "") {
      return {
        statusCode: 400,
        body: JSON.stringify({
          ok: false,
          message: "Falta la autorización",
        }),
      };
    }

    if (email && !EMAIL_REGEX.test(String(email))) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          ok: false,
          message: "Email inválido",
        }),
      };
    }

    if (formStartedAt && isNaN(Number(formStartedAt))) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          ok: false,
          message: "Referencia de tiempo inválida",
        }),
      };
    }

    if (fotos.length > MAX_PHOTOS) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          ok: false,
          message: `Máximo ${MAX_PHOTOS} imágenes permitidas`,
        }),
      };
    }

    // ===============================
    // HMAC (solo si se envía firma)
    // ===============================
    if (SECRET && signature) {
      const payload = JSON.stringify({
        nombre,
        telefono,
        descripcion,
        timestamp,
        nonce,
      });

      if (!verifySignature(payload, signature)) {
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

      tipos: Array.isArray(tipos) ? tipos.map((t) => sanitize(t)) : [],

      fotos: sanitizeCloudinaryUrls(fotos),
    };

    const htmlSafe = Object.fromEntries(
      Object.entries(safe).map(([key, value]) => [
        key,
        Array.isArray(value) ? value.map((item) => escapeHtml(item)) : escapeHtml(value),
      ])
    );

    const tiposText = safe.tipos.length > 0 ? safe.tipos.join(", ") : "No indicado";
    const tiposHtml = htmlSafe.tipos.length > 0 ? htmlSafe.tipos.join(", ") : "No indicado";
    const fotosText =
      safe.fotos.length > 0 ? safe.fotos.map((url) => "- " + url).join("\n") : "Sin imágenes adjuntas";
    const fotosHtml =
      safe.fotos.length > 0
        ? `
      <table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;">
        <tr>
          ${safe.fotos
            .map((url) => {
              const thumb = url.replace(
                "/upload/",
                "/upload/f_auto,q_auto,w_200,h_200,c_fill/"
              );

              return `
                <td style="padding:0 6px 6px 0;">
                  <a href="${escapeHtml(url)}" target="_blank">
                    <img 
                      src="${escapeHtml(thumb)}" 
                      width="120" height="120"
                      alt="Foto incidencia"
                      style="display:block;border-radius:6px;border:1px solid #ddd;"
                    />
                  </a>
                </td>
              `;
            })
            .join("")}
        </tr>
      </table>
    `
        : "<p style='font-size:13px;'>Sin imágenes adjuntas</p>";
    const recipientEmail = getRecipientByBase(safe.base);

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
    const html =
      '<div style="font-family: Arial, Helvetica, sans-serif; background:#f4f6f8; padding:20px;">' +
      '<div style="max-width:800px; margin:0 auto; background:#fff; border-radius:10px; overflow:hidden; box-shadow:0 2px 10px rgba(0,0,0,0.08);">' +
      '<div style="background:#e4002b; color:#fff; padding:18px 20px;">' +
      '<h2 style="margin:0; font-size:18px;">Nueva incidencia registrada</h2>' +
      '<p style="margin:5px 0 0; font-size:20px;">UGT</p>' +
      "</div>" +
      '<div style="padding:20px;">' +
      renderHtmlSection(
        "Resumen del trabajador",
        renderHtmlParagraph([
          "<b>Nombre:</b> " + htmlSafe.nombre,
          "<b>Número de empleado:</b> " + htmlSafe.empleado,
          "<b>Teléfono:</b> " + htmlSafe.telefono,
          "<b>Email:</b> " + htmlSafe.email,
        ])
      ) +
      renderHtmlSection(
        "Detalle de la incidencia",
        renderHtmlParagraph([
          "<b>Fecha:</b> " + htmlSafe.fecha,
          "<b>Hora:</b> " + htmlSafe.hora,
          "<b>Base:</b> " + htmlSafe.base,
          "<b>Vehículo:</b> " + htmlSafe.vehiculo,
          "<b>Matrícula:</b> " + htmlSafe.matricula,
        ])
      ) +
      renderHtmlSection("Tipos seleccionados", '<p style="font-size:13px;">' + tiposHtml + "</p>") +
      renderHtmlSection(
        "Riesgos",
        renderHtmlParagraph([
          "<b>Riesgo:</b> " + htmlSafe.riesgo,
          "<b>Gravedad:</b> " + htmlSafe.gravedad,
          "<b>Continúa:</b> " + htmlSafe.continua,
        ])
      ) +
      renderHtmlSection(
        "Descripción",
        '<p style="font-size:13px; white-space:pre-wrap;">' + htmlSafe.descripcion + "</p>"
      ) +
      renderHtmlSection(
        "Comunicación previa",
        renderHtmlParagraph([
          "<b>Comunicada:</b> " + htmlSafe.comunicada,
          "<b>Comunicado a:</b> " + htmlSafe.comunicadoA,
          "<b>Respuesta:</b> " + htmlSafe.respuesta,
          "<b>Detalle respuesta:</b> " + htmlSafe.detalleRespuesta,
        ])
      ) +
      renderHtmlSection("Autorización", '<p style="font-size:13px;">' + htmlSafe.autorizacion + "</p>") +
      renderHtmlSection(
        "Observaciones",
        '<p style="font-size:13px; white-space:pre-wrap;">' + htmlSafe.observaciones + "</p>"
      ) +
      renderHtmlSection("Documentación", fotosHtml) +
      "</div>" +
      "</div>" +
      "</div>";

    // ===============================
    // TEXT (ANTI-SPAM)
    // ===============================
    const text = [
      "NUEVA INCIDENCIA UGT MADRID RÍO",
      "",
      "RESUMEN DEL TRABAJADOR",
      "Nombre: " + safe.nombre,
      "Número de empleado: " + safe.empleado,
      "Teléfono: " + safe.telefono,
      "Email: " + safe.email,
      "",
      "DETALLE DE LA INCIDENCIA",
      "Fecha: " + safe.fecha,
      "Hora: " + safe.hora,
      "Base: " + safe.base,
      "Vehículo: " + safe.vehiculo,
      "Matrícula: " + safe.matricula,
      "",
      "TIPOS SELECCIONADOS",
      tiposText,
      "",
      "RIESGOS",
      "Riesgo: " + safe.riesgo,
      "Gravedad: " + safe.gravedad,
      "Continúa: " + safe.continua,
      "",
      "DESCRIPCIÓN",
      safe.descripcion,
      "",
      "COMUNICACIÓN PREVIA",
      "Comunicada: " + safe.comunicada,
      "Comunicado a: " + safe.comunicadoA,
      "Respuesta: " + safe.respuesta,
      "Detalle respuesta: " + safe.detalleRespuesta,
      "",
      "AUTORIZACIÓN",
      safe.autorizacion,
      "",
      "OBSERVACIONES",
      safe.observaciones,
      "",
      "IMÁGENES CLOUDINARY",
      fotosText,
    ].join("\n");

    // ===============================
    // SEND EMAIL
    // ===============================
    await transporter.sendMail({
      from: `"UGT Incidencias" <${process.env.EMAIL_USER}>`,
      to: recipientEmail,
      replyTo: htmlSafe.email || process.env.EMAIL_USER,
      subject: "Nueva incidencia recibida",
      html,
      text,
      headers: {
        "X-Entity-Ref-ID": "ugt-incidencias",
        "X-Priority": "1",
        "X-MSMail-Priority": "High",
      },
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true }),
    };
  } catch (err) {
    const isSmtpError = err.code === "EAUTH" || err.code === "ECONNECTION" || err.code === "ETIMEDOUT";
    const context = {
      errorType: isSmtpError ? "smtp" : "unknown",
      message: err.message,
      ...(err.code && { code: err.code }),
    };
    console.error("[sendEmail]", JSON.stringify(context), err);

    const statusCode = isSmtpError ? 502 : 500;
    return {
      statusCode,
      body: JSON.stringify({
        ok: false,
        message: isSmtpError ? "Error al enviar el correo" : "Error interno del servidor",
      }),
    };
  }
};