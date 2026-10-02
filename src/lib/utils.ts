import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Formatage lisible : +2250701020304 → +225 07 01 02 03 04 ; 01020304 → 01 02 03 04
// (miroir de user-dashboard.tsx — partagé avec les vues mot de passe oublié).
export function formatPhoneDisplay(phone: string): string {
  const cleaned = phone.replace(/[\s.-]/g, "")
  const hasPlus = cleaned.startsWith("+")
  const digits = hasPlus ? cleaned.slice(1) : cleaned
  if (!/^\d{8,15}$/.test(digits)) return phone

  if (hasPlus && digits.length > 10) {
    const countryCode = digits.slice(0, digits.length - 10)
    const local = digits.slice(-10)
    return `+${countryCode} ${local.replace(/(\d{2})(?=\d)/g, "$1 ")}`
  }
  return `${hasPlus ? "+" : ""}${digits.replace(/(\d{2})(?=\d)/g, "$1 ")}`
}
