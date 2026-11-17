import {
  escapeHtml,
  normalizar,
  numeroALetras,
  mostrarAviso,
  cargarFuente,
  textoOrigen,
  crearBuscador,
} from "./utilidades.js";

// ===== DATOS DEL ESTABLECIMIENTO: lo propio del hospital se cambia aqui =====
const APP_NAME = "Recetario Digital La Portada";
const DATA_CACHE = "recetario-digital-manual-datos"; // debe coincidir con DATA_CACHE en sw.js

// De donde se leen los datos. "enLinea" es el archivo publicado por la otra PWA;
// "local" es la copia de respaldo dentro de esta app (carpeta data/).
const FUENTE_MEDICAMENTOS = {
  enLinea: "https://raw.githubusercontent.com/marceoviedo1980/FarmaCheck/main/medicamentos.json",
  local: "./data/medicamentos.json",
};
const FUENTE_DIAGNOSTICOS = {
  enLinea: "https://raw.githubusercontent.com/marceoviedo1980/cartera-servicios/main/cartera_servicios.json",
  local: "./data/cartera_servicios.json",
};

// Psicotropicos y estupefacientes (FarmaCheck no los marca: se reconocen por el nombre).
// Si FarmaCheck agrega un campo "controlado", tambien se respeta.
const CONTROLADOS = /fentanil|morfin|diazepam|midazolam|clonazepam|ketamin|cetamin/i;
// Cantidad en literal. Ej.: "Citrato de Fentanilo 0,05 mg/ml (ampolla de 10 ml) (tres ampollas)".
const UNIDAD_CONTROLADO = [
  { patron: /iny|ampoll|vial/i, singular: "ampolla", plural: "ampollas", femenino: true },
  { patron: /comprim|c[aá]psul|tableta|gragea/i, singular: "comprimido", plural: "comprimidos", femenino: false },
];
// =============================================================================

const SAVED_RECIPES_KEY = "recetario-la-portada-recetas-guardadas-v1";
const DRAFT_KEY = "recetario-la-portada-borrador-v1";
const DRAFT_MAX_AGE_MS = 4 * 60 * 60 * 1000;
const LICENSE_STATUS_URL = "./licencia-hmlpt-recetas.json";
const LICENSE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const LICENSE_STATUS_KEY = "recetario-la-portada-licencia-v1";
const LICENSE_LAST_CHECK_KEY = "recetario-la-portada-licencia-ultima-revision-v1";
const DEFAULT_LICENSE_MESSAGE =
  "Esta version ya no esta autorizada para uso institucional. Contacte al desarrollador para soporte o renovacion.";

let medicines = [];
let diagnoses = [];
const dataStatus = { medicamentos: null, diagnosticos: null };

const clinicalServices = [
  "CIRUGIA",
  "GINECOLOGIA",
  "GINECOLOGIA Y OBSTETRICIA",
  "MEDICINA INTERNA",
  "PEDIATRIA",
  "UNIDAD DE TERAPIA INTENSIVA",
  "UNIDAD DE CUIDADOS NEONATALES",
  "NEONATOLOGIA",
  "EMERGENCIAS",
  "TRAUMATOLOGIA",
  "NEUMOLOGIA",
];

const ambulatorioServices = [
  "Consulta integral en servicio de Urgencias/Emergencia T17576036",
  "Inyectables en consulta externa T17638014",
  "Consulta integral de otras especialidades medicas T17576027",
  "Consulta odontologica general T17577005",
  "Consulta integral de psicologia T17577003",
  "Nebulizacion en consultorio externo T17638016",
  "Retiro de puntos en consultorio externo T17638019",
  "Curacion en consultorio externo T17638009",
  "Sutura en consultorio externo T17638020",
  "Cateterismo venoso periferico en urgencias T02663001",
  "Lavado gastrico de intoxicaciones T02662006",
  "Sutura en urgencias T02663006",
  "Cateterismo venoso periferico en consultorio externo T17638003",
  "Control de salud de rutina del nino Z00.1",
];

const internadoProcedures = [
  "Anestesia General Balanceada T08639001",
  "Cateterismo Venoso periferico en paciente internado T19655007",
  "Nebulizacion en paciente internado T19655028",
  "Anestesia General Neuroaxial T08639006",
  "Lavado gastrico en paciente internado T19655024",
  "Cateterismo Vesical en paciente internado T19655008",
];

const state = {
  template: "ambulatorio",
  medicines: [],
  currentSavedId: null,
  pendingMedicine: null,
};

const form = document.querySelector("#recipeForm");
const preview = document.querySelector("#recipePreview");
const medicineList = document.querySelector("#medicineList");
const medicineInput = document.querySelector("#medicineInput");
const quantityInput = document.querySelector("#quantityInput");
const instructionInput = document.querySelector("#instructionInput");
const medicineHint = document.querySelector("#medicineHint");
const dataStatusLine = document.querySelector("#dataStatus");
const installButton = document.querySelector("#installBtn");
const pdfButton = document.querySelector("#pdfBtn");
const pdfButtonLabel = pdfButton?.querySelector("span");
const saveRecipeButton = document.querySelector("#saveRecipeBtn");
const openSavedButton = document.querySelector("#openSavedBtn");
const exportSavedButton = document.querySelector("#exportSavedBtn");
const importSavedButton = document.querySelector("#importSavedBtn");
const importSavedInput = document.querySelector("#importSavedInput");
const savedDialog = document.querySelector("#savedRecipesDialog");
const savedRecipesList = document.querySelector("#savedRecipesList");
const savedSearchInput = document.querySelector("#savedSearchInput");
const savedSearchCount = document.querySelector("#savedSearchCount");
const closeSavedDialogButton = document.querySelector("#closeSavedDialogBtn");
const licenseBlocker = document.querySelector("#licenseBlocker");
const licenseBlockerMessage = document.querySelector("#licenseBlockerMessage");
const tabs = [...document.querySelectorAll(".template-tab")];
const ambulatorioServicesOptions = document.querySelector("#ambulatorioServicesOptions");
const internadoProcedureOptions = document.querySelector("#internadoProcedureOptions");
let installPrompt = null;

populateServiceOptions();

ambulatorioServicesOptions.innerHTML = renderCheckOptions("service", ambulatorioServices);
internadoProcedureOptions.innerHTML = renderCheckOptions("procedure", internadoProcedures);

form.addEventListener("input", (event) => {
  // los campos de cada medicamento agregado actualizan solo la hoja (para no perder el cursor)
  if (event.target.closest("#medicineList")) return;
  render();
});
updatePdfButtonLabel();
window.addEventListener("resize", updatePdfButtonLabel);
window.addEventListener("orientationchange", updatePdfButtonLabel);

tabs.forEach((tab) => {
  tab.addEventListener("click", () => activateTemplate(tab.dataset.template));
});

document.querySelector("#printBtn").addEventListener("click", () => window.print());
pdfButton.addEventListener("click", generatePdf);
saveRecipeButton.addEventListener("click", saveCurrentRecipe);
openSavedButton.addEventListener("click", openSavedRecipes);
exportSavedButton.addEventListener("click", exportSavedRecipes);
importSavedButton.addEventListener("click", () => importSavedInput.click());
importSavedInput.addEventListener("change", importSavedRecipes);
closeSavedDialogButton.addEventListener("click", () => savedDialog.close());
savedSearchInput?.addEventListener("input", () => renderSavedRecipesList());
document.querySelector("#clearBtn").addEventListener("click", () => {
  const shouldClear = window.confirm(
    "Seguro que quieres limpiar el formulario actual y borrar los medicamentos agregados? Las recetas guardadas no se borraran."
  );
  if (!shouldClear) {
    return;
  }

  form.reset();
  state.medicines = [];
  state.currentSavedId = null;
  clearPendingMedicine();
  clearDraft();
  render();
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  installButton.classList.remove("hidden");
});

installButton.addEventListener("click", async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  installButton.classList.add("hidden");
});

window.addEventListener("appinstalled", () => {
  installPrompt = null;
  installButton.classList.add("hidden");
});

