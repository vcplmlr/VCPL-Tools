/* Serves the bundled language files (stored as base64 scripts) under the URLs Tesseract requests. */
(function () {
  var realFetch = self.fetch.bind(self);
  self.fetch = function (input, init) {
    var s = String((input && input.url) || input);
    var m = s.match(/\/([a-z_]+)\.traineddata\.gz(\?.*)?$/);
    if (m) {
      try {
        if (!self.__LANG || !self.__LANG[m[1]]) importScripts(new URL('lang/' + m[1] + '.js', self.location.href).href);
        var bin = atob(self.__LANG[m[1]]), bytes = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return Promise.resolve(new Response(bytes, { status: 200 }));
      } catch (e) { return Promise.reject(e); }
    }
    return realFetch(input, init);
  };
  importScripts('worker.min.js');
})();
