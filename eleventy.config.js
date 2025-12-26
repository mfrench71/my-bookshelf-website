module.exports = function(eleventyConfig) {
  // Pass through static files (JS is bundled separately by build:js)
  eleventyConfig.addPassthroughCopy("src/icons");
  eleventyConfig.addPassthroughCopy("src/favicon-32.png");
  eleventyConfig.addPassthroughCopy("src/manifest.json");
  eleventyConfig.addPassthroughCopy("src/sw.js");
  eleventyConfig.addPassthroughCopy("src/robots.txt");

  // Vendor files
  eleventyConfig.addPassthroughCopy({
    "src/js/vendor/lucide.min.js": "vendor/lucide.min.js"
  });
  eleventyConfig.addPassthroughCopy({
    "node_modules/@ericblade/quagga2/dist/quagga.min.js": "vendor/quagga.min.js"
  });

  // Root files (changelog, etc.)
  eleventyConfig.addPassthroughCopy({ "CHANGELOG.md": "CHANGELOG.md" });

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      layouts: "_layouts"
    },
    templateFormats: ["njk", "html", "md"],
    htmlTemplateEngine: "njk"
  };
};
