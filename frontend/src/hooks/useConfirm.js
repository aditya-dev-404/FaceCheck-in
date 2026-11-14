import { useContext } from "react";
import { ConfirmContext } from "../context/confirm-context";

/**
 * Returns confirm(options) -> Promise<boolean>, a styled replacement for
 * window.confirm. Options: { title, message, confirmText, cancelText, tone }
 * where tone is "default" or "danger".
 *
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title: "Remove member?", message: "...", tone: "danger" }))) return;
 */
const useConfirm = () => {
  const confirm = useContext(ConfirmContext);
  if (!confirm) {
    throw new Error("useConfirm must be used inside <ConfirmProvider>");
  }
  return confirm;
};

export default useConfirm;