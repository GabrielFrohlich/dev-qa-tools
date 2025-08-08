// Vendor entry to expose faker on window without remote imports
import { faker as _faker } from '@faker-js/faker';
// Expose globally for content script consumption
// Avoid overwriting if page provides its own
if (typeof window !== 'undefined' && !window.faker) {
  window.faker = _faker;
}
