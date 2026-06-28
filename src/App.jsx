import { useState, useRef, useEffect } from "react";
import "./App.css";
import { uploadToCloudinary } from "./cloudinary";

const incidencias = [
  "Neumáticos desgastados o en mal estado",
  "Frenos",
  "Alumbrado",
  "Climatización",
  "Limpieza del vehículo",
  "Asientos o elementos del habitáculo",
  "Cinturones de seguridad",
  "Daños en carrocería",
  "Baliza V16",
  "Chaleco reflectante",
  "Botiquín",
  "Estado general del vehículo",
  "Temperatura excesiva en la base",
  "Falta de agua potable",
  "Instalaciones deficientes",
  "Riesgo eléctrico",
  "Riesgo de caída",
  "Riesgo ergonómico",
  "Riesgo psicosocial",
  "Acoso laboral",
  "Falta de descanso",
  "Organización del trabajo",
  "Incumplimiento de medidas preventivas",
  "Vulneración de derechos laborales",
  "Vulneración de derechos sindicales",
  "Otra incidencia",
];

export default function App() {
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState("");

  const toastTimeoutRef = useRef(null);
  const formStartedAt = useRef(Date.now());

  const [form, setForm] = useState({
    nombre: "",
    empleado: "",
    telefono: "",
    email: "",
    fecha: "",
    hora: "",
    base: "",
    vehiculo: "",
    matricula: "",
    descripcion: "",
    riesgo: "",
    gravedad: "",
    continua: "",
    comunicada: "",
    comunicadoA: "",
    respuesta: "",
    detalleRespuesta: "",
    autorizacion: "",
    observaciones: "",
    website: "",
  });

  const [selected, setSelected] = useState([]);

  const showToast = (msg) => {
    setToast(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);

    toastTimeoutRef.current = setTimeout(() => setToast(""), 3000);
  };

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      previews.forEach(URL.revokeObjectURL);
    };
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCheckbox = (e) => {
    const { value, checked } = e.target;

    setSelected((prev) =>
      checked ? [...prev, value] : prev.filter((v) => v !== value)
    );
  };

  const MAX_FILES = 5;
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

  const validateFiles = (filesList) => {
    if (filesList.length > MAX_FILES) {
      showToast("Máximo 5 imágenes permitidas");
      return false;
    }

    for (const file of filesList) {
      if (!allowedTypes.includes(file.type)) {
        showToast("Solo JPG, PNG o WEBP");
        return false;
      }
    }

    return true;
  };

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files || []);

    if (!validateFiles(selectedFiles)) {
      e.target.value = "";
      setFiles([]);
      setPreviews([]);
      return;
    }

    setFiles(selectedFiles);
    setPreviews(selectedFiles.map((f) => URL.createObjectURL(f)));
  };

  const resetForm = () => {
    setForm({
      nombre: "",
      empleado: "",
      telefono: "",
      email: "",
      fecha: "",
      hora: "",
      base: "",
      vehiculo: "",
      matricula: "",
      descripcion: "",
      riesgo: "",
      gravedad: "",
      continua: "",
      comunicada: "",
      comunicadoA: "",
      respuesta: "",
      detalleRespuesta: "",
      autorizacion: "",
      observaciones: "",
      website: "",
    });

    setSelected([]);
    setFiles([]);
    setPreviews([]);
    formStartedAt.current = Date.now();
  };

  const validate = () => {
    if (!form.autorizacion) {
      showToast("Debes indicar si autorizas el uso de la información");
      return false;
    }

    if (!form.nombre || !form.telefono || !form.descripcion || !form.base) {
      showToast("Rellena los campos obligatorios");
      return false;
    }

    if (form.telefono.length < 6) {
      showToast("Teléfono inválido");
      return false;
    }

    return true;
  };

  const uploadFiles = async () => {
    if (files.length === 0) return [];

    const uploadedUrls = [];

    for (const file of files) {
      const res = await uploadToCloudinary(file);
      if (!res?.secure_url) {
        throw new Error("Cloudinary no devolvió una URL segura");
      }

      uploadedUrls.push(res.secure_url);
    }

    return uploadedUrls;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (submitting) return;
    if (!validate()) return;

    if (files.length > 0 && !validateFiles(files)) return;

    setSubmitting(true);

    try {
      const fotos = await uploadFiles();

      const res = await fetch(
        "/.netlify/functions/sendEmail",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            tipos: selected,
            fotos,
            formStartedAt: formStartedAt.current,
          }),
        }
      );

      const data = await res.json();

      if (res.ok && data.ok) {
        resetForm();
        showToast("Incidencia enviada correctamente");
      } else {
        showToast(data?.message || "Error al enviar");
      }
    } catch (err) {
      console.error(err);
      showToast("Error de conexión");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="app">
      <div className="container">

        {toast && <div className="toast">{toast}</div>}

        <header className="hero">
          <h1>FORMULARIO DE INCIDENCIAS</h1>
          <h2>UGT</h2>
        </header>

        <form onSubmit={handleSubmit}>

          {/* HONEYPOT */}
          <input
            type="text"
            name="website"
            value={form.website}
            onChange={handleChange}
            autoComplete="off"
            tabIndex="-1"
            className="honeypot"
          />

          {/* TEXTO LEGAL */}
          <section className="card">
            <p>
              Este formulario tiene como finalidad comunicar incidencias relacionadas con la seguridad, salud,
              condiciones de trabajo, vehículos e instalaciones. La información será tratada con confidencialidad
              por los Delegados de Prevención de UGT.
            </p>
            <p className="required-note">Los campos marcados con <span className="asterisk">*</span> son obligatorios</p>
          </section>

          {/* DATOS TRABAJADOR */}
          <section className="card">
            <h3>Datos del trabajador</h3>
            <div className="grid">
              <input name="nombre" placeholder="Nombre y apellidos *" onChange={handleChange} value={form.nombre} />
              <input name="empleado" placeholder="Número de empleado" onChange={handleChange} value={form.empleado} />
              <input name="telefono" placeholder="Teléfono *" onChange={handleChange} value={form.telefono} />
              <input name="email" placeholder="Correo electrónico" onChange={handleChange} value={form.email} />
            </div>
          </section>

          {/* INCIDENCIA */}
          <section className="card">
            <h3>Datos de la incidencia</h3>
            <div className="grid">
              <input type="date" name="fecha" onChange={handleChange} value={form.fecha} />
              <input type="time" name="hora" onChange={handleChange} value={form.hora} />

              <select name="base" onChange={handleChange} value={form.base}>
                <option value="">Base *</option>
                <option>Miravete</option>
                <option>San Epi</option>
                <option>Ventas</option>
                <option>Madrid Rio</option>
                <option>Vistalegre</option>
                <option>Vaguada</option>
              </select>

              <input name="vehiculo" placeholder="Vehículo" onChange={handleChange} value={form.vehiculo} />
              <input name="matricula" placeholder="Matrícula" onChange={handleChange} value={form.matricula} />
            </div>
          </section>

          {/* TIPOS */}
          <section className="card">
            <h3>Tipo de incidencia</h3>
            <div className="checkbox-list">
              {incidencias.map((item) => (
                <label key={item} className="checkbox-item">
                  <input
                    type="checkbox"
                    value={item}
                    checked={selected.includes(item)}
                    onChange={handleCheckbox}
                  />
                  <span>{item}</span>
                </label>
              ))}
            </div>
          </section>

          {/* DESCRIPCIÓN */}
          <section className="card">
            <h3>Descripción</h3>

            <textarea
              name="descripcion"
              rows="5"
              placeholder="Describe la incidencia *"
              onChange={handleChange}
              value={form.descripcion}
            />

            <div className="grid">
              <select name="riesgo" onChange={handleChange} value={form.riesgo}>
                <option value="">¿Existe riesgo?</option>
                <option>Sí</option>
                <option>No</option>
                <option>No estoy seguro</option>
              </select>

              <select name="gravedad" onChange={handleChange} value={form.gravedad}>
                <option value="">Gravedad</option>
                <option>Leve</option>
                <option>Moderado</option>
                <option>Grave</option>
                <option>Muy grave</option>
              </select>

              <select name="continua" onChange={handleChange} value={form.continua}>
                <option value="">¿Continúa?</option>
                <option>Sí</option>
                <option>No</option>
                <option>Desconocido</option>
              </select>
            </div>
          </section>

          {/* COMUNICACIÓN PREVIA */}
          <section className="card">
            <h3>Comunicación previa</h3>

            <select name="comunicada" onChange={handleChange} value={form.comunicada}>
              <option value="">¿Ha sido comunicada?</option>
              <option>Sí</option>
              <option>No</option>
            </select>

            {form.comunicada === "Sí" && (
              <div className="grid">
                <input
                  name="comunicadoA"
                  placeholder="¿A quién se comunicó?"
                  value={form.comunicadoA}
                  onChange={handleChange}
                />

                <select name="respuesta" value={form.respuesta} onChange={handleChange}>
                  <option value="">¿Recibió respuesta?</option>
                  <option>Sí</option>
                  <option>No</option>
                </select>
              </div>
            )}

            {form.respuesta === "Sí" && form.comunicada === "Sí" && (
              <textarea
                name="detalleRespuesta"
                rows="3"
                placeholder="Explica la respuesta recibida"
                value={form.detalleRespuesta}
                onChange={handleChange}
              />
            )}
          </section>

          {/* OBSERVACIONES */}
          <section className="card">
            <h3>Observaciones adicionales</h3>
            <textarea
              name="observaciones"
              rows="4"
              placeholder="Observaciones"
              value={form.observaciones}
              onChange={handleChange}
            />
          </section>

          {/* DOCUMENTACIÓN */}
          <section className="card">
            <h3>Documentación</h3>

            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={handleFileChange}
            />

            {previews.length > 0 && (
              <div className="preview-grid">
                {previews.map((url, i) => (
                  <img key={i} src={url} className="preview-thumb" alt={`Vista previa ${i + 1}`} />
                ))}
              </div>
            )}
          </section>

          {/* AUTORIZACIÓN */}
          <section className="card">
            <h3>Autorización</h3>

            <select
              name="autorizacion"
              value={form.autorizacion}
              onChange={handleChange}
            >
              <option value="">¿Autoriza el uso de la información? *</option>
              <option>Sí</option>
              <option>No</option>
            </select>

            <p style={{ marginTop: "10px", fontSize: "13px", color: "#555" }}>
              Los Delegados de Prevención de UGT podrán utilizar esta información para su traslado
              a la empresa o a los organismos competentes cuando sea necesario.
            </p>
          </section>

          {/* BOTÓN */}
          <button className="btn" type="submit" disabled={submitting}>
            {submitting ? "Enviando..." : "Enviar incidencia"}
          </button>

        </form>
      </div>
    </div>
  );
}