// ===== Licencia =====
function readStoredLicenseStatus() {
  try {
    return JSON.parse(localStorage.getItem(LICENSE_STATUS_KEY) || "null");
  } catch (error) {
    console.warn("No se pudo leer el estado local de licencia.", error);
    return null;
  }
}

function storeLicenseStatus(status) {
  localStorage.setItem(LICENSE_STATUS_KEY, JSON.stringify(status));
  localStorage.setItem(LICENSE_LAST_CHECK_KEY, String(Date.now()));
}

function shouldCheckLicense() {
  const lastCheck = Number(localStorage.getItem(LICENSE_LAST_CHECK_KEY) || "0");
  return !lastCheck || Date.now() - lastCheck > LICENSE_CHECK_INTERVAL_MS;
}

function applyLicenseStatus(status) {
  const isActive = status?.activo !== false;
  if (isActive) {
    licenseBlocker?.classList.add("hidden");
    document.body.classList.remove("license-locked");
    return;
  }

  if (licenseBlockerMessage) {
    licenseBlockerMessage.textContent = status?.mensaje || DEFAULT_LICENSE_MESSAGE;
  }
  document.body.classList.add("license-locked");
  licenseBlocker?.classList.remove("hidden");
}

async function checkRemoteLicense({ force = false } = {}) {
  const storedStatus = readStoredLicenseStatus();
  if (storedStatus) applyLicenseStatus(storedStatus);
  const mustRefreshBlockedStatus = storedStatus?.activo === false;
  if (!force && !mustRefreshBlockedStatus && !shouldCheckLicense()) return;

  try {
    const response = await fetch(`${LICENSE_STATUS_URL}?t=${Date.now()}`, {
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Revision de licencia fallo: ${response.status}`);
    const remoteStatus = await response.json();
    storeLicenseStatus(remoteStatus);
    applyLicenseStatus(remoteStatus);
  } catch (error) {
    console.warn("No se pudo revisar la licencia remota. Se mantiene el ultimo estado conocido.", error);
  }
}

// ===== Tipo de recetario =====
function activateTemplate(template) {
  state.template = template || "ambulatorio";
  tabs.forEach((item) => item.classList.toggle("active", item.dataset.template === state.template));
  const isInternado = state.template === "internado";
  const isUti = state.template === "utiUcin";
  document
    .querySelectorAll(".internado-only")
    .forEach((item) => item.classList.toggle("hidden", !isInternado));
  document
    .querySelectorAll(".ambulatorio-only")
    .forEach((item) => item.classList.toggle("hidden", state.template !== "ambulatorio"));
  document
    .querySelectorAll(".stay-only")
    .forEach((item) => item.classList.toggle("hidden", !(isInternado || isUti)));
  document.querySelectorAll(".uti-only").forEach((item) => item.classList.toggle("hidden", !isUti));
  document.querySelectorAll(".non-uti-only").forEach((item) => item.classList.toggle("hidden", isUti));
  document.querySelectorAll(".secondary-extra").forEach((item) => item.classList.toggle("hidden", isUti));
  render();
}

// ===== Recetas guardadas =====
function readSavedRecipes() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVED_RECIPES_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("No se pudieron leer las recetas guardadas.", error);
    return [];
  }
}

function writeSavedRecipes(recipes) {
  localStorage.setItem(SAVED_RECIPES_KEY, JSON.stringify(recipes));
}

function saveCurrentRecipe() {
  const formData = serializeForm();
  const missing = [
    !formData.paternalSurname?.trim() && "apellido paterno",
    !formData.givenNames?.trim() && "nombres",
  ].filter(Boolean);
  if (missing.length && !window.confirm(`Falta: ${missing.join(" y ")} del paciente.\n¿Guardar la receta de todos modos?`)) {
    return;
  }

  const recipes = readSavedRecipes();
  const snapshot = buildRecipeSnapshot();
  const existingIndex = recipes.findIndex((recipe) => recipe.id === state.currentSavedId);

  if (existingIndex >= 0) {
    recipes[existingIndex] = {
      ...recipes[existingIndex],
      ...snapshot,
      id: state.currentSavedId,
      createdAt: recipes[existingIndex].createdAt,
      updatedAt: new Date().toISOString(),
    };
  } else {
    recipes.unshift(snapshot);
    state.currentSavedId = snapshot.id;
  }

  try {
    writeSavedRecipes(recipes);
  } catch (error) {
    console.error("No se pudo guardar la receta.", error);
    mostrarAviso("No se pudo guardar: la memoria del navegador está llena. Exporte un respaldo y borre recetas antiguas.", "error");
    return;
  }
  saveDraft();
  saveRecipeButton.classList.add("saved-flash");
  window.setTimeout(() => saveRecipeButton.classList.remove("saved-flash"), 700);
  mostrarAviso(existingIndex >= 0 ? "Receta actualizada" : "Receta guardada");
}

function buildRecipeSnapshot() {
  const formData = serializeForm();
  return {
    id: state.currentSavedId || crypto.randomUUID?.() || `receta-${Date.now()}`,
    template: state.template,
    title: recipeSnapshotTitle(formData),
    formData,
    medicines: state.medicines,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function recipeSnapshotTitle(formData) {
  const templateName = {
    ambulatorio: "Ambulatorio",
    internado: "Internado",
    utiUcin: "UTI / UCIN",
  }[state.template] || "Receta";
  const patient = [formData.paternalSurname, formData.maternalSurname, formData.givenNames].filter(Boolean).join(" ");
  const record = formData.clinicalRecord ? `Exp. ${formData.clinicalRecord}` : "Sin expediente";
  const date = formData.requestDate || new Date().toISOString().slice(0, 10);
  return `${templateName} - ${patient || "Sin nombre"} - ${record} - ${date}`;
}

function serializeForm() {
  const data = {};
  Array.from(form.elements).forEach((element) => {
    if (!element.name || element.disabled) return;
    if (element.type === "checkbox") {
      data[element.name] = element.checked;
      return;
    }
    if (element.type === "radio") {
      if (element.checked) data[element.name] = element.value;
      else if (!(element.name in data)) data[element.name] = "";
      return;
    }
    data[element.name] = element.value;
  });
  return data;
}

function restoreForm(formData = {}) {
  form.reset();
  Array.from(form.elements).forEach((element) => {
    if (!element.name || element.disabled) return;
    if (element.type === "checkbox") {
      element.checked = Boolean(formData[element.name]);
      return;
    }
    if (element.type === "radio") {
      element.checked = formData[element.name] === element.value;
      return;
    }
    element.value = formData[element.name] || "";
  });
}

function openSavedRecipes() {
  if (savedSearchInput) savedSearchInput.value = "";
  renderSavedRecipesList();
  if (typeof savedDialog.showModal === "function") savedDialog.showModal();
  else savedDialog.setAttribute("open", "");
}

function recipeMatchesSearch(recipe, terms) {
  const data = recipe.formData || {};
  const haystack = normalizar(
    [recipe.title, data.clinicalRecord, data.paternalSurname, data.maternalSurname, data.givenNames, data.identityCard].join(" "),
  );
  return terms.every((term) => haystack.includes(term));
}

function renderSavedRecipesList() {
  const allRecipes = readSavedRecipes();
  const terms = normalizar(savedSearchInput?.value).split(" ").filter(Boolean);
  const recipes = terms.length ? allRecipes.filter((recipe) => recipeMatchesSearch(recipe, terms)) : allRecipes;
  if (savedSearchCount) {
    savedSearchCount.textContent = terms.length
      ? `${recipes.length} de ${allRecipes.length} recetas`
      : `${allRecipes.length} ${allRecipes.length === 1 ? "receta guardada" : "recetas guardadas"}`;
  }
  if (!allRecipes.length) {
    savedRecipesList.innerHTML = '<p class="empty saved-empty">No hay recetas guardadas todavia.</p>';
    return;
  }
  if (!recipes.length) {
    savedRecipesList.innerHTML = '<p class="empty saved-empty">No se encontraron recetas con esa busqueda.</p>';
    return;
  }

  savedRecipesList.innerHTML = recipes
    .map(
      (recipe) => `
        <article class="saved-recipe-card">
          <div>
            <strong>${safe(recipe.title)}</strong>
            <span>${safe(formatSavedDate(recipe.updatedAt || recipe.createdAt))}</span>
          </div>
          <div class="saved-recipe-actions">
            <button class="secondary-button icon-button compact-button" type="button" data-load-id="${safe(recipe.id)}">
              <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
              <span>Cargar</span>
            </button>
            <button class="remove-button icon-button compact-button" type="button" data-delete-id="${safe(recipe.id)}">
              <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 15H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
              <span>Borrar</span>
            </button>
          </div>
        </article>
      `,
    )
    .join("");

  savedRecipesList.querySelectorAll("[data-load-id]").forEach((button) => {
    button.addEventListener("click", () => loadSavedRecipe(button.dataset.loadId));
  });
  savedRecipesList.querySelectorAll("[data-delete-id]").forEach((button) => {
    button.addEventListener("click", () => deleteSavedRecipe(button.dataset.deleteId));
  });
}

function loadSavedRecipe(id) {
  const recipe = readSavedRecipes().find((item) => item.id === id);
  if (!recipe) return;
  state.currentSavedId = recipe.id;
  state.medicines = Array.isArray(recipe.medicines) ? recipe.medicines : [];
  restoreForm(recipe.formData);
  clearPendingMedicine();
  activateTemplate(recipe.template);
  savedDialog.close();
}

function deleteSavedRecipe(id) {
  const recipe = readSavedRecipes().find((item) => item.id === id);
  if (!recipe) return;
  if (!window.confirm(`¿Borrar esta receta guardada?\n\n${recipe.title}\n\nNo se podrá recuperar.`)) return;
  const recipes = readSavedRecipes().filter((item) => item.id !== id);
  if (state.currentSavedId === id) state.currentSavedId = null;
  writeSavedRecipes(recipes);
  renderSavedRecipesList();
}

function exportSavedRecipes() {
  const recipes = readSavedRecipes();
  const payload = {
    app: APP_NAME,
    exportedAt: new Date().toISOString(),
    recipes,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `recetas-guardadas-la-portada-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

async function importSavedRecipes(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const imported = Array.isArray(parsed) ? parsed : parsed.recipes;
    if (!Array.isArray(imported)) throw new Error("Formato no valido");
    const current = readSavedRecipes();
    const merged = [...imported, ...current].reduce((accumulator, recipe) => {
      if (recipe?.id && !accumulator.some((item) => item.id === recipe.id)) accumulator.push(recipe);
      return accumulator;
    }, []);
    writeSavedRecipes(merged);
    renderSavedRecipesList();
    openSavedRecipes();
  } catch (error) {
    console.error("No se pudo importar el respaldo.", error);
    alert("No se pudo importar el respaldo. Verifica que sea un archivo JSON exportado desde esta app.");
  }
}

function formatSavedDate(value) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("es-BO", { dateStyle: "short", timeStyle: "short" });
}

// ===== Borrador automatico (se recupera si la app se recarga, p. ej. al actualizarse) =====
let draftTimer = null;

function saveDraft() {
  try {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        template: state.template,
        formData: serializeForm(),
        medicines: state.medicines,
        currentSavedId: state.currentSavedId,
        savedAt: Date.now(),
      }),
    );
  } catch (error) {
    console.warn("No se pudo guardar el borrador.", error);
  }
}

