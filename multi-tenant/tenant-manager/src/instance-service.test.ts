// Instance service tests
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateInstanceUrl } from './instance-service.js';

describe('generateInstanceUrl', () => {
  // Test actual implementation without mocking config
  // The config is loaded at startup, so we test the actual behavior

  describe('Default URL Format', () => {
    it('should generate URL with default format', () => {
      const url = generateInstanceUrl('test-prod');
      // Default format is {name}.{baseDomain} with baseDomain=openclaw.app and scheme=https
      expect(url).toBeTruthy();
      expect(url).toContain('test-prod');
      expect(url).toContain('openclaw.app');
    });

    it('should handle simple instance names', () => {
      const url = generateInstanceUrl('myinstance');
      expect(url).toBeTruthy();
      expect(url).toContain('myinstance');
    });

    it('should handle names with hyphens', () => {
      const url = generateInstanceUrl('dev-staging-env');
      expect(url).toBeTruthy();
      expect(url).toContain('dev-staging-env');
    });

    it('should handle names with numbers', () => {
      const url = generateInstanceUrl('instance-123');
      expect(url).toBeTruthy();
      expect(url).toContain('instance-123');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty instance name gracefully', () => {
      const url = generateInstanceUrl('');
      expect(url).toBeTruthy();
    });

    it('should handle special characters in name', () => {
      const url = generateInstanceUrl('test_instance');
      expect(url).toBeTruthy();
      expect(url).toContain('test_instance');
    });
  });
});

describe('InstanceService - URL Generation Integration', () => {
  it('should export generateInstanceUrl function', () => {
    expect(generateInstanceUrl).toBeDefined();
    expect(typeof generateInstanceUrl).toBe('function');
  });

  it('should be importable from instance-service', () => {
    const url = generateInstanceUrl('integration-test');
    expect(url).toBeTruthy();
    expect(url).toContain('integration-test');
  });

  it('should generate URLs that start with scheme', () => {
    const url = generateInstanceUrl('test');
    expect(url).toMatch(/^https?:\/\//);
  });

  it('should generate consistent URLs for same input', () => {
    const url1 = generateInstanceUrl('test-instance');
    const url2 = generateInstanceUrl('test-instance');
    expect(url1).toBe(url2);
  });

  it('should generate different URLs for different inputs', () => {
    const url1 = generateInstanceUrl('instance-a');
    const url2 = generateInstanceUrl('instance-b');
    expect(url1).not.toBe(url2);
  });
});
