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
  tab.addEventListener("click", () => {
    state.template = tab.dataset.template;
    tabs.forEach((item) => item.classList.toggle("active", item === tab));
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
  });
});

document.querySelector("#printBtn").addEventListener("click", () => window.print());
pdfButton.addEventListener("click", generatePdf);
document.querySelector("#clearBtn").addEventListener("click", () => {
  form.reset();
  state.medicines = [];
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
  preview.classList.remove("pdf-preview-page");
  preview.classList.toggle("is-ambulatorio", state.template === "ambulatorio");
  preview.classList.toggle("is-internado", state.template === "internado");
  preview.classList.toggle("is-uti-ucin", state.template === "utiUcin");
  preview.classList.toggle("is-half-copies", data.printLayout === "halfCopies");
  preview.classList.toggle("is-full-page", data.printLayout !== "halfCopies");

  let recipeHtml = "";
  if (state.template === "internado") {
    recipeHtml = renderInternadoRecipe(data);
  } else if (state.template === "utiUcin") {
    recipeHtml = renderUtiUcinRecipe(data);
  } else {
    recipeHtml = renderAmbulatorioRecipe(data);
  }

  preview.innerHTML = data.printLayout === "halfCopies" ? renderHalfSheetCopies(recipeHtml) : recipeHtml;
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
  const requestDate = splitDate(data.requestDate);
  const birthDate = splitDate(data.birthDate);
  const patient = getPatientParts(data);
  const fullName = [patient.names, patient.paternal, patient.maternal].filter(Boolean).join(" ");

  return `
    <div class="legal-template legal-ambulatorio">
      <div class="legal-title">RECETARIO / RECIBO<br>ATENCION AMBULATORIA</div>
      ${renderManualHeader(data)}

      <table class="legal-table legal-compact">
        <tbody>
          <tr>
            <td colspan="5"><strong>Tipo de Atencion:</strong></td>
            <td colspan="6" class="attention-option">${renderInlineCheck("EN CONSULTORIO", data.attentionType === "EN CONSULTORIO")}</td>
            <td colspan="5" class="attention-option">${renderInlineCheck("DOMICILIARIA", data.attentionType === "DOMICILIARIA")}</td>
            <td colspan="5" class="attention-option">${renderInlineCheck("EMERGENCIAS", data.attentionType === "EMERGENCIAS")}</td>
            <td colspan="4" class="attention-option">${renderInlineCheck("REFERENCIA", data.attentionType === "REFERENCIA")}</td>
            <td colspan="7"><strong>FECHA DE NACIMIENTO:</strong></td>
            <td colspan="10">${renderDateCells(birthDate)}</td>
          </tr>
          <tr>
            <td colspan="6"><strong>Nombre del Paciente:</strong></td>
            <td colspan="19">${safe(fullName)}</td>
            <td colspan="7"><strong>FECHA DE SOLICITUD:</strong></td>
            <td colspan="10">${renderDateCells(requestDate)}</td>
          </tr>
          <tr>
            <td colspan="4"><strong>Domicilio:</strong></td>
            <td colspan="28">${safe(data.address)}</td>
            <td colspan="3"><strong>SEXO:</strong></td>
            <td colspan="2">M ${renderBox(data.sex === "M")}</td>
            <td colspan="2">F ${renderBox(data.sex === "F")}</td>
            <td colspan="3"></td>
          </tr>
        </tbody>
      </table>

      ${renderDiagnosisBlock(data)}
      ${renderManualServices(data)}
      ${renderManualMedicines(13, true)}
      ${renderManualCostAndSignatures(data)}
    </div>
  `;
}

function renderInternadoRecipe(data) {
  const requestDate = splitDate(data.requestDate);
  const birthDate = splitDate(data.birthDate);
  const admissionDate = splitDate(data.admissionDate);
  const dischargeDate = splitDate(data.dischargeDate);
  const patientParts = getPatientParts(data);

  return `
    <div class="legal-template legal-internado">
      <div class="legal-title">RECETARIO / RECIBO<br>ATENCION DEL PACIENTE INTERNADO</div>
      ${renderManualHeader(data)}

      <table class="legal-table legal-compact">
        <tbody>
          <tr>
            <td colspan="4"><strong>Apellido Paterno:</strong></td>
            <td colspan="7">${safe(patientParts.paternal)}</td>
            <td colspan="4"><strong>Apellido Materno:</strong></td>
            <td colspan="9">${safe(patientParts.maternal)}</td>
            <td colspan="3"><strong>SEXO:</strong></td>
            <td colspan="4" class="sex-compact">${renderSexCompact(data.sex)}</td>
            <td colspan="5"><strong>FECHA DE NACIMIENTO:</strong></td>
            <td colspan="6">${renderDateCells(birthDate)}</td>
          </tr>
          <tr>
            <td colspan="5"><strong>Nombres:</strong></td>
            <td colspan="26">${safe(patientParts.names)}</td>
            <td colspan="5"><strong>FECHA DE SOLICITUD:</strong></td>
            <td colspan="6">${renderDateCells(requestDate)}</td>
          </tr>
          <tr>
            <td colspan="4"><strong>Domicilio:</strong></td>
            <td colspan="38">${safe(data.address)}</td>
          </tr>
          <tr>
            <td colspan="5"><strong>INGRESO:</strong></td>
            <td colspan="5" class="internado-ingress-option">${renderInlineCheck("Por referencia", data.admissionType === "Por referencia")}</td>
            <td colspan="9" class="internado-ingress-option">${renderInlineCheck("Por servicio de emergencia", data.admissionType === "Por servicio de emergencia")}</td>
            <td colspan="7" class="internado-ingress-option">${renderInlineCheck("Por trabajo de parto", data.admissionType === "Por trabajo de parto")}</td>
            <td colspan="8" class="internado-ingress-option">${renderInlineCheck("Por consultorio externo", data.admissionType === "Por consultorio externo")}</td>
            <td colspan="8"></td>
          </tr>
          <tr>
            <td colspan="7"><strong>Servicio de ingreso:</strong></td>
            <td colspan="20">${safe(data.admissionService || data.service)}</td>
            <td colspan="4" class="date-separator"></td>
            <td colspan="5"><strong>FECHA DE INGRESO:</strong></td>
            <td colspan="6">${renderDateCells(admissionDate)}</td>
          </tr>
          <tr>
            <td colspan="7"><strong>Servicio de alta:</strong></td>
            <td colspan="20">${safe(data.dischargeService)}</td>
            <td colspan="4" class="date-separator"></td>
            <td colspan="5"><strong>FECHA DE EGRESO:</strong></td>
            <td colspan="6">${renderDateCells(dischargeDate)}</td>
          </tr>
        </tbody>
      </table>

      ${renderDiagnosisBlock(data, true)}
      ${renderManualProcedures(data)}
      ${renderManualMedicines(15, false)}
      ${renderManualCostAndSignatures(data)}
    </div>
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
  const patientType = data.utiPatientType || data.patientType;

  return `
    <div class="legal-template uti-template">
      <div class="uti-top">
        <div class="uti-address">
          Hospital Municipal La Portada<br>
          Zona La Portada/ Av. La Florida<br>
          Calle s/n Macrodistrito II
        </div>
        <div class="uti-title">
          <span>RECETARIO / RECIBO</span>
          <em>SERVICIOS Y PRODUCTOS ESPECIALES</em>
        </div>
        <div class="uti-logo-placeholder"></div>
      </div>

      <table class="legal-table uti-header-table">
        <tbody>
          <tr>
            <td colspan="5"><strong>SEDES</strong></td>
            <td colspan="8">LA PAZ</td>
            <td colspan="3"><strong>RED</strong></td>
            <td colspan="7">2 NOR OESTE</td>
            <td colspan="8" class="uti-small-label"><strong>Nº DE EXPEDIENTE CLINICO</strong></td>
            <td colspan="11">${safe(data.clinicalRecord)}</td>
          </tr>
          <tr class="uti-compact-row">
            <td colspan="8"><strong>MUNICIPIO</strong></td>
            <td colspan="15">LA PAZ</td>
            <td colspan="4" class="uti-small-label"><strong>SUS</strong></td>
            <td colspan="5" class="center">${renderBox(patientType === "SUS")}</td>
            <td colspan="5" class="uti-small-label"><strong>VENTA</strong></td>
            <td colspan="5" class="center">${renderBox(patientType === "VENTA")}</td>
          </tr>
          <tr class="uti-date-row">
            <td colspan="8"><strong>ESTABLECIMIENTO</strong></td>
            <td colspan="15">HOSPITAL MUNICIPAL LA PORTADA</td>
            <td colspan="7" class="uti-date-label"><strong>FECHA DE SOLICITUD</strong></td>
            <td colspan="12" class="uti-date-field">${renderDateCells(splitDate(data.requestDate))}</td>
          </tr>
          <tr>
            <td colspan="8"><strong>APELLIDO PATERNO</strong></td>
            <td colspan="15">${safe(patient.paternal)}</td>
            <td colspan="7"><strong>APELLIDO MATERNO</strong></td>
            <td colspan="12">${safe(patient.maternal)}</td>
          </tr>
          <tr class="uti-compact-row uti-sex-row">
            <td colspan="8"><strong>NOMBRES</strong></td>
            <td colspan="15">${safe(patient.names)}</td>
            <td colspan="5"><strong>SEXO</strong></td>
            <td colspan="3">F ${renderBox(data.sex === "F")}</td>
            <td colspan="3">M ${renderBox(data.sex === "M")}</td>
            <td colspan="8"></td>
          </tr>
          <tr class="uti-date-row">
            <td colspan="8"><strong>DIRECCION</strong></td>
            <td colspan="15">${safe(data.address)}</td>
            <td colspan="7" class="uti-date-label"><strong>FECHA DE NACIMIENTO</strong></td>
            <td colspan="12" class="uti-date-field">${renderDateCells(birthDate)}</td>
          </tr>
          <tr class="uti-date-row">
            <td colspan="8"><strong>SERVICIO DE INGRESO</strong></td>
            <td colspan="15">${safe(data.utiAdmissionService || data.admissionService || data.service)}</td>
            <td colspan="7" class="uti-date-label"><strong>FECHA DE INGRESO</strong></td>
            <td colspan="12" class="uti-date-field">${renderDateCells(admissionDate)}</td>
          </tr>
          <tr class="uti-date-row">
            <td colspan="23"></td>
            <td colspan="7" class="uti-date-label"><strong>FECHA DE EGRESO</strong></td>
            <td colspan="12" class="uti-date-field">${renderDateCells(dischargeDate)}</td>
          </tr>
        </tbody>
      </table>

      <table class="legal-table uti-diagnosis-table">
        <tbody>
          <tr>
            <td colspan="8"><strong>DIAGNOSTICO PRINCIPAL</strong></td>
            <td colspan="34">${safe(data.diagnosis)} ${data.cie10 ? `(${safe(data.cie10)})` : ""}</td>
          </tr>
          <tr>
            <td colspan="8" rowspan="3"><strong>DIAGNOSTICOS</strong></td>
            <td colspan="2">1.</td>
            <td colspan="32">${safe(data.secondaryDiagnosis1)} ${data.secondaryCode1 ? `(${safe(data.secondaryCode1)})` : ""}</td>
          </tr>
          <tr>
            <td colspan="2">2.</td>
            <td colspan="32">${safe(data.secondaryDiagnosis2)} ${data.secondaryCode2 ? `(${safe(data.secondaryCode2)})` : ""}</td>
          </tr>
          <tr>
            <td colspan="2">3.</td>
            <td colspan="32">${safe(data.secondaryDiagnosis3)} ${data.secondaryCode3 ? `(${safe(data.secondaryCode3)})` : ""}</td>
          </tr>
        </tbody>
      </table>

      <div class="uti-programs">
        <div class="uti-program-item"><span>MEDICAMENTOS E INSUMOS UTILIZADOS EN LA UNIDAD DE TERAPIA INTENSIVA</span><span class="pc-check">${renderBox(data.utiPc81 === "on")} <strong>PC 81</strong></span></div>
        <div class="uti-program-item"><span>MEDICAMENTOS E INSUMOS UTILIZADOS EN LA UNIDAD DE CUIDADOS INTENSIVOS NEONATALES</span><span class="pc-check">${renderBox(data.ucinPc82 === "on")} <strong>PC 82</strong></span></div>
      </div>

      ${renderUtiMedicines(20)}
      ${renderUtiObservations(data)}
      ${renderUtiFooter(data)}
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
loadLocalData().catch((error) => {
  console.warn("No se pudieron cargar las bases locales.", error);
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js?v=manual-20260516-54").catch((error) => {
      console.warn("No se pudo activar la PWA.", error);
    });
  });
}
