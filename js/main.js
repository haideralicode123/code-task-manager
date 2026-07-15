const tiles = [...document.querySelectorAll(".phone-link")];

if ("IntersectionObserver" in window) {
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const i = Number(el.dataset.i || 0);
        el.style.transitionDelay = `${i * 90}ms`;
        el.classList.add("is-in");
        io.unobserve(el);
      });
    },
    { threshold: 0.2 }
  );
  tiles.forEach((tile, i) => {
    tile.dataset.i = String(i);
    io.observe(tile);
  });
} else {
  tiles.forEach((tile) => tile.classList.add("is-in"));
}

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", (e) => {
    const id = link.getAttribute("href");
    if (!id || id === "#") return;
    const target = document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

const themeToggle = document.getElementById("theme-toggle");
const THEME_KEY = "welay-theme";

function currentTheme() {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

function setTheme(next) {
  document.documentElement.setAttribute("data-theme", next);
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch (_) {}
  if (themeToggle) {
    themeToggle.setAttribute("aria-label", next === "dark" ? "Switch to light mode" : "Switch to dark mode");
  }
}

if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    setTheme(currentTheme() === "dark" ? "light" : "dark");
  });
  setTheme(currentTheme());
}

const flipBtn = document.getElementById("flip-banda");
const heroMedia = document.getElementById("hero-media");
if (flipBtn && heroMedia) {
  flipBtn.addEventListener("click", () => {
    const flipped = heroMedia.classList.toggle("is-flipped");
    flipBtn.setAttribute("aria-pressed", flipped ? "true" : "false");
    flipBtn.setAttribute(
      "aria-label",
      flipped ? "Flip photo upright" : "Flip photo upside down"
    );
    flipBtn.textContent = flipped ? "Seedha karo" : "Flip photo";
  });
}
