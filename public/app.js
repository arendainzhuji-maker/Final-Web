const reservationForm = document.getElementById("reservation-form");
const reservationFeedback = document.getElementById("reservation-feedback");
const reservationModal = document.getElementById("reservation-modal");
const closeModalButton = document.getElementById("close-modal");
const NOTIFY_EMAIL = (document.body?.dataset?.notifyEmail || "laststopmails@gmail.com").trim().toLowerCase();

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
  if (plan === "community") {
    return "Community postcard campaign (5,000 homes)";
  }

  if (plan === "double") {
    return "Printing & postage";
  }

  if (plan === "custom") {
    return "Not sure / custom project";
  }

  return "Direct mail campaign";
}

function buildInquiryMessage(fields) {
  return [
    `Business name: ${fields.companyName || "—"}`,
    `Contact name: ${fields.contactName || "—"}`,
    `Email: ${fields.email || "—"}`,
    `Phone: ${fields.phone || "—"}`,
    `Service: ${formatPlanLabel(fields.plan)}`,
    `Notes: ${fields.notes || "None"}`,
  ].join("\n");
}

async function sendInquiryEmailBackup(fields) {
  const response = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(NOTIFY_EMAIL)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      _subject: "[Last Stop Mail] New Reservation Request",
      _template: "table",
      _captcha: "false",
      name: fields.contactName || "Website visitor",
      email: fields.email || NOTIFY_EMAIL,
      phone: fields.phone || "",
      business_name: fields.companyName || "",
      service: formatPlanLabel(fields.plan),
      notes: fields.notes || "",
      message: buildInquiryMessage(fields),
    }),
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok || result.success === "false" || result.success === false) {
    throw new Error(result.message || "Backup email delivery failed");
  }

  return true;
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

  const fields = getFormData(reservationForm);

  try {
    let emailSent = false;
    let successMessage = `Thanks, ${fields.contactName}. Zhuji will personally follow up about your mailing needs.`;

    try {
      const response = await fetch("/api/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...fields,
          submissionId: createSubmissionId(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setFeedback(reservationFeedback, data.message || "Unable to submit your inquiry right now.", true);
        return;
      }

      emailSent = data.emailSent === true;
      successMessage =
        data.message || `Thanks, ${fields.contactName}. Zhuji will personally follow up about your mailing needs.`;
    } catch (error) {
      // Server unreachable — still try email backup below.
      console.warn("API reservation failed, trying email backup:", error);
    }

    if (!emailSent) {
      try {
        await sendInquiryEmailBackup(fields);
        emailSent = true;
        successMessage = `Thanks, ${fields.contactName}. Zhuji will personally follow up about your mailing needs.`;
      } catch (backupError) {
        console.error("Backup inquiry email failed:", backupError);
      }
    }

    if (!emailSent) {
      setFeedback(
        reservationFeedback,
        `Thanks, ${fields.contactName}. We saved your details, but email delivery failed. Please call (825) 993-3458.`,
        true
      );
      return;
    }

    reservationForm.reset();
    setFeedback(reservationFeedback, successMessage, false);
    window.setTimeout(closeReservationModal, 1400);
  } catch (error) {
    setFeedback(reservationFeedback, "Unable to send your inquiry. Please call (825) 993-3458.", true);
  } finally {
    reservationSubmitting = false;
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = originalLabel;
    }
  }
});
