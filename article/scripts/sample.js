var a = 1;

(function () {
  var b = 2;

  console.log(b);

  // FIXME: Unused function declarations are also counted.
  function c() {
    d = 3;
  }

  window.e = function () {
    b++;
  };
})();

function f() {
  console.log("I'm too lazy to write a good example.");
}
