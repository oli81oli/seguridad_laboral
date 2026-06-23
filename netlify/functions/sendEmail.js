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

const SECRET = process.env.HMAC_SECRET; // opcional si activas firma

// ===============================
// SANITIZADOR BÁSICO
// ===============================
const sanitize = (str = "") =>
  String(str).replace(/[<>]/g, "").trim();

// ===============================
// HMAC VERIFY (opcional nivel pro)
// ===============================
const verifySignature = (payload, signature) => {
  if (!SECRET || !signature) return true; // si no usas firma, no bloquea

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
      website, // honeypot
      formStartedAt,

      // 👇 opcionales si luego activas firma HMAC
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
    // TIEMPO DE FORMULARIO
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

    // ===============================
    // HMAC CHECK (solo si lo activas)
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
      tipos: Array.isArray(tipos)
        ? tipos.map((t) => sanitize(t))
        : [],
    };

    // ===============================
    // TRANSPORTER EMAIL
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
      <p><strong>Nombre:</strong> ${safeData.nombre}</p>
      <p><strong>Empleado:</strong> ${safeData.empleado}</p>
      <p><strong>Teléfono:</strong> ${safeData.telefono}</p>
      <p><strong>Email:</strong> ${safeData.email}</p>

      <h3>Incidencia</h3>
      <p><strong>Fecha:</strong> ${safeData.fecha}</p>
      <p><strong>Hora:</strong> ${safeData.hora}</p>
      <p><strong>Base:</strong> ${safeData.base}</p>
      <p><strong>Vehículo:</strong> ${safeData.vehiculo}</p>
      <p><strong>Matrícula:</strong> ${safeData.matricula}</p>

      <h3>Tipos</h3>
      <p>${safeData.tipos.join(", ")}</p>

      <h3>Descripción</h3>
      <p>${safeData.descripcion}</p>

      <hr/>
      <small>IP: ${ip}</small>
    `;

    // ===============================
    // ENVÍO EMAIL
    // ===============================
    await transporter.sendMail({
      from: `"Incidencias UGT" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_TO,
      subject: "Nueva incidencia recibida",
      html,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
      }),
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