// The few interactions the server-rendered pages need (they were React client components): theme, menus, the
// mobile drawer, the hero typewriter, the pricing toggle, and small form helpers. Forms work without it; HTMX
// (static/htmx.min.js) does the partial updates.
(function () {
  "use strict";

  // Must match the inline script in templates/base.html.
  var THEME_KEY = "rows-theme";
  var reduceMotion = function () {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  };

  function onReady(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  // --- Theme: data-theme on <html>; CSS picks the icon. ------------------------------------------------------
  document.addEventListener("click", function (e) {
    var toggle = e.target.closest && e.target.closest("[data-theme-toggle]");
    if (!toggle) return;
    var root = document.documentElement;
    var next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch (err) {
      // Private mode: the choice lasts until the page is reloaded.
    }
  });

  // --- Account menu: opens above its button; closes on outside click or Escape. ------------------------------
  function closeMenus(except) {
    document.querySelectorAll("[data-menu]").forEach(function (menu) {
      if (menu === except) return;
      var panel = menu.querySelector("[data-menu-panel]");
      var button = menu.querySelector("[data-menu-button]");
      if (panel && !panel.hidden) {
        panel.hidden = true;
        button.setAttribute("aria-expanded", "false");
      }
    });
  }
  document.addEventListener("click", function (e) {
    var button = e.target.closest && e.target.closest("[data-menu-button]");
    var menu = e.target.closest && e.target.closest("[data-menu]");
    closeMenus(menu);
    if (!button) return;
    var panel = menu.querySelector("[data-menu-panel]");
    panel.hidden = !panel.hidden;
    button.setAttribute("aria-expanded", String(!panel.hidden));
  });

  // --- Mobile drawer -----------------------------------------------------------------------------------------
  function drawer(open) {
    var panel = document.querySelector("[data-drawer-panel]");
    var backdrop = document.querySelector("[data-drawer-backdrop]");
    var opener = document.querySelector("[data-drawer-open]");
    if (!panel) return;
    if (open) panel.setAttribute("data-open", "");
    else panel.removeAttribute("data-open");
    if (backdrop) backdrop.hidden = !open;
    if (opener) opener.setAttribute("aria-expanded", String(open));
    if (open) {
      var first = panel.querySelector("a, button");
      if (first) first.focus();
    } else if (opener && panel.contains(document.activeElement)) {
      opener.focus();
    }
  }
  document.addEventListener("click", function (e) {
    if (!e.target.closest) return;
    if (e.target.closest("[data-drawer-open]")) return drawer(true);
    if (e.target.closest("[data-drawer-close]") || e.target.closest("[data-drawer-backdrop]")) return drawer(false);
    // Following a link or starting a chat closes the drawer.
    var panel = document.querySelector("[data-drawer-panel][data-open]");
    if (panel && panel.contains(e.target) && e.target.closest("a, button[type=submit]")) drawer(false);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (document.querySelector("[data-drawer-panel][data-open]")) drawer(false);
    closeMenus(null);
  });

  // --- Enter sends, Shift+Enter makes a new line --------------------------------------------------------------
  document.addEventListener("keydown", function (e) {
    var field = e.target;
    if (!field.matches || !field.matches("textarea[data-enter-submits]")) return;
    if (e.key !== "Enter" || e.shiftKey || e.isComposing) return;
    e.preventDefault();
    if (field.value.trim() && field.form) field.form.requestSubmit();
  });

  // A plain (non-HTMX) form shows its pending label and cannot be sent twice.
  document.addEventListener("submit", function (e) {
    var form = e.target;
    if (!form.matches("[data-pending-form]")) return;
    var button = form.querySelector("[data-pending-label]");
    if (button) {
      button.textContent = button.getAttribute("data-pending-label");
      button.disabled = true;
    }
  });

  // --- Chat: show the message at once, clear the box, keep the newest message in view -------------------------
  function scrollToEnd() {
    var end = document.querySelector("[data-message-end]");
    if (end) end.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "nearest" });
  }
  document.addEventListener("htmx:beforeRequest", function (e) {
    var form = e.detail.elt;
    if (!form.matches || !form.matches("[data-chat-composer]")) return;
    var field = form.querySelector("textarea");
    var text = field.value.trim();
    if (!text) return e.preventDefault();
    var list = document.querySelector("[data-message-list]");
    var thinking = list.querySelector("[data-thinking]");
    var row = document.createElement("div");
    row.className = "flex justify-end";
    var bubble = document.createElement("p");
    bubble.className = "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed bg-ink text-page";
    bubble.textContent = text;
    row.appendChild(bubble);
    list.insertBefore(row, thinking);
    setTimeout(function () {
      field.value = "";
    });
    scrollToEnd();
  });
  document.addEventListener("htmx:afterSwap", function (e) {
    if (e.detail.target && e.detail.target.id === "messages") {
      scrollToEnd();
      // "Save to my CV" needs at least one answer.
      var save = document.querySelector("[data-save-cv]");
      if (save && document.querySelector("[data-message-list] .justify-end")) save.disabled = false;
    }
  });

  // --- Experience form: "I work here now" disables the end date ------------------------------------------------
  document.addEventListener("change", function (e) {
    var t = e.target;
    if (t.matches && t.matches("[data-current-toggle]")) {
      var end = t.form && t.form.querySelector("[data-end-date]");
      if (end) end.disabled = t.checked;
    }
    if (t.matches && t.matches("[data-import-source]")) {
      t.form.querySelectorAll("[data-hint]").forEach(function (hint) {
        hint.hidden = hint.getAttribute("data-hint") !== t.value;
      });
    }
  });

  // --- Profile: editing the summary makes it the owner's own ---------------------------------------------------
  document.addEventListener("input", function (e) {
    var t = e.target;
    if (!t.matches || !t.matches("[data-summary-source]")) return;
    var source = document.querySelector(t.getAttribute("data-summary-source"));
    if (source) source.value = "user";
    var note = t.parentElement.querySelector("[data-ai-note]");
    if (note) note.remove();
  });

  onReady(function () {
    scrollToEnd();

    // --- Pricing: billing toggle (annual is the default) -------------------------------------------------------
    var billing = document.querySelector("[data-billing]");
    if (billing) {
      billing.addEventListener("click", function (e) {
        var option = e.target.closest("[data-billing-option]");
        if (!option) return;
        var cycle = option.getAttribute("data-billing-option");
        billing.querySelectorAll("[data-billing-option]").forEach(function (b) {
          b.setAttribute("aria-pressed", String(b === option));
        });
        billing.querySelectorAll("[data-cycle]").forEach(function (el) {
          el.hidden = el.getAttribute("data-cycle") !== cycle;
        });
        billing.querySelectorAll("[data-plan-link]").forEach(function (a) {
          a.href = a.getAttribute("data-plan-link") + cycle;
        });
      });
    }

    // --- Hero typewriter (spec §5) ----------------------------------------------------------------------------
    var typewriter = document.querySelector("[data-typewriter]");
    if (typewriter && !reduceMotion()) {
      var phrases = JSON.parse(typewriter.getAttribute("data-typewriter"));
      var out = typewriter.querySelector("[data-typewriter-text]");
      var index = 0;
      var length = phrases[0].length;
      var deleting = false;
      var tick = function () {
        var phrase = phrases[index];
        var delay;
        if (!deleting && length === phrase.length) {
          delay = 2200;
          deleting = true;
        } else if (deleting && length === 0) {
          delay = 350;
          deleting = false;
          index = (index + 1) % phrases.length;
        } else {
          delay = deleting ? 28 : 55;
          length += deleting ? -1 : 1;
        }
        out.textContent = phrases[index].slice(0, length);
        setTimeout(tick, delay);
      };
      tick();
    }
  });
})();