function scheduleDraftSave() {
  clearTimeout(draftTimer);
  draftTimer = setTimeout(saveDraft, 400);
}

function clearDraft() {
  clearTimeout(draftTimer);
  localStorage.removeItem(DRAFT_KEY);
}

function draftHasContent(draft) {
  if (draft.medicines?.length) return true;
  return Object.entries(draft.formData || {}).some(
    ([key, value]) => key !== "printLayout" && value !== "" && value !== false,
  );
}

function restoreDraft() {
  let draft = null;
  try {
    draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
  } catch (error) {
    draft = null;
  }
  if (!draft || Date.now() - (draft.savedAt || 0) > DRAFT_MAX_AGE_MS || !draftHasContent(draft)) {
    clearDraft();
    return false;
  }
  restoreForm(draft.formData);
  state.medicines = Array.isArray(draft.medicines) ? draft.medicines : [];
  state.currentSavedId = draft.currentSavedId || null;
  activateTemplate(draft.template);
  mostrarAviso("Se recuperó la receta que estaba llenando");
  return true;
}

// ===== PDF =====
async function generatePdf() {
  if (isMobilePdfFlow()) {
    window.print();
    return;
  }

  const button = pdfButton;
  const originalText = pdfButtonLabel?.textContent || "Generar PDF";

  try {
    button.disabled = true;
    if (pdfButtonLabel) pdfButtonLabel.textContent = "Generando...";
    preview.classList.add("pdf-exporting");
    await loadPdfLibraries();

    const canvas = await window.html2canvas(preview, {
      backgroundColor: "#ffffff",
      scale: 2.5,
      useCORS: true,
      width: preview.scrollWidth,
      height: preview.scrollHeight,
      windowWidth: preview.scrollWidth,
      windowHeight: preview.scrollHeight,
    });

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
      orientation: preview.classList.contains("is-half-copies") ? "landscape" : "portrait",
      unit: "pt",
      format: "letter",
    });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imageRatio = canvas.width / canvas.height;
    let imageWidth = pageWidth;
    let imageHeight = imageWidth / imageRatio;

    if (imageHeight > pageHeight) {
      imageHeight = pageHeight;
      imageWidth = imageHeight * imageRatio;
    }

    const offsetX = (pageWidth - imageWidth) / 2;
    const offsetY = (pageHeight - imageHeight) / 2;
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", offsetX, offsetY, imageWidth, imageHeight);
    pdf.save(pdfFileName());
  } catch (error) {
    console.error("No se pudo generar el PDF.", error);
    alert("No se pudo generar el PDF. Usa el boton Imprimir y elige \"Guardar como PDF\".");
  } finally {
    preview.classList.remove("pdf-exporting");
    button.disabled = false;
    if (pdfButtonLabel) pdfButtonLabel.textContent = originalText;
  }
}

function updatePdfButtonLabel() {
  if (!pdfButtonLabel) return;
  pdfButtonLabel.textContent = isMobilePdfFlow() ? "Guardar PDF" : "Generar PDF";
}

function isMobilePdfFlow() {
  const userAgent = navigator.userAgent || "";
  const isAndroidOrIos = /Android|iPhone|iPad|iPod/i.test(userAgent);
  const isIpadDesktopMode = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return isAndroidOrIos || isIpadDesktopMode;
}

// Librerias incluidas en la app (carpeta vendor/): el PDF se genera sin internet.
function loadPdfLibraries() {
  if (window.html2canvas && window.jspdf?.jsPDF) return Promise.resolve();

  return Promise.all([loadScript("./vendor/html2canvas.min.js"), loadScript("./vendor/jspdf.umd.min.js")]);
}

function loadScript(src) {
  const existing = document.querySelector(`script[src="${src}"]`);
  if (existing) {
    return existing.dataset.loaded === "true"
      ? Promise.resolve()
      : new Promise((resolve, reject) => {
          existing.addEventListener("load", resolve, { once: true });
          existing.addEventListener("error", reject, { once: true });
        });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
    document.head.appendChild(script);
  });
}

function pdfFileName() {
  const templateName = {
    ambulatorio: "ambulatorio",
    internado: "internado",
    utiUcin: "uti-ucin",
  }[state.template] || "recetario";
  return `recetario-${templateName}-${new Date().toISOString().slice(0, 10)}.pdf`;
}

// ===== Datos: medicamentos (FarmaCheck) y diagnosticos (Cartera de Servicios) =====
const limpiarCodigo = (codigo) => String(codigo ?? "").trim().toUpperCase().replace(/\s+/g, "");

function prepararMedicamentos(lista) {
  return lista
    .filter((item) => item && item.medicamento)
    .map((item) => ({
      code: item.codigo || "",
      name: String(item.medicamento || "").trim(),
      concentration: String(item.concentracion || "").trim(),
      form: String(item.forma || "").trim(),
      observation: String(item.observacion || "").trim(),
      controlado: item.controlado || (CONTROLADOS.test(item.medicamento || "") ? "controlado" : ""),
      route: "",
    }));
}

