import { createPortal } from "react-dom";

export function ModalPortal({ children }) {
  return createPortal(children, document.body);
}
