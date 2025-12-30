// Reusable Rating Input Component
import { initIcons } from '../utils.js';

/** Options for RatingInput constructor */
export interface RatingInputOptions {
  /** Container element to render into */
  container?: HTMLElement | null;
  /** Initial rating value (0-5) */
  value?: number;
  /** Callback when rating changes */
  onChange?: (value: number) => void;
}

/**
 * RatingInput - Interactive star rating component
 *
 * @example
 * const rating = new RatingInput({
 *   container: document.getElementById('rating-container'),
 *   value: 3,
 *   onChange: (value) => console.log('Rating:', value)
 * });
 */
export class RatingInput {
  private container: HTMLElement | null;
  private value: number;
  private onChange: (value: number) => void;
  private buttons: HTMLButtonElement[];

  constructor(options: RatingInputOptions = {}) {
    this.container = options.container ?? null;
    this.value = options.value ?? 0;
    this.onChange = options.onChange ?? (() => {});
    this.buttons = [];

    if (this.container) {
      this.render();
      this.bindEvents();
    }
  }

  /**
   * Render the star buttons into the container
   */
  render(): void {
    if (!this.container) return;

    this.container.innerHTML = '';
    this.container.className = 'flex gap-1';

    for (let i = 1; i <= 5; i++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'star-btn p-2';
      btn.dataset.rating = String(i);
      btn.setAttribute('aria-label', `Rate ${i} star${i > 1 ? 's' : ''}`);
      btn.innerHTML = '<i data-lucide="star" class="w-5 h-5" aria-hidden="true"></i>';
      this.container.appendChild(btn);
      this.buttons.push(btn);
    }

    this.updateDisplay();
    initIcons();
  }

  /**
   * Bind click event handlers to star buttons
   */
  private bindEvents(): void {
    this.buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const clickedRating = parseInt(btn.dataset.rating ?? '0');
        // Toggle off if clicking the same rating (allows clearing)
        this.value = this.value === clickedRating ? 0 : clickedRating;
        this.updateDisplay();
        this.onChange(this.value);
      });
    });
  }

  /**
   * Update the visual display of stars based on current value
   */
  private updateDisplay(): void {
    this.buttons.forEach(btn => {
      const rating = parseInt(btn.dataset.rating ?? '0');
      btn.classList.toggle('active', rating <= this.value);
    });
    initIcons();
  }

  /**
   * Get the current rating value
   * @returns Current rating (0-5)
   */
  getValue(): number {
    return this.value;
  }

  /**
   * Set the rating value programmatically
   * @param value - New rating value (0-5)
   */
  setValue(value: number): void {
    this.value = Math.max(0, Math.min(5, value || 0));
    this.updateDisplay();
  }

  /**
   * Reset rating to 0
   */
  reset(): void {
    this.setValue(0);
  }

  /**
   * Destroy the component and clean up event listeners
   */
  destroy(): void {
    // Clear container (removes buttons and their listeners)
    if (this.container) {
      this.container.innerHTML = '';
    }

    // Clear references
    this.buttons = [];
    this.container = null;
  }
}
