/* =========================================================
   Equilibria – script.js
   Sections: config, nav, parallax/tilt, stepper, validation,
   payload + API, result display, reset
   ========================================================= */
(() => {
  "use strict";

  /* ---------- Config ---------- */
  const API_URL = "https://mental-health-score-predictor-zarb.onrender.com";
  const RING_LENGTH = 2 * Math.PI * 60; // matches r=60 in the SVG

  /**
   * Field rules. `type` controls conversion for the JSON payload so the
   * backend receives int / float / string exactly as its Pydantic model expects.
   */
  const RULES = {
    age:                     { label: "Age", type: "int", min: 10, max: 100 },
    gender:                  { label: "Gender", type: "text" },
    country:                 { label: "Country", type: "text" },
    academic_level:          { label: "Academic level", type: "text" },
    most_used_platform:      { label: "Most used platform", type: "text" },
    purpose_of_use:          { label: "Purpose of use", type: "text" },
    avg_daily_usage_hours:   { label: "Daily usage", type: "float", min: 0, max: 24 },
    daily_unlocks:           { label: "Daily unlocks", type: "int", min: 0 },
    study_hours:             { label: "Study hours", type: "float", min: 0, max: 24 },
    physical_activity_hours: { label: "Physical activity hours", type: "float", min: 0, max: 24 },
    sleep_hours_per_night:   { label: "Sleep hours", type: "float", min: 0, max: 24 },
    stress_level:            { label: "Stress level", type: "text" },
  };

  /* ---------- Element refs ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const form = $("#assessmentForm");
  const steps = $$("fieldset.step");
  const stepButtons = $$(".progress__step");
  const prevBtn = $("#prevBtn");
  const nextBtn = $("#nextBtn");
  const submitBtn = $("#submitBtn");
  const progressFill = $("#progressFill");
  const formError = $("#formError");
  const resultSection = $("#result");
  const assessmentSection = $("#assessment");
  let currentStep = 0;

  /* ---------- Navigation ---------- */
  const navToggle = $("#navToggle");
  const navLinks = $("#navLinks");
  navToggle.addEventListener("click", () => {
    const open = navLinks.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(open));
  });
  navLinks.addEventListener("click", (e) => {
    if (e.target.tagName === "A") {
      navLinks.classList.remove("is-open");
      navToggle.setAttribute("aria-expanded", "false");
    }
  });
  $("#year").textContent = new Date().getFullYear();

  /* ---------- Parallax (hero) and card tilt ---------- */
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const scene = $("#scene");

  if (!reduceMotion) {
    // Hero scene reacts subtly to the pointer
    window.addEventListener("pointermove", (e) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;
      scene.firstElementChild.style.setProperty("--rx", `${x * 8}deg`);
      scene.firstElementChild.style.setProperty("--ry", `${y * -5}deg`);
    });

    // Gentle 3D tilt on large cards (fine pointers only)
    if (window.matchMedia("(hover: hover)").matches) {
      $$(".tilt").forEach((card) => {
        card.addEventListener("pointermove", (e) => {
          const r = card.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width - 0.5;
          const py = (e.clientY - r.top) / r.height - 0.5;
          card.style.transform = `perspective(1200px) rotateY(${px * 3}deg) rotateX(${py * -3}deg)`;
        });
        card.addEventListener("pointerleave", () => { card.style.transform = ""; });
      });
    }
  }

  /* ---------- Stepper ---------- */
  function showStep(index) {
    currentStep = index;
    steps.forEach((s, i) => s.classList.toggle("is-active", i === index));
    stepButtons.forEach((b, i) => {
      b.classList.toggle("is-active", i === index);
      b.classList.toggle("is-done", i < index);
    });
    progressFill.style.width = `${((index + 1) / steps.length) * 100}%`;
    const last = index === steps.length - 1;
    prevBtn.hidden = index === 0;
    nextBtn.hidden = last;
    submitBtn.hidden = !last;
    hideFormError();
  }

  nextBtn.addEventListener("click", () => {
    if (validateStep(currentStep)) showStep(currentStep + 1);
  });
  prevBtn.addEventListener("click", () => showStep(currentStep - 1));
  // Progress dots: allow going back freely, forward only if earlier steps are valid
  stepButtons.forEach((btn) => btn.addEventListener("click", () => {
    const target = Number(btn.dataset.step);
    for (let i = 0; i < target; i++) {
      if (!validateStep(i)) { showStep(i); return; }
    }
    showStep(target);
  }));

  /* ---------- Validation ---------- */
  function setError(input, message) {
    const field = input.closest(".field");
    field.classList.toggle("has-error", Boolean(message));
    $(".error", field).textContent = message || "";
    input.setAttribute("aria-invalid", message ? "true" : "false");
  }

  /** Returns an error message string, or "" if the value is valid. */
  function checkField(name) {
    const rule = RULES[name];
    const input = form.elements[name];
    const value = input.value.trim();

    if (value === "") return `${rule.label} is required.`;
    if (rule.type === "text") return "";

    const num = Number(value);
    if (!Number.isFinite(num)) return `${rule.label} must be a number.`;
    if (rule.type === "int" && !Number.isInteger(num)) return `${rule.label} must be a whole number.`;
    if (rule.min !== undefined && num < rule.min) return `${rule.label} must be at least ${rule.min}.`;
    if (rule.max !== undefined && num > rule.max) return `${rule.label} must be ${rule.max} or less.`;
    return "";
  }

  function validateStep(index) {
    let ok = true;
    let firstBad = null;
    $$("[name]", steps[index]).forEach((input) => {
      const msg = checkField(input.name);
      setError(input, msg);
      if (msg) { ok = false; firstBad = firstBad || input; }
    });
    if (firstBad) firstBad.focus();
    return ok;
  }

  // Live feedback: clear/update the error once a field has been touched
  form.addEventListener("input", (e) => {
    if (e.target.name && e.target.closest(".has-error")) setError(e.target, checkField(e.target.name));
  });
  form.addEventListener("change", (e) => {
    if (e.target.name) setError(e.target, checkField(e.target.name));
  });

  function showFormError(msg) { formError.textContent = msg; formError.hidden = false; }
  function hideFormError() { formError.hidden = true; formError.textContent = ""; }

  /* ---------- Payload ---------- */
  /** Builds the JSON body with the exact field names and types the API expects. */
  function buildPayload() {
    const payload = {};
    for (const [name, rule] of Object.entries(RULES)) {
      const raw = form.elements[name].value.trim();
      payload[name] = rule.type === "text" ? raw : Number(raw);
    }
    return payload;
  }

  /* ---------- API ---------- */
  /** Turns FastAPI's 422 detail array into a readable message. */
  function describeApiError(status, body) {
    if (status === 422 && Array.isArray(body?.detail)) {
      return "The server rejected some values: " +
        body.detail.map((d) => `${(d.loc || []).slice(1).join(".")} (${d.msg})`).join("; ");
    }
    if (typeof body?.detail === "string") return `Server error ${status}: ${body.detail}`;
    return `The server responded with an error (HTTP ${status}).`;
  }

  async function requestPrediction(formData) {
    let response;
    try {
      response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
    } catch (err) {
      // fetch only rejects on network-level failures
      throw new Error("Could not reach the prediction server at http://127.0.0.1:8000/. Make sure the FastAPI backend is running, then try again.");
    }

    let body = null;
    try { body = await response.json(); } catch (_) { /* non-JSON response */ }

    if (!response.ok) throw new Error(describeApiError(response.status, body));

    const score = body?.predicted_mental_health_score;
    if (typeof score !== "number" || !Number.isFinite(score)) {
      throw new Error("The server returned an unexpected response (no prediction value).");
    }
    return score;
  }

  function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    submitBtn.classList.toggle("is-loading", isLoading);
    $(".btn__label", submitBtn).textContent = isLoading ? "Predicting…" : "Get prediction";
    prevBtn.disabled = isLoading;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideFormError();

    // Validate every step; jump to the first one with a problem
    for (let i = 0; i < steps.length; i++) {
      if (!validateStep(i)) { showStep(i); validateStep(i); return; }
    }

    setLoading(true);
    try {
      const score = await requestPrediction(buildPayload());
      showResult(score);
    } catch (err) {
      showFormError(err.message);
    } finally {
      setLoading(false);
    }
  });

  /* ---------- Result ---------- */
  function showResult(score) {
    resultSection.hidden = false;
    // Re-trigger the entrance animation on repeated predictions
    const card = $("#resultCard");
    card.style.animation = "none"; void card.offsetWidth; card.style.animation = "";

    resultSection.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
    animateScore(score);
  }

  /** Counts the number up and draws the ring. The ring is decorative: it is not a scale. */
  function animateScore(score) {
    const valueEl = $("#scoreValue");
    const ring = $("#ringValue");
    const final = score.toFixed(2);
    const duration = reduceMotion ? 0 : 1400;

    ring.style.transition = "none";
    ring.style.strokeDasharray = RING_LENGTH;
    ring.style.strokeDashoffset = RING_LENGTH;
    void ring.getBoundingClientRect();
    ring.style.transition = `stroke-dashoffset ${duration}ms cubic-bezier(.2,.7,.2,1)`;
    ring.style.strokeDashoffset = 0;

    if (!duration) { valueEl.textContent = final; return; }
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      valueEl.textContent = t < 1 ? (score * eased).toFixed(2) : final;
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* ---------- Reset ---------- */
  $("#retryBtn").addEventListener("click", () => {
    form.reset();
    $$(".field").forEach((f) => { f.classList.remove("has-error"); $(".error", f).textContent = ""; });
    resultSection.hidden = true;
    showStep(0);
    assessmentSection.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
  });

  showStep(0);
})();
