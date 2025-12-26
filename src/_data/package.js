/**
 * Expose package.json data and build-time values to Nunjucks templates
 * Usage in templates: {{ package.version }}, {{ package.year }}
 */
const pkg = require('../../package.json');

module.exports = {
  ...pkg,
  year: new Date().getFullYear()
};
