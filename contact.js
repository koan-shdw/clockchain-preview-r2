/* Contact form modal (Website Notes 7/31 #5/#6).
   Opened by any [data-contact] element; submissions go to info@clockchain.network
   via FormSubmit's AJAX endpoint (no backend needed on GitHub Pages). */
(function(){
  var ENDPOINT = 'https://formsubmit.co/ajax/info@clockchain.network';

  function init(){
    var overlay = document.createElement('div');
    overlay.className = 'cm-overlay';
    overlay.hidden = true;
    overlay.innerHTML =
      '<div class="cm-card" role="dialog" aria-modal="true" aria-labelledby="cm-title">' +
        '<button class="cm-close" type="button" aria-label="Close contact form"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
        '<form class="cm-form" novalidate>' +
          '<h3 class="cm-title" id="cm-title">Talk to the team</h3>' +
          '<p class="cm-sub">Tell us what you are building or what you need. We read everything.</p>' +
          '<div class="cm-field"><label for="cm-name">Name</label><input id="cm-name" name="name" type="text" autocomplete="name" required /></div>' +
          '<div class="cm-field"><label for="cm-email">Email</label><input id="cm-email" name="email" type="email" autocomplete="email" required /></div>' +
          '<div class="cm-field"><label for="cm-company">Company (optional)</label><input id="cm-company" name="company" type="text" autocomplete="organization" /></div>' +
          '<div class="cm-field"><label for="cm-message">Message</label><textarea id="cm-message" name="message" required></textarea></div>' +
          '<input type="text" name="_honey" style="display:none" tabindex="-1" autocomplete="off" />' +
          '<div class="cm-actions"><button class="btn btn-primary" type="submit">Send message</button><span class="cm-status" role="status" aria-live="polite"></span></div>' +
        '</form>' +
        '<div class="cm-success" hidden><h4>Message sent.</h4><p>Thanks for reaching out. The team will get back to you shortly.</p></div>' +
      '</div>';
    document.body.appendChild(overlay);

    var form = overlay.querySelector('.cm-form');
    var success = overlay.querySelector('.cm-success');
    var status = overlay.querySelector('.cm-status');
    var closeBtn = overlay.querySelector('.cm-close');
    var lastFocus = null;

    function open(){
      lastFocus = document.activeElement;
      overlay.hidden = false;
      document.body.classList.add('cm-lock');
      form.hidden = false;
      success.hidden = true;
      status.textContent = '';
      var first = overlay.querySelector('#cm-name');
      if (first) first.focus();
    }
    function close(){
      overlay.hidden = true;
      document.body.classList.remove('cm-lock');
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    document.querySelectorAll('[data-contact]').forEach(function(el){
      el.addEventListener('click', function(e){ e.preventDefault(); open(); });
    });
    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', function(e){ if (e.target === overlay) close(); });
    document.addEventListener('keydown', function(e){ if (e.key === 'Escape' && !overlay.hidden) close(); });

    form.addEventListener('submit', function(e){
      e.preventDefault();
      if (!form.checkValidity()){ form.reportValidity(); return; }
      var btn = form.querySelector('button[type=submit]');
      btn.disabled = true;
      status.classList.remove('error');
      status.textContent = 'Sending…';
      var data = new FormData(form);
      data.append('_subject', 'Clockchain website enquiry');
      data.append('_template', 'table');
      fetch(ENDPOINT, { method: 'POST', headers: { 'Accept': 'application/json' }, body: data })
        .then(function(r){ if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function(){ form.reset(); form.hidden = true; success.hidden = false; btn.disabled = false; status.textContent = ''; })
        .catch(function(){
          btn.disabled = false;
          status.classList.add('error');
          status.textContent = 'Something went wrong. Please email info@clockchain.network directly.';
        });
    });
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); } else { init(); }
})();
