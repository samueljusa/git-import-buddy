/**
 * Toasts sonorisés : chaque notification déclenche un son adapté
 * (succès, erreur, information) en plus de l'affichage visuel.
 */
import { toast as sonnerToast } from "sonner";
import { playChime } from "@/lib/chime";

type Options = Parameters<typeof sonnerToast>[1];

export const toast = Object.assign(
  (message: string, options?: Options) => {
    playChime("notify");
    return sonnerToast(message, options);
  },
  {
    success: (message: string, options?: Options) => {
      playChime("success");
      return sonnerToast.success(message, options);
    },
    error: (message: string, options?: Options) => {
      playChime("error");
      return sonnerToast.error(message, options);
    },
    info: (message: string, options?: Options) => {
      playChime("notify");
      return sonnerToast.info(message, options);
    },
    warning: (message: string, options?: Options) => {
      playChime("error");
      return sonnerToast.warning(message, options);
    },
    message: (message: string, options?: Options) => {
      playChime("notify");
      return sonnerToast.message(message, options);
    },
    loading: sonnerToast.loading,
    dismiss: sonnerToast.dismiss,
    promise: sonnerToast.promise,
  },
);
