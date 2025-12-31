/**
 * Vendor Module Type Declarations
 * Declares types for vendor files served from /js/vendor/
 */

// Zod validation library
declare module '/js/vendor/zod.js' {
  export * from 'zod';
}

// Lucide icons
declare global {
  interface Window {
    lucide: {
      createIcons: (options?: { icons?: Record<string, unknown> }) => void;
    };
  }
  const lucide: Window['lucide'];
}

// Quagga barcode scanner
declare global {
  interface QuaggaConfig {
    inputStream?: {
      name?: string;
      type?: string;
      target?: HTMLElement | string;
      constraints?: {
        facingMode?: string;
        width?: { min?: number; ideal?: number; max?: number };
        height?: { min?: number; ideal?: number; max?: number };
        aspectRatio?: { min?: number; max?: number };
      };
      area?: { top?: string; right?: string; bottom?: string; left?: string };
    };
    decoder?: {
      readers?: string[];
      multiple?: boolean;
    };
    locate?: boolean;
    numOfWorkers?: number;
    frequency?: number;
    debug?: boolean;
  }

  interface QuaggaResult {
    codeResult?: {
      code?: string;
      format?: string;
    };
  }

  interface QuaggaStatic {
    init: (config: QuaggaConfig, callback?: (err?: Error) => void) => void;
    start: () => void;
    stop: () => void;
    onDetected: (callback: (result: QuaggaResult) => void) => void;
    offDetected: (callback?: (result: QuaggaResult) => void) => void;
    decodeSingle: (config: QuaggaConfig & { src: string }, callback: (result: QuaggaResult) => void) => void;
  }

  const Quagga: QuaggaStatic;
}

export {};
