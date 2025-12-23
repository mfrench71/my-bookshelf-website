/**
 * Unit tests for src/js/components/rating-input.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RatingInput } from '../src/js/components/rating-input.js';

describe('RatingInput', () => {
  let container;

  beforeEach(() => {
    // Create a fresh container for each test
    container = document.createElement('div');
    container.id = 'rating-input';
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('initialization', () => {
    it('should render 5 star buttons', () => {
      const rating = new RatingInput({ container });

      const buttons = container.querySelectorAll('.star-btn');
      expect(buttons.length).toBe(5);
    });

    it('should set correct data-rating attributes', () => {
      const rating = new RatingInput({ container });

      const buttons = container.querySelectorAll('.star-btn');
      buttons.forEach((btn, index) => {
        expect(btn.dataset.rating).toBe(String(index + 1));
      });
    });

    it('should initialize with value 0 by default', () => {
      const rating = new RatingInput({ container });

      expect(rating.getValue()).toBe(0);
    });

    it('should initialize with provided value', () => {
      const rating = new RatingInput({ container, value: 3 });

      expect(rating.getValue()).toBe(3);
    });

    it('should apply active class to stars up to initial value', () => {
      const rating = new RatingInput({ container, value: 3 });

      const buttons = container.querySelectorAll('.star-btn');
      expect(buttons[0].classList.contains('active')).toBe(true);
      expect(buttons[1].classList.contains('active')).toBe(true);
      expect(buttons[2].classList.contains('active')).toBe(true);
      expect(buttons[3].classList.contains('active')).toBe(false);
      expect(buttons[4].classList.contains('active')).toBe(false);
    });

    it('should include star icon markup', () => {
      const rating = new RatingInput({ container });

      const icons = container.querySelectorAll('[data-lucide="star"]');
      expect(icons.length).toBe(5);
    });

    it('should handle missing container gracefully', () => {
      const rating = new RatingInput({ container: null });

      expect(rating.getValue()).toBe(0);
      expect(rating.buttons).toEqual([]);
    });
  });

  describe('click interaction', () => {
    it('should update value when star is clicked', () => {
      const rating = new RatingInput({ container });

      const buttons = container.querySelectorAll('.star-btn');
      buttons[2].click(); // Click 3rd star

      expect(rating.getValue()).toBe(3);
    });

    it('should toggle off when same star is clicked twice', () => {
      const rating = new RatingInput({ container });

      const buttons = container.querySelectorAll('.star-btn');
      buttons[2].click(); // Set to 3
      expect(rating.getValue()).toBe(3);

      buttons[2].click(); // Toggle off
      expect(rating.getValue()).toBe(0);
    });

    it('should update display when value changes via click', () => {
      const rating = new RatingInput({ container });

      const buttons = container.querySelectorAll('.star-btn');
      buttons[3].click(); // Click 4th star

      expect(buttons[0].classList.contains('active')).toBe(true);
      expect(buttons[1].classList.contains('active')).toBe(true);
      expect(buttons[2].classList.contains('active')).toBe(true);
      expect(buttons[3].classList.contains('active')).toBe(true);
      expect(buttons[4].classList.contains('active')).toBe(false);
    });

    it('should call onChange callback when value changes', () => {
      const onChange = vi.fn();
      const rating = new RatingInput({ container, onChange });

      const buttons = container.querySelectorAll('.star-btn');
      buttons[4].click(); // Click 5th star

      expect(onChange).toHaveBeenCalledWith(5);
    });

    it('should call onChange when toggling off', () => {
      const onChange = vi.fn();
      const rating = new RatingInput({ container, value: 3, onChange });

      const buttons = container.querySelectorAll('.star-btn');
      buttons[2].click(); // Toggle off 3rd star

      expect(onChange).toHaveBeenCalledWith(0);
    });
  });

  describe('setValue', () => {
    it('should update value programmatically', () => {
      const rating = new RatingInput({ container });

      rating.setValue(4);

      expect(rating.getValue()).toBe(4);
    });

    it('should update display when setValue is called', () => {
      const rating = new RatingInput({ container });

      rating.setValue(2);

      const buttons = container.querySelectorAll('.star-btn');
      expect(buttons[0].classList.contains('active')).toBe(true);
      expect(buttons[1].classList.contains('active')).toBe(true);
      expect(buttons[2].classList.contains('active')).toBe(false);
    });

    it('should clamp value to 0-5 range', () => {
      const rating = new RatingInput({ container });

      rating.setValue(-1);
      expect(rating.getValue()).toBe(0);

      rating.setValue(10);
      expect(rating.getValue()).toBe(5);
    });

    it('should handle null/undefined value', () => {
      const rating = new RatingInput({ container, value: 3 });

      rating.setValue(null);
      expect(rating.getValue()).toBe(0);

      rating.setValue(undefined);
      expect(rating.getValue()).toBe(0);
    });
  });

  describe('reset', () => {
    it('should reset value to 0', () => {
      const rating = new RatingInput({ container, value: 5 });

      rating.reset();

      expect(rating.getValue()).toBe(0);
    });

    it('should update display on reset', () => {
      const rating = new RatingInput({ container, value: 5 });

      rating.reset();

      const buttons = container.querySelectorAll('.star-btn');
      buttons.forEach(btn => {
        expect(btn.classList.contains('active')).toBe(false);
      });
    });
  });

  describe('accessibility', () => {
    it('should have button type to prevent form submission', () => {
      const rating = new RatingInput({ container });

      const buttons = container.querySelectorAll('.star-btn');
      buttons.forEach(btn => {
        expect(btn.type).toBe('button');
      });
    });
  });

  describe('edge cases', () => {
    it('should handle rapid clicks correctly', () => {
      const onChange = vi.fn();
      const rating = new RatingInput({ container, onChange });

      const buttons = container.querySelectorAll('.star-btn');

      // Rapid click sequence
      buttons[0].click();
      buttons[4].click();
      buttons[2].click();

      expect(rating.getValue()).toBe(3);
      expect(onChange).toHaveBeenCalledTimes(3);
    });

    it('should preserve container class when re-rendering', () => {
      container.className = 'custom-class';
      const rating = new RatingInput({ container });

      // After render, should have flex gap-1 from component
      expect(container.classList.contains('flex')).toBe(true);
      expect(container.classList.contains('gap-1')).toBe(true);
    });
  });
});
