window.a = 1;

(function () {
  window.b = 2;

  // FIXME: Unused function declarations are also counted.
  function c() {
    window.d = 3;
  }
})();
