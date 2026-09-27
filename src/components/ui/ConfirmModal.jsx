import React from "react";
import Modal from "./Modal.jsx";
import Button from "./Button.jsx";

export default function ConfirmModal({ title, message, confirmLabel = "Confirmer", danger, onConfirm, onClose, submitting }) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button variant="subtle" onClick={onClose}>Retour</Button>
          <Button variant={danger ? "danger" : "primary"} loading={submitting} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed">{message}</p>
    </Modal>
  );
}
