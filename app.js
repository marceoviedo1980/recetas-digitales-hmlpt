const templates = {
  ambulatorio: {
    title: "RECETARIO / RECIBO\nATENCION AMBULATORIA",
    showInternado: false,
  },
  internado: {
    title: "RECETARIO / RECIBO\nATENCION DEL PACIENTE INTERNADO",
    showInternado: true,
  },
  utiUcin: {
    title: "RECETARIO / RECIBO",
    showInternado: true,
  },
};

const SAVED_RECIPES_KEY = "recetario-la-portada-recetas-guardadas-v1";
const LICENSE_STATUS_URL = "./licencia-hmlpt-recetas.json";
const LICENSE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const LICENSE_STATUS_KEY = "recetario-la-portada-licencia-v1";
const LICENSE_LAST_CHECK_KEY = "recetario-la-portada-licencia-ultima-revision-v1";
const DEFAULT_LICENSE_MESSAGE =
  "Esta version ya no esta autorizada para uso institucional. Contacte al desarrollador para soporte o renovacion.";

let medicines = [
  {
    name: "Paracetamol",
    concentration: "500 mg",
    form: "Comprimido",
    route: "VO",
  },
  {
    name: "Ibuprofeno",
    concentration: "400 mg",
    form: "Comprimido",
    route: "VO",
  },
  {
    name: "Ceftriaxona",
    concentration: "1 g",
    form: "Vial",
    route: "IV",
  },
  {
    name: "Metformina",
    concentration: "850 mg",
    form: "Comprimido",
    route: "VO",
  },
  {
    name: "Omeprazol",
    concentration: "20 mg",
    form: "Capsula",
    route: "VO",
  },
];

let diagnoses = [];

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
};

const form = document.querySelector("#recipeForm");
const preview = document.querySelector("#recipePreview");
const medicineList = document.querySelector("#medicineList");
const medicineInput = document.querySelector("#medicineInput");
const quantityInput = document.querySelector("#quantityInput");
const instructionInput = document.querySelector("#instructionInput");
const medicineOptions = document.querySelector("#medicineOptions");
const diagnosisOptions = document.querySelector("#diagnosisOptions");
const serviceSelect = document.querySelector("#serviceSelect");
const admissionServiceSelect = document.querySelector("#admissionServiceSelect");
const dischargeServiceSelect = document.querySelector("#dischargeServiceSelect");
const utiAdmissionServiceSelect = document.querySelector("#utiAdmissionServiceSelect");
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
const closeSavedDialogButton = document.querySelector("#closeSavedDialogBtn");
const licenseBlocker = document.querySelector("#licenseBlocker");
const licenseBlockerMessage = document.querySelector("#licenseBlockerMessage");
const tabs = [...document.querySelectorAll(".template-tab")];
const ambulatorioServicesOptions = document.querySelector("#ambulatorioServicesOptions");
const internadoProcedureOptions = document.querySelector("#internadoProcedureOptions");
let installPrompt = null;

populateMedicineOptions();
populateServiceOptions();

ambulatorioServicesOptions.innerHTML = renderCheckOptions("service", ambulatorioServices);
internadoProcedureOptions.innerHTML = renderCheckOptions("procedure", internadoProcedures);

