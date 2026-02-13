import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getUserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

export function getTimezoneAbbreviation(): string {
  return new Date().toLocaleTimeString('en-us', { timeZoneName: 'short' }).split(' ').pop() || ''
}
