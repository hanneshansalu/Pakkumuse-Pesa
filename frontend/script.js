const USE_MOCK = true;

const N8N_WEBHOOK_URL =
  "http://n8n-en9rqo8xc6ls30fjiwyw95mn.104.248.201.72.sslip.io/webhook/pakkumuse-pesa";

const BASE_HOURS = 964;
const BUDGET = 160000;
const AI_HOURS = 1186;

const hoursInputs = [...document.querySelectorAll(".hours-input")];
const hourlyRate = document.querySelector("#hourlyRate");

function numberValue(input) {
  return Math.max(0, Number(String(input?.value ?? "").replace(",", ".")) || 0);
}

function formatNumber(value) {
  return new Intl.NumberFormat("et-EE", { maximumFractionDigits: 0 }).format(value);
}

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function listFromText(value) {
  if (typeof value !== "string" || !value.trim()) return [];
  return value
    .split(/\n|;/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function renderList(selector, values) {
  const element = document.querySelector(selector);
  if (!element) return;
  element.innerHTML = values.map((value) => `<li>${escapeHtml(value)}</li>`).join("");
}

function updateTotals() {
  const totalHours = BASE_HOURS + hoursInputs.reduce((sum, input) => sum + numberValue(input), 0);
  const rate = numberValue(hourlyRate);
  const price = totalHours * rate;
  const budgetUse = Math.round((price / BUDGET) * 100);
  const delta = ((totalHours - AI_HOURS) / AI_HOURS) * 100;

  setText("#totalHours", formatNumber(totalHours));
  setText("#totalPrice", `${formatNumber(price)} €`);
  setText("#budgetAmount", `€${formatNumber(price)}`);
  setText("#approvalPrice", `€${formatNumber(price)}`);
  setText("#budgetUse", `${budgetUse}%`);
  setText("#hoursDelta", `${delta >= 0 ? "+" : ""}${delta.toFixed(1).replace(".", ",")}%`);

  const budgetBar = document.querySelector("#budgetBar");
  if (budgetBar) budgetBar.style.width = `${Math.min(budgetUse, 100)}%`;
}

function setupStaticInteractions() {
  document.querySelectorAll("[data-step]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = button.parentElement?.querySelector("input");
      if (!input) return;
      input.value = Math.max(0, numberValue(input) + Number(button.dataset.step));
      updateTotals();
    });
  });

  [...hoursInputs, hourlyRate]
    .filter(Boolean)
    .forEach((input) => input.addEventListener("input", updateTotals));

  updateTotals();
}

async function loadAnalysisData() {
  if (USE_MOCK) {
    if (!window.PAKKUMUSE_PESA_MOCK_DATA) {
      throw new Error("Mock data was not loaded from mock-data.js");
    }
    return window.PAKKUMUSE_PESA_MOCK_DATA;
  }

  const response = await fetch(N8N_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    throw new Error(`n8n webhook returned HTTP ${response.status}`);
  }

  return response.json();
}

function normalizeAnalysisData(data) {
  return {
    tender: data?.tender && typeof data.tender === "object" ? data.tender : {},
    requirements: asArray(data?.requirements),
    proposalSkeleton: asArray(data?.proposalSkeleton),
    methodologies: asArray(data?.methodologies),
    teamRoles: asArray(data?.teamRoles),
    risks: asArray(data?.risks),
  };
}

function bindTender(tender) {
  const title = typeof tender.title === "string" && tender.title.trim()
    ? tender.title.trim()
    : "Hanke pealkiri puudub";
  const deadline = typeof tender.deadline === "string" && tender.deadline.trim()
    ? tender.deadline.trim()
    : "Tähtaeg puudub";

  setText("#tenderTitle", title);
  setText("#breadcrumbTenderTitle", title);
  setText("#tenderDeadline", deadline);
  setText("#tenderDeadlineShort", deadline === "Tähtaeg puudub" ? deadline : `Esitamine ${deadline}`);
}

function bindProposalSkeleton(proposalSkeleton) {
  const chapters = [...document.querySelectorAll("#proposalSkeletonList .chapter")];

  chapters.forEach((chapter, index) => {
    const section = proposalSkeleton[index];
    chapter.hidden = !section;
    if (!section) return;

    const title = chapter.querySelector(":scope > strong");
    const requirements = chapter.querySelector(".req-links");
    if (title) title.textContent = section.title ?? "";
    if (requirements) requirements.textContent = asArray(section.requirementIds).join(" · ");
  });

  const total = proposalSkeleton.length;
  const reviewed = Math.min(4, total);
  setText("#proposalSkeletonCount", total);
  setText("#skeletonProgressText", `${reviewed} / ${total}`);

  const progressBar = document.querySelector("#skeletonProgressBar");
  if (progressBar) progressBar.style.width = `${total ? Math.round((reviewed / total) * 100) : 0}%`;
}

function bindMethodologies(methodologies) {
  setText("#methodologiesCount", methodologies.length);
  setText("#methodologiesTotal", methodologies.length);

  const methodCards = [...document.querySelectorAll(".method-card")];
  methodCards.forEach((card, index) => {
    card.hidden = !methodologies[index];
  });

  methodologies.slice(0, 3).forEach((methodology, index) => {
    setText(`#methodologyName${index}`, methodology.name ?? "");
    setText(
      `#methodologyRequirements${index}`,
      index === 0
        ? `Katab ${asArray(methodology.requirementIds).join(" · ")}`
        : asArray(methodology.requirementIds).join(" · "),
    );
  });

  const primary = methodologies[0];
  if (!primary) return;

  setText("#methodologyDescription0", primary.description ?? "");
  const continuation = document.querySelector("#methodologyDescriptionContinuation0");
  if (continuation) continuation.hidden = true;
  renderList("#methodologyClientInput0", listFromText(primary.clientInput));
  renderList("#methodologyDeliverables0", asArray(primary.deliverables));
}

function bindRisks(risks) {
  setText("#risksCount", risks.length);

  const riskItems = document.querySelector("#riskItems");
  if (riskItems) {
    riskItems.innerHTML = risks.map((risk, index) => {
      const level = ["high", "medium", "low"][index] || "low";
      const icon = level === "low" ? "i" : "!";
      const mitigation = risk.mitigation
        ? `<span class="mitigation"><b>Maandamine:</b> ${escapeHtml(risk.mitigation)}</span>`
        : "";
      const sources = asArray(risk.sources);
      const sourceLink = sources.length
        ? `<a href="#requirements">${escapeHtml(sources.join(" · "))} →</a>`
        : "";

      return `<div class="risk-item ${level}"><i>${icon}</i><div><strong>${escapeHtml(risk.title)}</strong><p>${escapeHtml(risk.reason)}</p>${mitigation}${sourceLink}</div></div>`;
    }).join("");
  }

  setText("#aiObservation", risks[0]?.reason || "AI ei tuvastanud eraldi tähelepanekuid.");
}

function bindAnalysisData(rawData) {
  const data = normalizeAnalysisData(rawData);

  bindTender(data.tender);
  setText("#requirementsCount", data.requirements.length);
  setText("#requirementsSummary", `${data.requirements.length} nõuet tuvastatud`);
  setText("#teamRolesCount", data.teamRoles.length);
  bindProposalSkeleton(data.proposalSkeleton);
  bindMethodologies(data.methodologies);
  bindRisks(data.risks);
}

async function initialize() {
  setupStaticInteractions();

  try {
    const data = await loadAnalysisData();
    bindAnalysisData(data);
  } catch (error) {
    console.error("Pakkumuse Pesa analysis data could not be loaded:", error);
  }
}

initialize();
