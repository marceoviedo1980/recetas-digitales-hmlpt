// Funciones comunes de los recetarios (mismo archivo en Receta HEAS y Recetario La Portada).
// No contiene datos de ningun hospital: lo propio de cada uno esta al inicio de app.js.

// ---------- Texto ----------
export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function normalizar(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// ---------- Numeros a letras (cantidad en literal) ----------
// femenino: "una ampolla", "veintiuna ampollas", "doscientas ampollas"
// masculino: "un inyectable", "veintiun comprimidos", "doscientos comprimidos"
const UNIDADES = ["", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"];
const DIEZ_A_VEINTINUEVE = {
  10: "diez", 11: "once", 12: "doce", 13: "trece", 14: "catorce", 15: "quince",
  16: "dieciséis", 17: "diecisiete", 18: "dieciocho", 19: "diecinueve", 20: "veinte",
  21: "veintiuno", 22: "veintidós", 23: "veintitrés", 24: "veinticuatro", 25: "veinticinco",
  26: "veintiséis", 27: "veintisiete", 28: "veintiocho", 29: "veintinueve",
};
const DECENAS = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
const CENTENAS = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"];

function menorQueMil(n) {
  if (n === 100) return "cien";
  const c = Math.floor(n / 100);
  const r = n % 100;
  const partes = [];
  if (c) partes.push(CENTENAS[c]);
  if (r >= 10 && r <= 29) partes.push(DIEZ_A_VEINTINUEVE[r]);
  else if (r >= 30) {
    const d = Math.floor(r / 10);
    const u = r % 10;
    partes.push(u ? `${DECENAS[d]} y ${UNIDADES[u]}` : DECENAS[d]);
  } else if (r > 0) partes.push(UNIDADES[r]);
  return partes.join(" ");
}

export function numeroALetras(numero, { femenino = false } = {}) {
  const n = Math.trunc(Number(numero));
  if (!Number.isFinite(n) || n < 1 || n > 999999) return "";
  const miles = Math.floor(n / 1000);
  const resto = n % 1000;
  let texto = "";
  if (miles) texto = miles === 1 ? "mil" : `${menorQueMil(miles).replace(/veintiuno$/, "veintiún").replace(/uno$/, "un")} mil`;
  if (resto) texto = `${texto} ${menorQueMil(resto)}`.trim();
  // concordancia con el sustantivo que sigue
  if (femenino) {
    texto = texto
      .replace(/ientos/g, "ientas")
      .replace(/veintiuno$/, "veintiuna")
      .replace(/uno$/, "una");
  } else {
    texto = texto.replace(/veintiuno$/, "veintiún").replace(/uno$/, "un");
  }
  return texto;
}

// ---------- Avisos breves en pantalla ----------
let toastTimer = null;
export function mostrarAviso(mensaje, tipo = "ok") {
  let el = document.querySelector("#appToast");
  if (!el) {
    el = document.createElement("div");
    el.id = "appToast";
    el.className = "app-toast";
    el.setAttribute("role", "status");
    document.body.appendChild(el);
  }
  el.textContent = mensaje;
  el.dataset.tipo = tipo;
  el.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("visible"), 3200);
}

// ---------- Carga de datos de otra PWA, con copia guardada ----------
// 1) en linea (repositorio de origen)  2) ultima copia descargada en este equipo
// 3) copia incluida en la app (carpeta data/)
export async function cargarFuente({ enLinea, local, cache, clave, validar }) {
  const claveFecha = `${clave}-descargado`;
  try {
    const response = await fetch(`${enLinea}?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const texto = await response.text();
    const data = JSON.parse(texto);
    if (!validar(data)) throw new Error("formato no reconocido");
    try {
      const almacen = await caches.open(cache);
      await almacen.put(enLinea, new Response(texto, { headers: { "content-type": "application/json" } }));
      localStorage.setItem(claveFecha, String(Date.now()));
    } catch (error) {
      console.warn("No se pudo guardar la copia local de", enLinea, error);
    }
    return { data, origen: "en-linea", fecha: Date.now() };
  } catch (error) {
    console.warn("Sin conexion con", enLinea, error);
  }

  try {
    const almacen = await caches.open(cache);
    const guardado = await almacen.match(enLinea);
    if (guardado) {
      const data = await guardado.json();
      if (validar(data)) return { data, origen: "copia", fecha: Number(localStorage.getItem(claveFecha)) || null };
    }
  } catch (error) {
    console.warn("No se pudo leer la copia guardada de", enLinea, error);
  }

  const response = await fetch(local);
  const data = await response.json();
  if (!validar(data)) throw new Error(`Formato no reconocido en ${local}`);
  return { data, origen: "respaldo", fecha: null };
}

export function textoOrigen(resultado) {
  if (!resultado) return "no disponible";
  const fecha = resultado.fecha
    ? new Date(resultado.fecha).toLocaleString("es-BO", { dateStyle: "short", timeStyle: "short" })
    : "";
  if (resultado.origen === "en-linea") return `al día (${fecha})`;
  if (resultado.origen === "copia") return `sin conexión, copia del ${fecha || "último uso"}`;
  return "sin conexión, copia incluida en la app";
}

// ---------- Buscador con lista desplegable ----------
// buscar(texto) -> lista de items; pintar(item) -> html; elegir(item) al tocar una opcion.
export function crearBuscador(input, { buscar, pintar, elegir, minimo = 1 }) {
  input.removeAttribute("list");
  input.setAttribute("autocomplete", "off");
  input.parentElement.classList.add("buscador-anclaje");
  const lista = document.createElement("div");
  lista.className = "buscador-lista";
  lista.setAttribute("role", "listbox");
  lista.hidden = true;
  input.insertAdjacentElement("afterend", lista);

  let items = [];
  let activo = -1;

  function cerrar() {
    lista.hidden = true;
    activo = -1;
  }

  function abrir() {
    const texto = input.value.trim();
    if (texto.length < minimo) return cerrar();
    items = buscar(texto);
    if (!items.length) return cerrar();
    lista.innerHTML = items
      .map((item, index) => `<div class="buscador-item" role="option" data-index="${index}">${pintar(item)}</div>`)
      .join("");
    lista.hidden = false;
    activo = -1;
  }

  function marcar(index) {
    const nodos = lista.querySelectorAll(".buscador-item");
    if (!nodos.length) return;
    activo = (index + nodos.length) % nodos.length;
    nodos.forEach((nodo, i) => nodo.classList.toggle("activo", i === activo));
    nodos[activo].scrollIntoView({ block: "nearest" });
  }

  function seleccionar(index) {
    const item = items[index];
    cerrar();
    if (item) elegir(item);
  }

  input.addEventListener("input", abrir);
  input.addEventListener("focus", abrir);
  input.addEventListener("blur", () =>
    setTimeout(() => {
      if (document.activeElement !== input) cerrar();
    }, 150),
  );
  input.addEventListener("keydown", (event) => {
    if (lista.hidden) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      marcar(activo + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      marcar(activo - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      seleccionar(activo >= 0 ? activo : 0);
    } else if (event.key === "Escape") {
      cerrar();
    }
  });
  lista.addEventListener("mousedown", (event) => {
    const nodo = event.target.closest(".buscador-item");
    if (!nodo) return;
    event.preventDefault();
    seleccionar(Number(nodo.dataset.index));
  });

  return { cerrar, abrir };
}
