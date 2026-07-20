const reservationForm = document.getElementById("reservation-form");
const reservationFeedback = document.getElementById("reservation-feedback");
const reservationModal = document.getElementById("reservation-modal");
const closeModalButton = document.getElementById("close-modal");
const MAIL_CONFIG = window.MAIL_CONFIG || {};

let reservationSubmitting = false;

function createSubmissionId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `submission_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function getFormData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function formatPlanLabel(plan) {
  if (plan === "double") {
    return "Printing & postage";
  }

  if (plan === "custom") {
    return "Not sure / custom project";
  }

  return "Direct mail campaign";
}

function buildInquiryMessage(payload) {
  return [
    `Business name: ${payload.companyName}`,
    `Contact name: ${payload.contactName}`,
    `Email: ${payload.email}`,
    `Phone: ${payload.phone}`,
    `Service: ${formatPlanLabel(payload.plan)}`,
    `Notes: ${payload.notes || "None"}`,
  ].join("\n");
}

async function sendInquiryEmail(payload) {
  const message = buildInquiryMessage(payload);
  const subject = "[Last Stop Mail] New Inquiry";
  const notifyEmail = MAIL_CONFIG.notifyEmail || "arendainzhuji@yahoo.com";
  const web3formsKey = (MAIL_CONFIG.web3formsAccessKey || "").trim();

  if (web3formsKey) {
    try {
      const response = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          access_key: web3formsKey,
          subject,
          from_name: "Last Stop Mail Website",
          name: payload.contactName,
          email: payload.email,
          replyto: payload.email,
          phone: payload.phone,
          message,
          business_name: payload.companyName,
          service: formatPlanLabel(payload.plan),
          notes: payload.notes || "",
          botcheck: false,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        return { sent: true, method: "web3forms" };
      }
    } catch (error) {
      console.warn("Web3Forms client delivery failed:", error);
    }
  }

  try {
    const response = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(notifyEmail)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        _subject: subject,
        _template: "table",
        _captcha: "false",
        name: payload.contactName,
        email: payload.email,
        phone: payload.phone,
        business_name: payload.companyName,
        service: formatPlanLabel(payload.plan),
        message,
      }),
    });

    const result = await response.json();

    if (response.ok && (result.success === "true" || result.success === true)) {
      return { sent: true, method: "formsubmit" };
    }
  } catch (error) {
    console.warn("FormSubmit client delivery failed:", error);
  }

  return { sent: false, method: null };
}

function setFeedback(element, message, isError = false) {
  if (!element) {
    return;
  }

  element.textContent = message;
  element.classList.remove("hidden");
  element.classList.toggle("toast-error", isError);
  element.classList.toggle("toast-success", !isError);
}

function openModal(modal) {
  if (!modal) {
    return;
  }

  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      modal.classList.add("is-visible");
    });
  });
}

function closeModal(modal) {
  if (!modal || modal.classList.contains("hidden")) {
    return;
  }

  modal.classList.remove("is-visible");
  modal.setAttribute("aria-hidden", "true");

  let finished = false;
  const finishClose = () => {
    if (finished) {
      return;
    }

    finished = true;
    modal.classList.add("hidden");

    if (!reservationModal || reservationModal.classList.contains("hidden")) {
      document.body.style.overflow = "";
    }
  };

  modal.addEventListener(
    "transitionend",
    (event) => {
      if (event.target === modal) {
        finishClose();
      }
    },
    { once: true }
  );

  window.setTimeout(finishClose, 450);
}

function openReservationModal(plan = "standard") {
  openModal(reservationModal);
  reservationFeedback?.classList.add("hidden");

  const planField = document.getElementById("reserve-plan");
  if (planField) {
    planField.value = plan;
  }

  window.setTimeout(() => {
    document.getElementById("reserve-company")?.focus();
  }, 320);
}

function closeReservationModal() {
  closeModal(reservationModal);
}

document.querySelectorAll("[data-open-reserve]").forEach((button) => {
  button.addEventListener("click", () => {
    openReservationModal(button.dataset.openReserve || "standard");
  });
});

closeModalButton?.addEventListener("click", closeReservationModal);

reservationModal?.addEventListener("click", (event) => {
  if (event.target === reservationModal || event.target.closest("[data-close-modal]")) {
    closeReservationModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") {
    return;
  }

  if (reservationModal && !reservationModal.classList.contains("hidden")) {
    closeReservationModal();
  }
});

reservationForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (reservationSubmitting) {
    return;
  }

  reservationSubmitting = true;
  setFeedback(reservationFeedback, "Sending your request...");

  const submitButton = reservationForm.querySelector('button[type="submit"]');
  const originalLabel = submitButton?.textContent;
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Sending...";
  }

  const payload = {
    ...getFormData(reservationForm),
    submissionId: createSubmissionId(),
  };

  try {
    const [response, clientEmail] = await Promise.all([
      fetch("/api/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }),
      sendInquiryEmail(payload),
    ]);

    const data = await response.json();
    const emailSent = clientEmail.sent || data.emailSent === true;

    if (!response.ok) {
      setFeedback(reservationFeedback, data.message || "Unable to submit your inquiry right now.", true);
      return;
    }

    reservationForm.reset();

    if (emailSent) {
      setFeedback(
        reservationFeedback,
        data.message || "Thanks — Zhuji will personally follow up about your mailing needs."
      );
      window.setTimeout(closeReservationModal, 1400);
      return;
    }

    setFeedback(
      reservationFeedback,
      "Your inquiry was saved, but email delivery failed. Please call (825) 993-3458.",
      true
    );
  } catch (error) {
    setFeedback(reservationFeedback, "Unable to reach the backend. Please try again.", true);
  } finally {
    reservationSubmitting = false;
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = originalLabel;
    }
  }
});
