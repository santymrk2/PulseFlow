import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/** Merge conditional class names and de-duplicate conflicting Tailwind classes. */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

// Tipos auxiliales de shadcn-svelte: descartan props de snippet/ref que los
// componentes primitivos (bits-ui) manejan por su cuenta.
export type WithoutChild<T> = T extends { child?: unknown } ? Omit<T, "child"> : T
export type WithoutChildren<T> = T extends { children?: unknown } ? Omit<T, "children"> : T
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null }
