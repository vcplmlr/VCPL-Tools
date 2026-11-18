/* VCPL Tools ad-support availability probe */
(function () {
  try {
    window.__vcplAdsProbeLoaded = true;
  } catch {
    // Ignore read-only window environments
  }
})();