// Une las filas repetidas (mismo codigo y nombre en AMBULATORIO e INTERNADO) en una sola opcion.
function prepararDiagnosticos(lista) {
  const porClave = new Map();
  lista.forEach((item) => {
    const code = limpiarCodigo(item.CODIGO);
    const name = String(item.SERVICIO ?? "").trim();
    if (!code && !name) return;
    const key = `${code}|${normalizar(name)}`;
    if (!porClave.has(key)) porClave.set(key, { code, name, types: new Set(), search: normalizar(`${code} ${name}`) });
    const type = String(item["TIPO DE PACIENTE"] ?? "").trim().toUpperCase();
    if (type) porClave.get(key).types.add(type);
  });
  return [...porClave.values()];
}

async function loadLocalData() {
  const [medicineResult, diagnosisResult] = await Promise.allSettled([
    cargarFuente({
      ...FUENTE_MEDICAMENTOS,
      cache: DATA_CACHE,
      clave: "recetario-la-portada-medicamentos",
      validar: (data) => Array.isArray(data) && data.length > 0 && data.some((item) => item?.medicamento),
    }),
    cargarFuente({
      ...FUENTE_DIAGNOSTICOS,
      cache: DATA_CACHE,
      clave: "recetario-la-portada-diagnosticos",
      validar: (data) => Array.isArray(data) && data.length > 0 && data.some((item) => item?.CODIGO),
    }),
  ]);

  if (medicineResult.status === "fulfilled") {
    medicines = prepararMedicamentos(medicineResult.value.data);
    medicines.forEach((medicine) => (medicine.search = normalizar(medicineLabel(medicine))));
    dataStatus.medicamentos = medicineResult.value;
  } else {
    console.warn("No se pudieron cargar los medicamentos.", medicineResult.reason);
  }

  if (diagnosisResult.status === "fulfilled") {
    diagnoses = prepararDiagnosticos(diagnosisResult.value.data);
    dataStatus.diagnosticos = diagnosisResult.value;
  } else {
    console.warn("No se pudieron cargar los diagnosticos.", diagnosisResult.reason);
  }

  renderDataStatus();
  render();
}

function renderDataStatus() {
  if (!dataStatusLine) return;
  const med = dataStatus.medicamentos;
  const dx = dataStatus.diagnosticos;
  dataStatusLine.innerHTML =
    `<span><strong>Medicamentos (FarmaCheck):</strong> ${escapeHtml(textoOrigen(med))}</span>` +
    `<span><strong>Diagnósticos (Cartera de Servicios):</strong> ${escapeHtml(textoOrigen(dx))}</span>`;
  dataStatusLine.classList.toggle("is-offline", Boolean((med && med.origen !== "en-linea") || (dx && dx.origen !== "en-linea")));
}

// ===== Medicamentos: buscador, restricciones y cantidad en literal =====
function medicinesForCurrentPatient() {
  return medicines;
}

function medicineLabel(medicine) {
  return [medicine.name, medicine.concentration, medicine.form].filter(Boolean).join(" ");
}

function isControlled(medicine) {
  return Boolean(medicine?.controlado);
}

function controlledUnit(medicine) {
  return UNIDAD_CONTROLADO.find((unit) => unit.patron.test(medicine.form || "")) || UNIDAD_CONTROLADO[0];
}

function quantityInWords(medicine, quantity) {
  const amount = Number(quantity);
  const unit = controlledUnit(medicine);
  const words = numeroALetras(amount, { femenino: unit.femenino });
  if (!words) return "";
  return `${words} ${amount === 1 ? unit.singular : unit.plural}`;
}

// Texto que se imprime en la columna de medicamentos.
// Controlados: nombre + concentracion + (presentacion) + (cantidad en literal). Nada despues del parentesis.
// La presentacion "(Ampolla de 10 ml)" de FarmaCheck se escribe despues de la concentracion, como en el
// modelo de prescripcion: "Citrato de Fentanilo 0,05 mg/ml (ampolla de 10 ml) (tres ampollas)".
function printedLabel(medicine) {
  if (!isControlled(medicine)) return medicineLabel(medicine);
  const literal = quantityInWords(medicine, medicine.quantity);
  const presentation = `${medicine.name} ${medicine.form}`.match(/\(\s*ampolla[^)]*\)/i)?.[0] || "";
  const name = medicine.name.replace(/\s*\(\s*ampolla[^)]*\)/i, "").trim();
  const base = [name, medicine.concentration, presentation.replace(/\(\s*A/, "(a")].filter(Boolean).join(" ");
  return literal ? `${base} (${literal})` : base;
}

function hasRestriction(medicine) {
  const text = normalizar(medicine?.observation);
  return Boolean(text) && text !== "sin restriccion";
}

function medicineNotes(medicine) {
  const notes = [];
  if (hasRestriction(medicine)) {
    notes.push(`<span class="med-note med-note-restriccion">⚠ ${escapeHtml(medicine.observation)}</span>`);
  }
  if (isControlled(medicine)) {
    const tipo = { estupefaciente: "Estupefaciente", psicotropico: "Psicotrópico" }[medicine.controlado] || "Controlado";
    notes.push(`<span class="med-note med-note-controlado">${tipo} · cantidad en literal</span>`);
  }
  return notes.join("");
}

function findMedicine(value) {
  const normalizedValue = normalizar(value);
  return (
    medicinesForCurrentPatient().find((medicine) => medicine.search === normalizedValue) ||
    medicines.find((medicine) => medicine.search === normalizedValue)
  );
}

function freeTextMedicine(value) {
  return {
    name: value,
    concentration: "",
    form: "",
    route: "",
    freeText: true,
  };
}

function searchMedicines(text) {
  const terms = normalizar(text).split(" ").filter(Boolean);
  return medicinesForCurrentPatient()
    .filter((medicine) => terms.every((term) => medicine.search.includes(term)))
    .sort((a, b) => Number(!a.search.startsWith(terms[0])) - Number(!b.search.startsWith(terms[0])))
    .slice(0, 30)
    .map((medicine) => ({ medicine }));
}

crearBuscador(medicineInput, {
  buscar: searchMedicines,
  pintar: ({ medicine }) =>
    `<span class="buscador-principal">${escapeHtml(medicineLabel(medicine))}</span>` +
    `${hasRestriction(medicine) ? `<small class="buscador-nota">⚠ ${escapeHtml(medicine.observation)}</small>` : ""}`,
  elegir: ({ medicine }) => {
    medicineInput.value = medicineLabel(medicine);
    state.pendingMedicine = medicine;
    renderMedicineHint();
    quantityInput.focus();
    quantityInput.select();
  },
});

medicineInput.addEventListener("input", () => {
  if (state.pendingMedicine && normalizar(medicineInput.value) !== state.pendingMedicine.search) {
    state.pendingMedicine = null;
  }
  renderMedicineHint();
});
quantityInput.addEventListener("input", renderMedicineHint);

function pendingMedicine() {
  return state.pendingMedicine || (medicineInput.value.trim() ? findMedicine(medicineInput.value) : null);
}

function renderMedicineHint() {
  if (!medicineHint) return;
  const medicine = pendingMedicine();
  if (!medicine) {
    medicineHint.innerHTML = "";
    medicineHint.hidden = true;
    return;
  }
  const parts = [];
  if (hasRestriction(medicine)) {
    parts.push(`<div class="hint-restriccion">⚠ <strong>Restricción:</strong> ${escapeHtml(medicine.observation)}</div>`);
  }
  if (isControlled(medicine)) {
    const quantity = sanitizeQuantity(quantityInput.value);
    parts.push(
      `<div class="hint-controlado"><strong>Se imprimirá:</strong> ${escapeHtml(printedLabel({ ...medicine, quantity }))}</div>`,
    );
  }
  medicineHint.innerHTML = parts.join("");
  medicineHint.hidden = !parts.length;
}

function clearPendingMedicine() {
  state.pendingMedicine = null;
  renderMedicineHint();
}

function sanitizeQuantity(value) {
  const number = Math.round(Number(value));
  return Number.isFinite(number) && number >= 1 ? number : 1;
}

