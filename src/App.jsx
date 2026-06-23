import { useState, useRef, useEffect } from "react";
import "./App.css";

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
  const [loading, setLoading] = useState(false);
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
    formStartedAt.current = Date.now();
  };

  const validate = () => {
    if (!form.nombre || !form.telefono || !form.descripcion) {
      showToast("Rellena los campos obligatorios");
      return false;
    }

    if (form.telefono.length < 6) {
      showToast("Teléfono inválido");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (loading) return;
    if (!validate()) return;

    setLoading(true);

    try {
      const res = await fetch("/.netlify/functions/sendEmail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          tipos: selected,
          formStartedAt: formStartedAt.current,
        }),
      });

      const data = await res.json();

      if (res.ok && data.ok) {
        resetForm();
        showToast("Incidencia enviada correctamente");
      } else {
        showToast(data?.message || "Error al enviar");
      }
    } catch (err) {
      showToast("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <div className="container">

        {toast && <div className="toast">{toast}</div>}

        <header className="hero">
          <h1>FORMULARIO DE INCIDENCIAS</h1>
          <h2>UGT MADRID RÍO</h2>
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
                <option value="">Base</option>
                <option>Madrid Río</option>
                <option>La Vaguada</option>
                <option>Otra</option>
              </select>

              <input name="vehiculo" placeholder="Vehículo" onChange={handleChange} value={form.vehiculo} />
              <input name="matricula" placeholder="Matrícula" onChange={handleChange} value={form.matricula} />
            </div>
          </section>

          {/* CHECKBOX */}
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

          {/* DESCRIPCIÓN + SELECTS RESTAURADOS */}
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
                <option value="">Riesgo</option>
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
                <option value="">Continúa</option>
                <option>Sí</option>
                <option>No</option>
                <option>Desconocido</option>
              </select>
            </div>
          </section>

          {/* BOTÓN (RESTAURADO) */}
          <button className="btn" type="submit" disabled={loading}>
            {loading ? "Enviando..." : "Enviar incidencia"}
          </button>

        </form>
      </div>
    </div>
  );
}