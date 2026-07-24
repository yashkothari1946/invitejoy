function toggleMobileMenu() {
  const drawer = document.getElementById("mobileNavDrawer");
  const overlay = document.getElementById("mobileNavOverlay");
  if (drawer && overlay) {
    drawer.classList.toggle("open");
    overlay.classList.toggle("open");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  // Standardize topbar header across ALL pages with broader spacious layout
  const topbar = document.querySelector(".topbar");
  if (topbar) {
    topbar.innerHTML = `
      <a href="index.html" class="brand-lockup" style="text-decoration: none; color: inherit;">
        <img src="graphics/vybtek-logo.png" alt="Vybtek Logo" class="brand-logo-img" onerror="this.src='https://vybtek.com/images/logo.png'">
        <div>
          <h1 style="font-size: 1.35rem; margin: 0; color: var(--text); font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 700; line-height: 1.1;">Vybtek Studio</h1>
          <p class="eyebrow" style="margin: 0.2rem 0 0 0; font-size: 0.78rem; color: var(--gold-strong); text-transform: uppercase; letter-spacing: 0.2em; font-weight: 700;">Wedding Creatives</p>
        </div>
      </a>
      <nav class="topnav" style="gap: 1.6rem; font-size: 1rem;">
        <a href="index.html">Home</a>
        <a href="services.html">Services</a>
        <a href="packages.html">Packages</a>
        <a href="portfolio.html">Gallery</a>
        <a href="contact.html">Contact</a>
      </nav>
      <div style="display: flex; align-items: center; gap: 0.85rem;">
        <a class="button button-primary header-cart-btn" href="cart.html" style="font-size: 0.92rem; padding: 0.6rem 1.35rem; border-radius: 10px; display: inline-flex; align-items: center; gap: 0.5rem;">
          🛒 Cart <span class="cart-badge-count">0</span>
        </a>
        <button class="mobile-menu-toggle" aria-label="Toggle navigation" onclick="toggleMobileMenu()">
          <span></span><span></span><span></span>
        </button>
      </div>
    `;
  }

  // Inject mobile drawer & overlay if missing
  if (!document.getElementById("mobileNavDrawer")) {
    const overlay = document.createElement("div");
    overlay.className = "mobile-nav-overlay";
    overlay.id = "mobileNavOverlay";
    overlay.onclick = toggleMobileMenu;

    const drawer = document.createElement("div");
    drawer.className = "mobile-nav-drawer";
    drawer.id = "mobileNavDrawer";
    drawer.innerHTML = `
      <div class="mobile-nav-header">
        <a href="index.html" class="brand-lockup" style="text-decoration: none; color: inherit;">
          <img src="graphics/vybtek-logo.png" alt="Vybtek Logo" class="brand-logo-img" style="height: 2.4rem;" onerror="this.src='https://vybtek.com/images/logo.png'">
          <div>
            <h1 style="font-size: 1.1rem; margin: 0; color: var(--text); font-weight: 700; line-height: 1.1;">Vybtek Studio</h1>
            <p class="eyebrow" style="margin: 0.15rem 0 0 0; font-size: 0.7rem; color: var(--gold-strong); text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700;">Wedding Creatives</p>
          </div>
        </a>
        <button class="close-mobile-nav" onclick="toggleMobileMenu()">&times;</button>
      </div>
      <nav class="mobile-topnav">
        <a href="index.html">Home</a>
        <a href="services.html">Services</a>
        <a href="packages.html">Packages</a>
        <a href="portfolio.html">Gallery</a>
        <a href="contact.html">Contact</a>
      </nav>
      <div style="margin-top: auto; padding-top: 1rem; border-top: 1px solid rgba(44,42,41,0.1); font-size: 0.8rem; color: var(--gold-strong); text-align: center; font-weight: 700;">
        ⚡ Powered by Vybtek
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(drawer);
  }

  // Highlight active menu tab
  const currentPath = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".topnav a, .mobile-topnav a").forEach(link => {
    const href = link.getAttribute("href");
    if (href === currentPath || (currentPath === "" && href === "index.html")) {
      link.classList.add("active");
    }
  });
});