document.querySelector("#addMedicineBtn").addEventListener("click", () => {
  const rawMedicine = medicineInput.value.trim();
  if (!rawMedicine) {
    medicineInput.focus();
    return;
  }
  const selected = pendingMedicine();
  const quantity = sanitizeQuantity(quantityInput.value);
  const instruction = instructionInput.value.trim();

  const base = selected ? { ...selected } : freeTextMedicine(rawMedicine);
  delete base.search;
  state.medicines.push({ ...base, quantity, instruction });

  medicineInput.value = "";
  quantityInput.value = "1";
  instructionInput.value = "";
  clearPendingMedicine();
  render();
  medicineInput.focus();
});

// ===== Diagnosticos: buscador por nombre o codigo =====
// sin signos de puntuacion, para que "neumonia no esp" encuentre "Neumonía, no especificada"
const sinSignos = (texto) => texto.replace(/[^a-z0-9. ]/g, " ").replace(/\s+/g, " ").trim();

// En receta ambulatoria salen primero los diagnosticos AMBULATORIO; en internado y UTI, los INTERNADO.
function searchDiagnoses(text) {
  const preferredType = state.template === "ambulatorio" ? "AMBULATORIO" : "INTERNADO";
  const query = sinSignos(normalizar(text));
  const terms = query.split(" ").filter(Boolean);
  const matches = [];
  for (const item of diagnoses) {
    if (!terms.every((term) => item.search.includes(term))) continue;
    const name = sinSignos(normalizar(item.name));
    const rank = item.code.toLowerCase().startsWith(query) ? 0 : name.startsWith(query) ? 1 : name.includes(query) ? 2 : 3;
    const otherType = item.types.size && !item.types.has(preferredType) ? 1 : 0;
    matches.push({ item, rank, otherType, length: name.length });
  }
  return matches
    .sort((a, b) => a.otherType - b.otherType || a.rank - b.rank || a.length - b.length || a.item.code.localeCompare(b.item.code))
    .slice(0, 20)
    .map((match) => match.item);
}

function findDiagnosisByCode(code) {
  const normalizedCode = limpiarCodigo(code);
  return diagnoses.find((diagnosis) => diagnosis.code === normalizedCode);
}

function connectDiagnosisFields(nameInput, codeInput) {
  if (!nameInput || !codeInput) return;
  crearBuscador(nameInput, {
    minimo: 2,
    buscar: searchDiagnoses,
    pintar: (item) =>
      `<span class="buscador-codigo">${escapeHtml(item.code)}</span> <span class="buscador-principal">${escapeHtml(item.name)}</span>` +
      [...item.types].map((type) => ` <em class="buscador-etiqueta">${type === "AMBULATORIO" ? "Amb." : "Int."}</em>`).join(""),
    elegir: (item) => {
      nameInput.value = item.name;
      codeInput.value = item.code;
      render();
    },
  });
  // escribir solo el codigo completa el nombre si esta vacio
  codeInput.addEventListener("change", () => {
    const found = findDiagnosisByCode(codeInput.value);
    if (!found) return;
    codeInput.value = found.code;
    if (!nameInput.value.trim()) nameInput.value = found.name;
    render();
  });
}

connectDiagnosisFields(form.elements.diagnosis, form.elements.cie10);
connectDiagnosisFields(form.elements.admissionDiagnosis, form.elements.admissionDiagnosisCode);
Array.from({ length: 5 }, (_, index) => index + 1).forEach((number) => {
  connectDiagnosisFields(form.elements[`secondaryDiagnosis${number}`], form.elements[`secondaryCode${number}`]);
});

function populateServiceOptions() {
  const options = `<option value=""></option>${clinicalServices
    .map((service) => `<option value="${safe(service)}">${safe(service)}</option>`)
    .join("")}`;
  ["#serviceSelect", "#admissionServiceSelect", "#dischargeServiceSelect", "#utiAdmissionServiceSelect"].forEach((selector) => {
    const select = document.querySelector(selector);
    if (select) select.innerHTML = options;
  });
}

function renderCheckOptions(prefix, options) {
  return options
    .map(
      (option, index) => `
        <label class="check-option">
          <input type="checkbox" name="${prefix}${index}" />
          <span>${safe(option)}</span>
        </label>
      `,
    )
    .join("");
}

function getData() {
  return Object.fromEntries(new FormData(form).entries());
}

function splitDate(value) {
  if (!value) return { day: "", month: "", year: "" };
  const [year, month, day] = value.split("-");
  return { day, month, year };
}

// ===== Lista de medicamentos agregados (editable) =====
function renderMedicineList() {
  if (!state.medicines.length) {
    medicineList.innerHTML = '<p class="empty">Sin medicamentos agregados.</p>';
    return;
  }

  medicineList.innerHTML = state.medicines
    .map(
      (medicine, index) => `
        <div class="medicine-row" data-index="${index}">
          <div class="medicine-row-name">
            <strong data-label>${escapeHtml(printedLabel(medicine))}</strong>
            ${medicineNotes(medicine)}
          </div>
          <label class="medicine-row-field medicine-row-qty">
            <span>Cant.</span>
            <input type="number" min="1" step="1" inputmode="numeric" value="${escapeHtml(medicine.quantity)}" data-edit="quantity" aria-label="Cantidad" />
          </label>
          <label class="medicine-row-field medicine-row-instr">
            <span>Indicación</span>
            <input value="${escapeHtml(medicine.instruction || "")}" data-edit="instruction" aria-label="Indicacion" />
          </label>
          <button class="remove-button" type="button" data-remove="${index}">Quitar</button>
        </div>
      `,
    )
    .join("");

  const capacity = medicineCapacity();
  if (state.medicines.length > capacity) {
    medicineList.insertAdjacentHTML(
      "beforeend",
      `<p class="empty capacity-warning">Aviso: este recetario tiene espacio para ${capacity} medicamentos${getData().printLayout === "halfCopies" ? " en dos copias" : ""}. Los ${state.medicines.length - capacity} restantes no se imprimiran.</p>`,
    );
  }
}

medicineList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove]");
  if (!button) return;
  state.medicines.splice(Number(button.dataset.remove), 1);
  render();
});

medicineList.addEventListener("input", (event) => {
  const field = event.target.closest("[data-edit]");
  if (!field) return;
  const row = field.closest(".medicine-row");
  const medicine = state.medicines[Number(row.dataset.index)];
  if (!medicine) return;
  if (field.dataset.edit === "quantity") {
    if (field.value === "") return;
    medicine.quantity = sanitizeQuantity(field.value);
    row.querySelector("[data-label]").textContent = printedLabel(medicine);
  } else {
    medicine.instruction = field.value;
  }
  renderPreview();
  scheduleDraftSave();
});

medicineList.addEventListener("change", (event) => {
  const field = event.target.closest('[data-edit="quantity"]');
  if (!field) return;
  const medicine = state.medicines[Number(field.closest(".medicine-row").dataset.index)];
  if (medicine) field.value = medicine.quantity;
});

function renderPreview() {
  const data = getData();
  const isHalfCopies = data.printLayout === "halfCopies";
  preview.classList.remove("pdf-preview-page");
  preview.classList.toggle("is-ambulatorio", state.template === "ambulatorio");
  preview.classList.toggle("is-internado", state.template === "internado");
  preview.classList.toggle("is-uti-ucin", state.template === "utiUcin");
  preview.classList.toggle("is-half-copies", isHalfCopies);
  preview.classList.toggle("is-full-page", !isHalfCopies);

  let recipeHtml = "";
  if (state.template === "internado") {
    recipeHtml = renderInternadoRecipe(data);
  } else if (state.template === "utiUcin") {
    recipeHtml = renderUtiUcinRecipe(data);
  } else {
    recipeHtml = renderAmbulatorioRecipe(data);
  }

  preview.innerHTML = isHalfCopies ? renderHalfSheetCopies(recipeHtml) : recipeHtml;
  updatePrintPageStyle(data.printLayout);
}

function updatePrintPageStyle(layout) {
  let styleEl = document.querySelector("#printPageStyle");
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = "printPageStyle";
    document.head.appendChild(styleEl);
  }
  if (layout === "halfCopies") {
    styleEl.innerHTML = "@page { size: letter landscape; margin: 0; }";
  } else {
    styleEl.innerHTML = "@page { size: letter portrait; margin: 0; }";
  }
}

