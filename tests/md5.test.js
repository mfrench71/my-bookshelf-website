/**
 * Unit tests for md5.js utilities
 */

import { describe, it, expect } from 'vitest';
import { md5, getGravatarUrl } from '../src/js/md5.js';

describe('md5', () => {
  it('should hash empty string correctly', () => {
    expect(md5('')).toBe('d41d8cd98f00b204e9800998ecf8427e');
  });

  it('should hash "hello" correctly', () => {
    expect(md5('hello')).toBe('5d41402abc4b2a76b9719d911017c592');
  });

  it('should hash "Hello World" correctly', () => {
    expect(md5('Hello World')).toBe('b10a8db164e0754105b7a99be72e3fe5');
  });

  it('should hash email addresses correctly', () => {
    // Known Gravatar test hash
    expect(md5('test@example.com')).toBe('55502f40dc8b7c769880b10874abc9d0');
  });

  it('should handle unicode characters', () => {
    const hash = md5('héllo wörld');
    expect(hash).toMatch(/^[a-f0-9]{32}$/);
  });

  it('should be deterministic', () => {
    const input = 'consistent input';
    expect(md5(input)).toBe(md5(input));
  });
});

describe('getGravatarUrl', () => {
  it('should generate correct Gravatar URL', () => {
    const url = getGravatarUrl('test@example.com');
    expect(url).toBe('https://www.gravatar.com/avatar/55502f40dc8b7c769880b10874abc9d0?s=80&d=404');
  });

  it('should normalize email to lowercase', () => {
    const lower = getGravatarUrl('test@example.com');
    const upper = getGravatarUrl('TEST@EXAMPLE.COM');
    expect(lower).toBe(upper);
  });

  it('should trim whitespace from email', () => {
    const trimmed = getGravatarUrl('test@example.com');
    const padded = getGravatarUrl('  test@example.com  ');
    expect(trimmed).toBe(padded);
  });

  it('should support custom size parameter', () => {
    const url = getGravatarUrl('test@example.com', 200);
    expect(url).toContain('s=200');
  });

  it('should use default size of 80', () => {
    const url = getGravatarUrl('test@example.com');
    expect(url).toContain('s=80');
  });

  it('should include 404 default to detect missing avatars', () => {
    const url = getGravatarUrl('test@example.com');
    expect(url).toContain('d=404');
  });
});
