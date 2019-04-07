window.a = 1;

(function () {
  window.b = 2;

  // Unused function's declarations are also counted.
  function c() {
    window.d = 3;
  }
})();