function renderHalfSheetCopies(recipeHtml) {
  return `
    <div class="half-sheet-copy">
      <div class="half-copy-content">${recipeHtml}</div>
    </div>
    <div class="sheet-cut-line" aria-hidden="true"></div>
    <div class="half-sheet-copy">
      <div class="half-copy-content">${recipeHtml}</div>
    </div>
  `;
}

function splitPatientName(value) {
  const parts = (value || "").trim().split(/\s+/);
  return {
    paternal: parts[0] || "",
    maternal: parts[1] || "",
    names: parts.slice(2).join(" "),
  };
}

function getPatientParts(data) {
  if (data.paternalSurname || data.maternalSurname || data.givenNames) {
    return {
      paternal: data.paternalSurname || "",
      maternal: data.maternalSurname || "",
      names: data.givenNames || "",
    };
  }

  return splitPatientName(data.patientName);
}

function safe(value) {
  if (value === undefined || value === null || value === "") return "&nbsp;";
  return escapeHtml(value);
}

// ===== Recetarios oficiales del Hospital Municipal La Portada =====
// Filas de medicamentos de cada hoja (carta completa / dos copias). Los medicamentos que no caben no se imprimen
// para que la hoja no se desconfigure; el formulario avisa.
function medicineCapacity(template = state.template) {
  const isHalfCopies = getData().printLayout === "halfCopies";
  if (template === "utiUcin") return 20;
  if (template === "internado") return isHalfCopies ? 12 : 15;
  return isHalfCopies ? 12 : 17;
}

function renderAmbulatorioRecipe(data) {
  const isHalfCopies = data.printLayout === "halfCopies";
  const minRows = isHalfCopies ? 12 : 17;
  return `
    <div class="legal-template legal-ambulatorio">
      ${renderAmbulatorioOfficialHeader(data)}
      ${renderManualServices(data)}
      ${renderManualMedicines(minRows, true)}
      ${renderManualCostAndSignatures(data)}
    </div>
  `;
}

function renderInternadoRecipe(data) {
  const isHalfCopies = data.printLayout === "halfCopies";
  const minRows = isHalfCopies ? 12 : 15;
  return `
    <div class="legal-template legal-internado">
      ${renderInternadoOfficialHeader(data)}
      ${renderManualProcedures(data)}
      ${renderManualMedicines(minRows, false)}
      ${renderManualCostAndSignatures(data)}
    </div>
  `;
}

function renderAmbulatorioOfficialHeader(data) {
  const requestDate = splitDate(data.requestDate);
  const birthDate = splitDate(data.birthDate);
  const patient = getPatientParts(data);
  const sidePanelExtra = renderOfficialSideDates(data, birthDate, requestDate);
  return `
    <section class="official-header official-header-ambulatorio">
      ${renderHeaderLogos()}
      ${renderOfficialBrand()}
      <div class="official-title official-title-ambulatorio">
        RECETARIO / RECIBO<br>ATENCION AMBULATORIA
      </div>
      <div class="official-ambulatorio-side">${renderOfficialPatientTypePanel(data, sidePanelExtra, true)}</div>
    </section>
    <section class="official-meta-lines">
      <div><strong>SEDES:</strong> LA PAZ</div>
      <div><strong>RED:</strong> 2 NOR OESTE</div>
      <div><strong>Municipio:</strong> LA PAZ</div>
      <div><strong>Establecimiento:</strong> HOSPITAL MUNICIPAL LA PORTADA</div>
    </section>
    <section class="official-form official-form-ambulatorio">
      <div class="official-row official-attention-row">
        <strong>Tipo de Atencion:</strong>
        ${renderOfficialCheck("EN CONSULTORIO", data.attentionType === "EN CONSULTORIO")}
        ${renderOfficialCheck("DOMICILIARIA", data.attentionType === "DOMICILIARIA")}
        ${renderOfficialCheck("EMERGENCIAS", data.attentionType === "EMERGENCIAS")}
        ${renderOfficialCheck("REFERENCIA", data.attentionType === "REFERENCIA")}
      </div>
      <div class="official-two-col">
        ${renderOfficialDottedField("Apellido paterno:", patient.paternal)}
        ${renderOfficialDottedField("Apellido materno:", patient.maternal)}
      </div>
      ${renderOfficialDottedField("Nombres:", patient.names)}
      ${renderOfficialDottedField("Domicilio:", data.address)}
      ${renderOfficialDiagnosisBlock(data, false)}
    </section>
  `;
}

function renderInternadoOfficialHeader(data) {
  const requestDate = splitDate(data.requestDate);
  const birthDate = splitDate(data.birthDate);
  const admissionDate = splitDate(data.admissionDate);
  const dischargeDate = splitDate(data.dischargeDate);
  const patient = getPatientParts(data);

  return `
    <section class="official-header official-header-internado">
      ${renderHeaderLogos()}
      <div class="official-address">
        Hospital Municipal La Portada<br>
        Zona La Portada/ Av. La Florida<br>
        Calle s/n Macrodistrito II
      </div>
      <div class="official-title official-title-strong">RECETARIO / RECIBO<br>ATENCION DEL PACIENTE INTERNADO</div>
      ${renderOfficialPatientTypePanel(data, "", true, false)}
    </section>
    <section class="official-meta-lines internado-meta">
      <div><strong>SEDES:</strong> LA PAZ</div>
      <div><strong>RED:</strong> 2 NOR OESTE</div>
      <div><strong>Municipio:</strong> LA PAZ</div>
      <div><strong>Establecimiento:</strong> HOSPITAL MUNICIPAL LA PORTADA</div>
    </section>
    <section class="official-form official-form-internado">
      <div class="official-two-col">
        ${renderOfficialDottedField("APELLIDO PATERNO:", patient.paternal)}
        ${renderOfficialDottedField("APELLIDO MATERNO:", patient.maternal)}
      </div>
      <div class="official-row with-side-date">
        ${renderOfficialDottedField("NOMBRES:", patient.names)}
        <div class="official-sex-date">
          <span>SEXO:</span>
          ${renderOfficialCheck("F", data.sex === "F")}
          ${renderOfficialCheck("M", data.sex === "M")}
          ${renderOfficialDate("FECHA DE NACIMIENTO", birthDate)}
        </div>
      </div>
      <div class="official-row with-side-date">
        ${renderOfficialDottedField("DOMICILIO:", data.address)}
        ${renderOfficialDate("FECHA DE SOLICITUD", requestDate)}
      </div>
      <div class="official-row official-attention-row">
        <strong>INGRESO:</strong>
        ${renderOfficialCheck("Por referencia", data.admissionType === "Por referencia")}
        ${renderOfficialCheck("Por servicio de emergencia", data.admissionType === "Por servicio de emergencia")}
        ${renderOfficialCheck("Por trabajo de parto", data.admissionType === "Por trabajo de parto")}
        ${renderOfficialCheck("Por consultorio externo", data.admissionType === "Por consultorio externo")}
      </div>
      <div class="official-row with-side-date">
        ${renderOfficialDottedField("Servicio de ingreso:", data.admissionService || data.service)}
        ${renderOfficialDate("FECHA DE INGRESO", admissionDate)}
      </div>
      <div class="official-row with-side-date">
        ${renderOfficialDottedField("Servicio de alta:", data.dischargeService)}
        ${renderOfficialDate("FECHA DE EGRESO", dischargeDate)}
      </div>
      ${renderOfficialDiagnosisBlock(data, true)}
    </section>
  `;
}

// Logos institucionales de la cabecera. Van con position:absolute dentro de .official-header
// (ver bloque "LOGOS DE CABECERA" al final de styles.css), por lo que no ocupan espacio
// ni modifican ninguna medida del recetario.
const HEADER_LOGOS = [
  { cls: "logo-gamlp", src: "img/logo-gamlp.png" },
  { cls: "logo-hospital", src: "img/logo-hospital-humano.png" },
];

// Precarga para que no parpadeen al regenerar la vista previa en cada tecla.
HEADER_LOGOS.forEach((logo) => {
  const image = new Image();
  image.src = logo.src;
});

