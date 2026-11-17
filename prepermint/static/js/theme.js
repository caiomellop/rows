// Light / dark switch (port of src/components/app-shell/theme-toggle.tsx). The theme lives in data-theme on
// <html>, set before the first paint by the inline script in base.html; CSS picks the icon to show.
(function () {
  var KEY = document.documentElement.dataset.themeKey || "rows-theme";
  document.addEventListener("click", function (event) {
    var button = event.target instanceof Element && event.target.closest("[data-theme-toggle]");
    if (!button) return;
    var root = document.documentElement;
    var next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Private mode: the choice lasts until the page is reloaded.
    }
  });
})();
