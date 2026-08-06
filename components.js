/* Clockchain shared UI components (Nav & Footer injection) */
(function(){
  var SVG_X = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817-5.967 6.817H1.677l7.73-8.835L1.254 2.25h6.829l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>';
  var SVG_DISCORD = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.363 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>';
  var SVG_TELEGRAM = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9.04 15.4 8.9 19.2c.4 0 .57-.17.77-.37l1.86-1.78 3.86 2.83c.71.39 1.21.18 1.4-.65l2.53-11.85c.23-1.04-.38-1.45-1.06-1.2L3.5 10.18c-1 .39-.99.94-.18 1.19l3.66 1.14 8.5-5.36c.4-.25.77-.11.47.14"/></svg>';
  var SVG_EMAIL = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M2 5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2zm2 .5v.4l8 5.6 8-5.6V5.5L12 11Z"/></svg>';
  var SVG_ARROW_UP = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';

  var path = location.pathname.replace(/\/$/, '') || '/index.html';
  var pageName = path.substring(path.lastIndexOf('/') + 1) || 'index.html';
  var isHome = document.body.classList.contains('has-earth') || pageName === 'index.html' || pageName === '';

  // Inject Nav
  var navContainer = document.getElementById('site-nav');
  if (navContainer) {
    var logoHref = isHome ? '#main-content' : 'index.html';
    navContainer.outerHTML = 
      '<nav class="nav">' +
        '<a class="nav-logo" href="' + logoHref + '" aria-label="Clockchain"><img src="assets/clockchain-logo-full.png" alt="Clockchain" /></a>' +
        '<ul class="nav-links">' +
          '<li><a href="about.html"' + (pageName === 'about.html' ? ' aria-current="page"' : '') + '>About</a></li>' +
          '<li><a href="services.html"' + (pageName === 'services.html' ? ' aria-current="page"' : '') + '>Services</a></li>' +
          '<li><a href="newsroom.html"' + (pageName === 'newsroom.html' ? ' aria-current="page"' : '') + '>News</a></li>' +
          '<li><a href="docs.html"' + (pageName === 'docs.html' ? ' aria-current="page"' : '') + '>Docs</a></li>' +
          '<li><a href="https://services.clockchain.network/docs">API</a></li>' +
        '</ul>' +
        '<div class="nav-right">' +
          '<nav class="nav-socials" aria-label="Clockchain on social media">' +
            '<a href="https://x.com/clockchain_time" target="_blank" rel="noopener" aria-label="Clockchain on X">' + SVG_X + '</a>' +
            '<a href="https://discord.com/invite/daHCN5qMtN" target="_blank" rel="noopener" aria-label="Clockchain on Discord">' + SVG_DISCORD + '</a>' +
            '<a href="https://t.me/ClockchainTime" target="_blank" rel="noopener" aria-label="Clockchain on Telegram">' + SVG_TELEGRAM + '</a>' +
          '</nav>' +
          '<button class="nav-burger" id="nav-burger" aria-label="Open menu" aria-expanded="false" aria-controls="mobile-menu"><span></span><span></span><span></span></button>' +
        '</div>' +
      '</nav>' +
      '<div class="mobile-menu" id="mobile-menu" aria-hidden="true">' +
        '<nav class="mm-links" aria-label="Primary (mobile)">' +
          '<a href="about.html"' + (pageName === 'about.html' ? ' aria-current="page"' : '') + '>About</a>' +
          '<a href="services.html"' + (pageName === 'services.html' ? ' aria-current="page"' : '') + '>Services</a>' +
          '<a href="newsroom.html"' + (pageName === 'newsroom.html' ? ' aria-current="page"' : '') + '>News</a>' +
          '<a href="docs.html"' + (pageName === 'docs.html' ? ' aria-current="page"' : '') + '>Docs</a>' +
          '<a href="https://services.clockchain.network/docs">API</a>' +
          '<a href="https://discord.com/invite/daHCN5qMtN" target="_blank" rel="noopener">Community</a>' +
        '</nav>' +
        '<nav class="mm-socials" aria-label="Clockchain on social media">' +
          '<a href="https://t.me/ClockchainTime" target="_blank" rel="noopener" aria-label="Clockchain on Telegram">' + SVG_TELEGRAM + '</a>' +
          '<a href="https://discord.com/invite/daHCN5qMtN" target="_blank" rel="noopener" aria-label="Clockchain on Discord">' + SVG_DISCORD + '</a>' +
          '<a href="https://x.com/clockchain_time" target="_blank" rel="noopener" aria-label="Clockchain on X (formerly Twitter)">' + SVG_X + '</a>' +
        '</nav>' +
      '</div>';
  }

  // Inject Footer
  var footerContainer = document.getElementById('site-footer');
  if (footerContainer) {
    footerContainer.outerHTML =
      '<footer class="footer">' +
        '<div class="container-wide">' +
          '<div class="footer-top">' +
            '<div class="footer-brand">' +
              '<a href="#main-content" aria-label="Clockchain, back to top" style="display:inline-block;"><img src="assets/clockchain-logo-full.png" alt="Clockchain" /></a>' +
              '<p class="footer-addr">D4D Sàrl<br/>Rue des Beaux-Arts 8<br/>2000 Neuchâtel · Switzerland<br/><br/>info@d4d.group</p>' +
            '</div>' +
            '<div class="footer-col"><h5>Company</h5><ul><li><a href="about.html">About</a></li><li><a href="about.html#patent">Patent · US 12,022,015</a></li><li><a href="#" data-contact>Contact</a></li></ul></div>' +
            '<div class="footer-col"><h5>Product</h5><ul><li><a href="https://services.clockchain.network/docs">Docs</a></li><li><a href="services.html">Services</a></li></ul></div>' +
            '<div class="footer-col"><h5>Resources</h5><ul><li><a href="newsroom.html#news">News</a></li><li><a href="newsroom.html#blog">Blog</a></li></ul></div>' +
            '<div class="footer-col"><h5>Network</h5><ul><li><a href="https://services.clockchain.network" target="_blank" rel="noopener">Dev Portal</a></li><li><a href="#" data-contact>Node operators</a></li></ul></div>' +
            '<div class="footer-col"><h5>Legal</h5><ul><li><a href="terms.html">Terms of Use</a></li><li><a href="privacy.html">Privacy Policy</a></li><li><a href="cookie.html">Cookie Policy</a></li><li><a href="#" data-cookie-settings>Cookie settings</a></li></ul></div>' +
          '</div>' +
          '<div class="footer-bottom">' +
            '<span class="footer-copy">© 2026 D4D Sàrl. All rights reserved. Clockchain® is a registered trademark of D4D Sàrl.</span>' +
            '<a href="#top" class="btt-top" aria-label="Back to top of page">' +
              SVG_ARROW_UP +
              '<span>Back to top</span>' +
            '</a>' +
            '<nav class="footer-socials" aria-label="Clockchain social media and contact">' +
              '<a href="https://t.me/ClockchainTime" target="_blank" rel="noopener" aria-label="Clockchain on Telegram">' + SVG_TELEGRAM + '</a>' +
              '<a href="https://discord.com/invite/daHCN5qMtN" target="_blank" rel="noopener" aria-label="Clockchain on Discord">' + SVG_DISCORD + '</a>' +
              '<a href="https://x.com/clockchain_time" target="_blank" rel="noopener" aria-label="Clockchain on X (formerly Twitter)">' + SVG_X + '</a>' +
              '<a href="mailto:info@d4d.group" aria-label="Email Clockchain at info@d4d.group">' + SVG_EMAIL + '</a>' +
            '</nav>' +
          '</div>' +
        '</div>' +
      '</footer>';
  }
})();