form.addEventListener("input", render);
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
document.querySelector("#clearBtn").addEventListener("click", () => {
  if (!confirm("¿Borrar todos los datos del formulario actual?\n\nEsta acción no se puede deshacer.")) return;
  form.reset();
  state.medicines = [];
  state.currentSavedId = null;
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

  writeSavedRecipes(recipes);
  saveRecipeButton.classList.add("saved-flash");
  window.setTimeout(() => saveRecipeButton.classList.remove("saved-flash"), 700);
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
  renderSavedRecipesList();
  if (typeof savedDialog.showModal === "function") savedDialog.showModal();
  else savedDialog.setAttribute("open", "");
}

function renderSavedRecipesList() {
  const recipes = readSavedRecipes();
  if (!recipes.length) {
    savedRecipesList.innerHTML = '<p class="empty saved-empty">No hay recetas guardadas todavia.</p>';
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
  activateTemplate(recipe.template);
  savedDialog.close();
}

function deleteSavedRecipe(id) {
  const recipes = readSavedRecipes().filter((recipe) => recipe.id !== id);
  if (state.currentSavedId === id) state.currentSavedId = null;
  writeSavedRecipes(recipes);
  renderSavedRecipesList();
}

function exportSavedRecipes() {
  const recipes = readSavedRecipes();
  const payload = {
    app: "Recetario Digital La Portada",
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
    alert("No se pudo generar el PDF. Verifica tu conexion a internet e intentalo nuevamente.");
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

function loadPdfLibraries() {
  if (window.html2canvas && window.jspdf?.jsPDF) return Promise.resolve();

  return Promise.all([
    loadScript("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"),
    loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"),
  ]);
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

document.querySelector("#addMedicineBtn").addEventListener("click", () => {
  const rawMedicine = medicineInput.value.trim();
  const selected = findMedicine(rawMedicine);
  const quantity = Number(quantityInput.value || 1);
  const instruction = instructionInput.value.trim();

  if (!rawMedicine) {
    medicineInput.focus();
    return;
  }

  state.medicines.push({
    ...(selected || freeTextMedicine(rawMedicine)),
    quantity,
    instruction,
  });

  medicineInput.value = "";
  quantityInput.value = "1";
  instructionInput.value = "";
  render();
});

form.elements.diagnosis.addEventListener("change", () => fillDiagnosisCode(form.elements.diagnosis, form.elements.cie10));

Array.from({ length: 5 }, (_, index) => index + 1).forEach((number) => {
  const diagnosisInput = form.elements[`secondaryDiagnosis${number}`];
  const codeInput = form.elements[`secondaryCode${number}`];
  diagnosisInput.addEventListener("change", () => fillDiagnosisCode(diagnosisInput, codeInput));
});

function findMedicine(value) {
  const normalizedValue = normalize(value);
  return medicines.find((medicine) => normalize(medicineLabel(medicine)) === normalizedValue);
}

function medicineLabel(medicine) {
  return [medicine.name, medicine.concentration, medicine.form].filter(Boolean).join(" ");
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

function normalize(value) {
  return value.trim().toLowerCase();
}

async function loadLocalData() {
  const [medicineResult, diagnosisResult] = await Promise.allSettled([
    fetch("./data/medicamentos.json").then((response) => response.json()),
    fetch("./data/cartera_servicios.json").then((response) => response.json()),
  ]);

  if (medicineResult.status === "fulfilled" && Array.isArray(medicineResult.value)) {
    medicines = medicineResult.value.map((item) => ({
      code: item.codigo || "",
      name: item.medicamento || "",
      concentration: item.concentracion || "",
      form: item.forma || "",
      observation: item.observacion || "",
      route: "",
    }));
    populateMedicineOptions();
  }

  if (diagnosisResult.status === "fulfilled" && Array.isArray(diagnosisResult.value)) {
    diagnoses = diagnosisResult.value.map((item) => ({
      code: item.CODIGO || "",
      name: item.SERVICIO || "",
      patientType: item["TIPO DE PACIENTE"] || "",
    }));
    populateDiagnosisOptions();
  }

  render();
}

function populateMedicineOptions() {
  medicineOptions.innerHTML = medicines
    .map((medicine) => `<option value="${safe(medicineLabel(medicine))}"></option>`)
    .join("");
}

function populateDiagnosisOptions() {
  diagnosisOptions.innerHTML = diagnoses
    .map((diagnosis) => `<option value="${safe(diagnosis.name)}" label="${safe(diagnosis.code)}"></option>`)
    .join("");
}

function populateServiceOptions() {
  const options = `<option value=""></option>${clinicalServices
    .map((service) => `<option value="${safe(service)}">${safe(service)}</option>`)
    .join("")}`;
  serviceSelect.innerHTML = options;
  admissionServiceSelect.innerHTML = options;
  dischargeServiceSelect.innerHTML = options;
  utiAdmissionServiceSelect.innerHTML = options;
}

function findDiagnosis(value) {
  const normalizedValue = normalize(value);
  return diagnoses.find((diagnosis) => normalize(diagnosis.name) === normalizedValue);
}

function fillDiagnosisCode(diagnosisInput, codeInput) {
  const selected = findDiagnosis(diagnosisInput.value);
  if (!selected) return;
  codeInput.value = selected.code;
  render();
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

function renderMedicineList() {
  if (!state.medicines.length) {
    medicineList.innerHTML = '<p class="empty">Sin medicamentos agregados.</p>';
    return;
  }

  medicineList.innerHTML = state.medicines
    .map(
      (medicine, index) => `
        <div class="medicine-row">
          <div>
            <strong>${medicineLabel(medicine)}</strong>
            <small>${medicineMeta(medicine)}</small>
          </div>
          <span>Cant. ${medicine.quantity}</span>
          <button class="remove-button" type="button" data-index="${index}">Quitar</button>
        </div>
      `,
    )
    .join("");

  medicineList.querySelectorAll(".remove-button").forEach((button) => {
    button.addEventListener("click", () => {
      state.medicines.splice(Number(button.dataset.index), 1);
      render();
    });
  });
}

function medicineMeta(medicine) {
  return [medicine.route, medicine.instruction || "Sin indicacion"].filter(Boolean).join(" · ");
}

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

function renderManualHeader(data) {
  const patientProgram = ["VIH", "TUBERCULOSIS"].includes(data.patientType) ? data.patientType : "";
  const patientSale = ["SOAT", "RGL"].includes(data.patientType) ? data.patientType : "";

  return `
    <section class="manual-meta-header" aria-label="Datos institucionales">
      <div class="manual-meta-left">
        <div><strong>SEDES:</strong> LA PAZ</div>
        <div><strong>RED:</strong> 2 NORTE CENTRAL</div>
        <div><strong>Municipio:</strong> LA PAZ</div>
        <div><strong>Establecimiento:</strong> HOSPITAL MUNICIPAL LA PORTADA</div>
      </div>
      <div class="manual-meta-right">
        <div class="manual-meta-row">
          <strong>Nº DE EXPEDIENTE CLINICO:</strong>
          <span class="manual-meta-record">${safe(data.clinicalRecord)}</span>
        </div>
        <div class="manual-meta-row">
          <strong>SISTEMA UNICO DE SALUD:</strong>
          <span class="manual-meta-value">${data.patientType === "SUS" ? "S.U.S" : ""}</span>
        </div>
        <div class="manual-meta-row">
          <strong>PROGRAMA:</strong>
          <span class="manual-meta-value">${safe(patientProgram)}</span>
        </div>
        <div class="manual-meta-row">
          <strong>VENTA:</strong>
          <span class="manual-meta-value">${safe(patientSale)}</span>
        </div>
      </div>
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

function renderInlineCheck(label, checked) {
  return `<span class="inline-check">${safe(label)} ${renderBox(checked)}</span>`;
}

function renderSexCompact(value) {
  return `<span class="sex-inline">M ${renderBox(value === "M")} F ${renderBox(value === "F")}</span>`;
}

function renderDateCells(date) {
  return `
    <span class="date-trio">
      <span><b>DIA</b>${safe(date.day)}</span>
      <span><b>MES</b>${safe(date.month)}</span>
      <span><b>ANO</b>${safe(date.year)}</span>
    </span>
  `;
}

function renderDiagnosisBlock(data, internado = false) {
  const secondaryRows = Array.from({ length: 5 }, (_, index) => {
    const number = index + 1;
    return {
      number,
      diagnosis: data[`secondaryDiagnosis${number}`] || "",
      code: data[`secondaryCode${number}`] || "",
    };
  });

  return `
    <table class="legal-table diagnosis-manual">
      <tbody>
        ${internado ? `
          <tr>
            <td colspan="7"><strong>Diagnosticos:</strong></td>
            <td colspan="30"></td>
            <td colspan="5"></td>
          </tr>
        ` : ""}
        <tr>
          <td colspan="7"><strong>Diagnostico Principal:</strong></td>
          <td colspan="30">${safe(data.diagnosis)}</td>
          <td colspan="5" class="center"><strong>${safe(data.cie10)}</strong></td>
        </tr>
        ${secondaryRows.map((row, index) => `
          <tr>
            ${index === 0 ? '<td colspan="7" rowspan="5"><strong>Diagnosticos secundarios:</strong></td>' : ""}
            <td colspan="2">${row.number}.-</td>
            <td colspan="28">${safe(row.diagnosis)}</td>
            <td colspan="5">${safe(row.code)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
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
  const rows = [...state.medicines];
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
            <td>${medicine ? safe(medicineLabel(medicine)) : ""}</td>
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
  const rows = [...state.medicines];
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
            <td>${medicine ? safe(medicineLabel(medicine)) : ""}</td>
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

function renderTitle(title) {
  return `
    <section class="excel-title">
      ${title.replace("\n", "<br>")}
    </section>
  `;
}

function renderInstitutionBlock(data, internado) {
  return `
    <section class="excel-grid institution-block">
      ${internado ? '<div class="cell blank span-34"></div>' : ""}
      <div class="cell label span-8">N de EXPEDIENTE CLINICO</div>
      ${internado ? "" : `<div class="cell fill span-5">${safe(data.clinicalRecord)}</div>`}
      <div class="cell label span-9">SEDES: LA PAZ</div>
      <div class="cell label span-23">RED: 2 NORTE CENTRAL</div>
      ${internado ? '<div class="cell label span-8">SEGURO UNICO DE SALUD</div>' : ""}
      <div class="cell label span-9">Municipio: LA PAZ</div>
      <div class="cell label span-23">Establecimiento: HOSPITAL MUNICIPAL LA PORTADA</div>
      <div class="cell label span-8">PROGRAMAS:</div>
    </section>
  `;
}

function renderDateBoxes(date) {
  return `
    <div class="cell center date-box span-3"><small>DIA</small>${safe(date.day)}</div>
    <div class="cell center date-box span-3"><small>MES</small>${safe(date.month)}</div>
    <div class="cell center date-box span-4"><small>ANO</small>${safe(date.year)}</div>
  `;
}

function renderOption(label, selected) {
  return `
    <div class="cell label option-label span-4">${label}</div>
    <div class="cell center option-box span-1">${selected === label ? "X" : ""}</div>
  `;
}

function renderCheckText(label, checked, span) {
  return `<div class="cell label span-${span}">${checked ? "X " : ""}${label}</div>`;
}

function renderSecondaryDiagnoses() {
  const rows = [
    ["1.-", "Dolor Agudo", "R52.0"],
    ["2.-", "Gonartrosis no especificada", "M17.9"],
    ["3.-", "Gastritis y duodenitis", "K29"],
    ["4.-", "", ""],
    ["5.-", "", ""],
  ];

  return rows
    .map(
      ([number, text, code]) => `
        <div class="cell center span-2">${number}</div>
        <div class="cell fill span-30">${safe(text)}</div>
        <div class="cell fill span-5">${safe(code)}</div>
      `,
    )
    .join("");
}

function renderOtherServices() {
  const services = [
    ["Consulta integral en servicio de Urgencias/Emergencia T17576036", ""],
    ["Consulta odontologica general T17577005", ""],
    ["Inyectables en consulta externa T17638014", ""],
    ["Toma de papanicolau", ""],
    ["Consulta integral de otras especialidades medicas T17576027", "x"],
    ["Consulta integral de psicologia T17577003", ""],
    ["Nebulizacion en consultorio externo T17638016", ""],
    ["Electrocardiograma", ""],
    ["Retiro de puntos en consultorio externo T17638019", ""],
    ["Curacion en consultorio externo T17638009", ""],
    ["Sutura en consultorio externo T17638020", ""],
    ["Paro cardiaco", ""],
    ["Cateterismo venoso periferico en urgencias T02663001", ""],
    ["Lavado gastrico de intoxicaciones T02662006", ""],
    ["Sutura en urgencias T02663006", ""],
    ["Vacunacion con BCG", ""],
    ["Cateterismo venoso periferico en consultorio externo T17638003", ""],
    ["Control de salud de rutina del nino Z00.1", ""],
  ];

  return `
    <section class="excel-section-title">OTRAS PRESTACIONES</section>
    <section class="services-grid">
      ${services.map(([text, mark]) => `<div>${mark ? `<strong>${mark}</strong> ` : ""}${text}</div>`).join("")}
    </section>
  `;
}

function renderProcedures() {
  const procedures = [
    "Anestesia General Balanceada T08639001",
    "Cateterismo Venoso periferico en paciente internado T19655007",
    "Nebulizacion en paciente internado T19655028",
    "Anestesia General Neuroaxial T08639006",
    "Lavado gastrico en paciente internado T19655024",
    "Cateterismo Vesical en paciente internado T19655008",
  ];

  return `
    <section class="excel-section-title">Procedimientos</section>
    <section class="services-grid procedures-grid">
      ${procedures.map((text) => `<div>${text}</div>`).join("")}
    </section>
  `;
}

function renderMedicineTable(minRows, withIndications) {
  const rows = [...state.medicines];
  while (rows.length < minRows) rows.push(null);

  return `
    <section class="rx-table ${withIndications ? "with-indications" : "internado-rx"}">
      <div class="rx-head rx-medicine">MEDICAMENTOS E INSUMOS<br><small>(Nombre generico, Forma Farmaceutica y Concentracion)</small></div>
      ${withIndications ? '<div class="rx-head rx-indications">INDICACIONES PARA EL PACIENTE<br><small>(Cantidad, Frecuencia, Tiempo de uso y Via de administracion)</small></div>' : ""}
      <div class="rx-head rx-qty" colspan="2">CANTIDAD<br><small>Recetada / Dispensada</small></div>
      <div class="rx-head rx-value">VALOR<br><small>Unitario / Total</small></div>
      ${rows.map((medicine) => renderMedicineRow(medicine, withIndications)).join("")}
    </section>
  `;
}

function renderMedicineRow(medicine, withIndications) {
  const med = medicine ? medicineLabel(medicine) : "&nbsp;";
  const instruction = medicine ? medicine.instruction || "" : "";
  const quantity = medicine ? medicine.quantity : "";

  return `
    <div class="rx-cell rx-medicine">${med}</div>
    ${withIndications ? `<div class="rx-cell rx-indications">${safe(instruction)}</div>` : ""}
    <div class="rx-cell rx-qty">${safe(quantity)}</div>
    <div class="rx-cell rx-qty">&nbsp;</div>
    <div class="rx-cell rx-value">&nbsp;</div>
    <div class="rx-cell rx-value">&nbsp;</div>
  `;
}

function renderCostAndObservations() {
  return `
    <section class="cost-block">
      <div class="observations">OBSERVACIONES</div>
      <div class="cost-lines">
        <div>COSTO TOTAL</div>
        <div>COSTO TOTAL AL USUARIO</div>
      </div>
    </section>
  `;
}

function renderSignatureBlock(data) {
  return `
    <section class="signature-official">
      <div><strong>Recetado por:</strong><span class="signature-space"></span>Sello y firma<br>${safe(data.doctor)} ${safe(data.license)}</div>
      <div><strong>Dispensado por:</strong><span class="signature-space"></span>Sello y firma</div>
      <div><strong>Nombre y Firma del(la) paciente/acompanante</strong><span class="signature-space"></span>C.I.</div>
      <p>El prescriptor y dispensador certifican la veracidad de la informacion declarada en este documento medico legal</p>
      <p>El usuario certifica haber recibido los medicamentos senalados en este documento medico legal</p>
    </section>
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
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function render() {
  renderMedicineList();
  renderPreview();
}

render();
checkRemoteLicense();
loadLocalData().catch((error) => {
  console.warn("No se pudieron cargar las bases locales.", error);
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js?v=manual-20260528-88").catch((error) => {
      console.warn("No se pudo activar la PWA.", error);
    });
  });
}


