function renderHeaderLogos() {
  return HEADER_LOGOS.map(
    (logo) => `<img class="recipe-logo ${logo.cls}" src="${logo.src}" alt="" draggable="false">`,
  ).join("");
}

function renderOfficialBrand() {
  return `
    <div class="official-brand-left">
      <small>Hospital Municipal La Portada</small>
      <small>Zona La Portada/ Av. La Florida</small>
      <small>Calle s/n Macrodistrito II</small>
    </div>
  `;
}

function renderOfficialPatientTypePanel(data, extraContent = "", singleLineLabels = false, singularProgramLabel = singleLineLabels) {
  const patientProgram = ["VIH", "TUBERCULOSIS"].includes(data.patientType) ? data.patientType : "";
  const patientSale = ["SOAT", "RGL"].includes(data.patientType) ? data.patientType : "";
  const recordLabel = singleLineLabels ? "Nº DE EXPEDIENTE CLINICO:" : "Nº DE EXPEDIENTE<br>CLINICO:";
  const susLabel = singleLineLabels ? "SISTEMA UNICO DE SALUD:" : "SISTEMA UNICO DE SALUD:";
  const programLabel = singularProgramLabel ? "PROGRAMA:" : "PROGRAMAS:";

  return `
    <div class="official-patient-panel">
      <div><strong>${recordLabel}</strong><span>${safe(data.clinicalRecord)}</span></div>
      <div><strong>${susLabel}</strong><span>${data.patientType === "SUS" ? "S.U.S" : ""}</span></div>
      <div><strong>VENTA:</strong><span>${safe(patientSale)}</span></div>
      <div><strong>${programLabel}</strong><span>${safe(patientProgram)}</span></div>
      ${extraContent}
    </div>
  `;
}

function renderOfficialSideDates(data, birthDate, requestDate) {
  return `
    <div class="official-panel-extra">
      ${renderOfficialDate("FECHA DE NACIMIENTO", birthDate)}
      <div class="official-panel-request-row">
        <div class="official-panel-sex">
          <strong>Sexo:</strong>
          ${renderOfficialCheck("M", data.sex === "M")}
          ${renderOfficialCheck("F", data.sex === "F")}
        </div>
        ${renderOfficialDate("FECHA DE SOLICITUD", requestDate)}
      </div>
    </div>
  `;
}

function renderOfficialDottedField(label, value) {
  return `
    <div class="official-field">
      <span class="official-label">${safe(label)}</span>
      <span class="official-fill">${safe(value)}</span>
    </div>
  `;
}

function renderOfficialCheck(label, checked) {
  return `<span class="official-check">${safe(label)} ${renderOfficialBox(checked)}</span>`;
}

function renderOfficialBox(checked) {
  return `<span class="official-box">${checked ? "X" : ""}</span>`;
}

function renderOfficialDate(label, date) {
  return `
    <div class="official-date">
      <strong>${safe(label)}</strong>
      <span><em>DIA</em>${safe(date.day)}</span>
      <span><em>MES</em>${safe(date.month)}</span>
      <span><em>AÑO</em>${safe(date.year)}</span>
    </div>
  `;
}

function renderOfficialDiagnosisBlock(data, internado = false) {
  const secondaryRows = Array.from({ length: internado ? 3 : 4 }, (_, index) => {
    const number = index + 1;
    return {
      number,
      diagnosis: data[`secondaryDiagnosis${number}`] || "",
      code: data[`secondaryCode${number}`] || "",
    };
  });

  return `
    <section class="official-diagnosis ${internado ? "internado" : ""}">
      ${internado ? `
        <div class="official-diagnosis-title">
          <strong>DIAGNOSTICOS:</strong>
          <strong>CODIGO</strong>
        </div>
        <div class="official-diagnosis-row">
          <strong class="diagnosis-label main">Diagnostico Principal:</strong>
          <span class="official-fill">${safe(data.diagnosis)}</span>
          <span class="official-fill official-code">${safe(data.cie10)}</span>
        </div>
      ` : `
        <div class="official-diagnosis-row">
          <strong class="diagnosis-label main">Diagnostico Principal:</strong>
          <span class="official-fill">${safe(data.diagnosis)}</span>
          <span class="official-code-stack">
            <strong>CODIGO</strong>
            <span class="official-fill official-code">${safe(data.cie10)}</span>
          </span>
        </div>
      `}
      ${secondaryRows.map((row, index) => `
        <div class="official-diagnosis-row">
          <strong class="diagnosis-label">${index === 0 ? "Diagnosticos Secundarios:" : ""}</strong>
          <span class="diagnosis-number">${row.number}.-</span>
          <span class="official-fill">${safe(row.diagnosis)}</span>
          <span class="official-fill official-code">${safe(row.code)}</span>
        </div>
      `).join("")}
    </section>
  `;
}

function renderUtiUcinRecipe(data) {
  const birthDate = splitDate(data.birthDate);
  const admissionDate = splitDate(data.admissionDate);
  const dischargeDate = splitDate(data.dischargeDate);
  const patient = getPatientParts(data);
  const patientType = data.utiPatientType || "";

  return `
    <div class="legal-template uti-template">
      ${renderUtiOfficialHeader(data, patient, patientType, birthDate, admissionDate, dischargeDate)}

      ${renderUtiMedicines(20)}
      ${renderUtiObservations(data)}
      ${renderUtiFooter(data)}
    </div>
  `;
}

function renderUtiOfficialHeader(data, patient, patientType, birthDate, admissionDate, dischargeDate) {
  return `
    <section class="official-header uti-official-header">
      ${renderHeaderLogos()}
      <div class="official-address">
        Hospital Municipal La Portada<br>
        Zona La Portada/ Av. La Florida<br>
        Calle s/n Macrodistrito II
      </div>
      <div class="official-title official-title-strong">RECETARIO / RECIBO</div>
      <div class="uti-official-side">
        ${renderUtiPatientTypePanel(data, patientType)}
        ${renderOfficialDate("FECHA DE SOLICITUD", splitDate(data.requestDate))}
      </div>
    </section>
    <section class="uti-open-meta">
      <div><strong>SEDES</strong><span>LA PAZ</span></div>
      <div><strong>RED</strong><span>2 NOR OESTE</span></div>
      <div><strong>MUNICIPIO</strong><span>LA PAZ</span></div>
      <div><strong>ESTABLECIMIENTO</strong><span>HOSPITAL MUNICIPAL LA PORTADA</span></div>
    </section>
    <section class="uti-open-form">
      <div class="official-two-col">
        ${renderOfficialDottedField("APELLIDO PATERNO", patient.paternal)}
        ${renderOfficialDottedField("APELLIDO MATERNO", patient.maternal)}
      </div>
      <div class="official-row with-side-date">
        ${renderOfficialDottedField("NOMBRES", patient.names)}
        <div class="official-sex-date">
          <span>SEXO</span>
          ${renderOfficialCheck("F", data.sex === "F")}
          ${renderOfficialCheck("M", data.sex === "M")}
        </div>
      </div>
      <div class="official-row with-side-date">
        ${renderOfficialDottedField("DIRECCION", data.address)}
        ${renderOfficialDate("FECHA DE NACIMIENTO", birthDate)}
      </div>
      <div class="official-row with-side-date">
        ${renderOfficialDottedField("SERVICIO DE INGRESO", data.utiAdmissionService || data.admissionService || data.service)}
        ${renderOfficialDate("FECHA DE INGRESO", admissionDate)}
      </div>
      <div class="official-row with-side-date">
        <span></span>
        ${renderOfficialDate("FECHA DE EGRESO", dischargeDate)}
      </div>
      <section class="uti-open-diagnosis">
        ${renderOfficialDottedField("DIAGNOSTICO PRINCIPAL", `${data.diagnosis || ""}${data.cie10 ? ` (${data.cie10})` : ""}`)}
        <div class="uti-diagnosis-list">
          <strong>DIAGNOSTICOS SECUNDARIOS:</strong>
          ${[1, 2, 3].map((number) => `
            <div>
              <span>${number}.</span>
              <span class="official-fill">${safe(data[`secondaryDiagnosis${number}`])} ${data[`secondaryCode${number}`] ? `(${safe(data[`secondaryCode${number}`])})` : ""}</span>
            </div>
          `).join("")}
        </div>
      </section>
      <section class="uti-open-programs">
      <div><span>MEDICAMENTOS E INSUMOS UTILIZADOS EN LA UNIDAD DE TERAPIA INTENSIVA</span>${renderOfficialBox(data.utiPc81 === "on")} <strong>PC 81</strong></div>
      <div><span>MEDICAMENTOS E INSUMOS UTILIZADOS EN LA UNIDAD DE CUIDADOS INTENSIVOS NEONATALES</span>${renderOfficialBox(data.ucinPc82 === "on")} <strong>PC 82</strong></div>
      </section>
    </section>
  `;
}

