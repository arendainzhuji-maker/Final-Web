const reservationForm = document.getElementById("reservation-form");
const reservationFeedback = document.getElementById("reservation-feedback");
const reservationModal = document.getElementById("reservation-modal");
const closeModalButton = document.getElementById("close-modal");

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

  try {
    const response = await fetch("/api/reservations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...getFormData(reservationForm),
        submissionId: createSubmissionId(),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      setFeedback(reservationFeedback, data.message || "Unable to submit your inquiry right now.", true);
      return;
    }

    reservationForm.reset();
    setFeedback(
      reservationFeedback,
      data.message || "Thanks — Zhuji will personally follow up about your mailing needs.",
      !data.emailSent
    );
    if (data.emailSent !== false) {
      window.setTimeout(closeReservationModal, 1400);
    }
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
