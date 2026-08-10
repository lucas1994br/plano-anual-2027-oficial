import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatContratoMask = (value: string) => {
  if (!value) return "";
  let v = value.replace(/\D/g, "");
  if (v.length > 3) {
    v = v.replace(/^(\d{3})(\d)/, "$1/$2");
  }
  return v.substring(0, 8);
};