function renderUtiPatientTypePanel(data, patientType) {
  const patientSale = ["SOAT", "RGL"].includes(patientType) ? patientType : "";

  return `
    <div class="official-patient-panel uti-patient-panel">
      <div><strong>Nº DE EXPEDIENTE CLINICO:</strong><span>${safe(data.clinicalRecord)}</span></div>
      <div><strong>SISTEMA UNICO DE SALUD:</strong><span>${patientType === "SUS" ? "S.U.S" : ""}</span></div>
      <div><strong>VENTA:</strong><span>${safe(patientSale)}</span></div>
    </div>
  `;
}

function renderBox(checked) {
  return `<span class="legal-box">${checked ? "X" : ""}</span>`;
}

function renderManualServices(data) {
  return `
    <div class="manual-section-title">OTRAS PRESTACIONES</div>
    <div class="manual-services">
      ${ambulatorioServices
        .map((service, index) => `<div>${safe(service)} ${renderBox(data[`service${index}`] === "on")}</div>`)
        .join("")}
    </div>
  `;
}

function renderManualProcedures(data) {
  return `
    <div class="manual-section-title">Procedimientos</div>
    <div class="manual-services procedures">
      ${internadoProcedures
        .map((procedure, index) => `<div>${safe(procedure)} ${renderBox(data[`procedure${index}`] === "on")}</div>`)
        .join("")}
    </div>
  `;
}

function renderManualMedicines(minRows, withIndications) {
  const rows = state.medicines.slice(0, minRows);
  while (rows.length < minRows) rows.push(null);
  return `
    <table class="legal-table medicine-manual ${withIndications ? "has-indications" : "no-indications"}">
      ${
        withIndications
          ? `<colgroup>
              <col class="medicine-col">
              <col class="indication-col">
              <col class="quantity-col">
              <col class="quantity-col">
              <col class="value-col">
              <col class="value-col">
            </colgroup>`
          : `<colgroup>
              <col class="medicine-col">
              <col class="quantity-col">
              <col class="quantity-col">
              <col class="value-col">
              <col class="value-col">
            </colgroup>`
      }
      <thead>
        <tr>
          <th rowspan="2">MEDICAMENTOS E INSUMOS<br><small>(Nombre generico, Forma Farmaceutica y Concentracion)</small></th>
          ${withIndications ? `<th rowspan="2">INDICACIONES PARA EL PACIENTE<br><small>(Cantidad, Frecuencia, Tiempo de uso y Via de administracion)</small></th>` : ""}
          <th colspan="2">CANTIDAD</th>
          <th colspan="2">VALOR</th>
        </tr>
        <tr>
          <th>Recetada</th>
          <th>Dispensada</th>
          <th>Unitario</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((medicine) => `
          <tr>
            <td>${medicine ? safe(printedLabel(medicine)) : ""}</td>
            ${withIndications ? `<td>${medicine ? safe(medicine.instruction || "") : ""}</td>` : ""}
            <td class="center">${medicine ? safe(medicine.quantity) : ""}</td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderUtiMedicines(minRows) {
  const rows = state.medicines.slice(0, minRows);
  while (rows.length < minRows) rows.push(null);

  return `
    <table class="legal-table uti-medicine-table">
      <thead>
        <tr>
          <th rowspan="2" class="uti-index"></th>
          <th rowspan="2">MEDICAMENTOS E INSUMOS<br><small>(Nombre generico Forma Farmaceutica y Concentracion)</small></th>
          <th colspan="2">CANTIDAD</th>
          <th rowspan="2">VTO.</th>
          <th colspan="2">VALOR</th>
        </tr>
        <tr>
          <th>Receta</th>
          <th>Dispensada</th>
          <th>Unitario</th>
          <th>Valor</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((medicine, index) => `
          <tr>
            <td class="center">${index + 1}</td>
            <td>${medicine ? safe(printedLabel(medicine)) : ""}</td>
            <td class="center">${medicine ? safe(medicine.quantity) : ""}</td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderUtiObservations(data) {
  return `
    <table class="legal-table uti-observations">
      <tbody>
        <tr>
          <td class="uti-observation-label"><strong>OBSERVACIONES</strong></td>
          <td>${safe(data.observations)}</td>
        </tr>
      </tbody>
    </table>
  `;
}

function renderUtiFooter(data) {
  return `
    <section class="uti-footer">
      <div class="uti-footer-sign">
        <strong>MEDICO RESPONSABLE</strong>
        <span></span>
        <em>Sello y Firma</em>
      </div>
      <div class="uti-footer-sign">
        <strong>Vº Bº FARMACIA</strong>
        <span></span>
        <em>Sello y Firma</em>
      </div>
      <div class="establishment-stamp">SELLO<br>ESTABLECIMIENTO</div>
      <div class="uti-authorization">
        <strong>AUTORIZACION<br>DIRECTOR DEL HOSPITAL</strong>
        <span>C.I.:</span>
      </div>
      <div class="uti-costs">
        <div>Costo total hoja anterior</div><span></span>
        <div>Costo total hoja actual</div><span></span>
        <div>Costo total</div><span></span>
      </div>
      <p>El prescriptor y dispensador certifican la veracidad de la informacion declarada en este documento medico legal</p>
      <p>El usuario certifica haber recibido los medicamentos senalados en este documento medico legal</p>
    </section>
  `;
}

function renderManualCostAndSignatures(data) {
  return `
    <table class="legal-table observations-manual">
      <tbody>
        <tr>
          <td rowspan="2" colspan="32" class="observations-cell">
            <strong>OBSERVACIONES</strong>
            <div>${safe(data.observations)}</div>
          </td>
          <td colspan="10"><strong>COSTO TOTAL:</strong></td>
        </tr>
        <tr>
          <td colspan="10"><strong>COSTO TOTAL AL USUARIO:</strong></td>
        </tr>
      </tbody>
    </table>
    <section class="signature-manual">
      <div class="signature-area prescriber">
        <div class="signature-line"></div>
        <strong>Recetado por:</strong>
        <span></span>
        <em>Sello y firma</em>
      </div>
      <div class="signature-area dispenser">
        <div class="signature-line"></div>
        <strong>Dispensado por:</strong>
        <span></span>
        <em>Sello y firma</em>
      </div>
      <div class="establishment-stamp-cell">
        <div class="establishment-stamp">SELLO<br>ESTABLECIMIENTO</div>
      </div>
      <div class="signature-area patient-signature">
        <div class="signature-line"></div>
        <strong>Nombre y Firma del(la) paciente/acompanante</strong>
        <div class="ci-row">
          <em>C.I.:</em>
          <div class="ci-line"></div>
        </div>
      </div>
      <p>El prescriptor y dispensador certifican la veracidad de la informacion declarada en este documento medico legal</p>
      <p>El usuario certifica haber recibido los medicamentos senalados en este documento medico legal</p>
    </section>
  `;
}


function render() {
  renderMedicineList();
  renderPreview();
  renderMedicineHint();
  scheduleDraftSave();
}

if (!restoreDraft()) render();
renderDataStatus();
checkRemoteLicense();
loadLocalData().catch((error) => {
  console.warn("No se pudieron cargar las bases de datos.", error);
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      saveDraft();
      window.location.reload();
    });

    navigator.serviceWorker
      .register("./sw.js", { updateViaCache: "none" })
      .then((registration) => registration.update())
      .catch((error) => {
        console.warn("No se pudo activar la PWA.", error);
      });
  });
}
