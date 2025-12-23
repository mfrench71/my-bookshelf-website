// Reusable Rating Input Component
import { initIcons } from '../utils.js';

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
  /**
   * @param {Object} options
   * @param {HTMLElement} options.container - Container element to render into
   * @param {number} options.value - Initial rating value (0-5)
   * @param {Function} options.onChange - Callback when rating changes
   */
  constructor(options = {}) {
    this.container = options.container;
    this.value = options.value || 0;
    this.onChange = options.onChange || (() => {});
    this.buttons = [];

    if (this.container) {
      this.render();
      this.bindEvents();
    }
  }

  /**
   * Render the star buttons into the container
   */
  render() {
    this.container.innerHTML = '';
    this.container.className = 'flex gap-1';

    for (let i = 1; i <= 5; i++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'star-btn p-1';
      btn.dataset.rating = i;
      btn.innerHTML = '<i data-lucide="star" class="w-5 h-5"></i>';
      this.container.appendChild(btn);
      this.buttons.push(btn);
    }

    this.updateDisplay();
    initIcons();
  }

  /**
   * Bind click event handlers to star buttons
   */
  bindEvents() {
    this.buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const clickedRating = parseInt(btn.dataset.rating);
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
  updateDisplay() {
    this.buttons.forEach(btn => {
      const rating = parseInt(btn.dataset.rating);
      btn.classList.toggle('active', rating <= this.value);
    });
    initIcons();
  }

  /**
   * Get the current rating value
   * @returns {number} Current rating (0-5)
   */
  getValue() {
    return this.value;
  }

  /**
   * Set the rating value programmatically
   * @param {number} value - New rating value (0-5)
   */
  setValue(value) {
    this.value = Math.max(0, Math.min(5, value || 0));
    this.updateDisplay();
  }

  /**
   * Reset rating to 0
   */
  reset() {
    this.setValue(0);
  }
}
