export type Logger = (message: string, ...args: unknown[]) => void

export const Logger = {
  default: (message: string, ...args: unknown[]): void => {
    console.log(`[INFO] ${message}`, ...args)
  },
  debug: (message: string, ...args: unknown[]): void => {
    console.log(`[DEBUG] ${message}`, ...args)
  },
  warn: (message: string, ...args: unknown[]): void => {
    console.warn(`[WARN] ${message}`, ...args)
  },
  error: (message: string, ...args: unknown[]): void => {
    console.error(`[ERROR] ${message}`, ...args)
  },
}

export type Any = typeof Logger
