(() => {
  const input = document.querySelector('#glossary-search');
  const terms = [...document.querySelectorAll('.glossary-term')];
  const result = document.querySelector('#glossary-results');
  input.addEventListener('input', () => {
    const query = input.value.trim().toLocaleLowerCase();
    let visible = 0;
    terms.forEach(term => {
      term.hidden = !term.textContent.toLocaleLowerCase().includes(query);
      if (!term.hidden) visible++;
    });
    result.textContent = visible ? `${visible} terms` : 'No matching terms. Try a shorter word.';
  });
  document.querySelectorAll('[data-copy-badge]').forEach(button => {
    button.addEventListener('click', async () => {
      const code = document.getElementById(button.dataset.copyBadge);
      try {
        await navigator.clipboard.writeText(code.value);
        document.querySelector('#goodies-status').textContent = 'HTML copied. Replace YOUR-SITE with your website address.';
      } catch {
        code.focus(); code.select();
        document.querySelector('#goodies-status').textContent = 'HTML selected. Copy it with Ctrl+C.';
      }
    });
  });
  // Publish the included guestbook-worker.js and set its public URL here.
  const GUESTBOOK_URL = siteConfig.guestbookUrl;
  const form = document.querySelector('#guestbook-form');
  const status = document.querySelector('#guestbook-status');
  const board = document.querySelector('#transmissions');
  const submit = document.querySelector('#guestbook-submit');
  const draftKey = 'nauts-guestbook-draft-v1';
  const fields = ['callsign','naut','message'];
  const naut = form.elements.naut;
  archiveData.roster.forEach(item => {
    const option = document.createElement('option');
    option.value = item.name; option.textContent = item.name; naut.append(option);
  });
  try {
    const draft = JSON.parse(localStorage.getItem(draftKey) || 'null');
    if (draft) fields.forEach(key => { if(typeof draft[key] === 'string') form.elements[key].value = draft[key]; });
  } catch { /* Storage can be disabled; the form remains usable. */ }
  const values = () => Object.fromEntries(fields.map(key => [key,form.elements[key].value.trim()]));
  function render(entries) {
    board.replaceChildren();
    if (!entries.length) {
      const text = document.createElement('p');
      text.className = 'terminal-empty'; text.textContent = 'No transmissions yet. The frequency is open.'; board.append(text); return;
    }
    entries.forEach(entry => {
      if (typeof entry.name !== 'string' || typeof entry.message !== 'string') return;
      const card = document.createElement('article'); card.className = 'transmission';
      const heading = document.createElement('h3'); heading.textContent = entry.name;
      const meta = document.createElement('p'); meta.className = 'transmission-meta';
      const time = Date.parse(entry.createdAt);
      meta.textContent = (entry.naut || 'No favourite Naut') + (Number.isFinite(time) ? ' · '+new Date(time).toLocaleDateString() : '');
      const text = document.createElement('p'); text.textContent = entry.message;
      card.append(heading,meta,text); board.append(card);
    });
  }
  async function loadMessages() {
    try {
      const response = await fetch(GUESTBOOK_URL,{signal:AbortSignal.timeout(10000)});
      if(!response.ok) throw Error('Unavailable');
      const data = await response.json();
      if(!Array.isArray(data.entries)) throw Error('Invalid response');
      render(data.entries.slice(0,50));
    } catch { board.textContent = 'The public frequency is temporarily unavailable. Please try again later.'; }
  }
  if (!GUESTBOOK_URL) {
    submit.textContent = 'SAVE LOCAL DRAFT';
    status.textContent = 'Public guestbook not connected yet. Drafts stay in this browser and are not sent.';
    board.textContent = 'Public transmissions will appear here once the guestbook is connected.';
  } else {
    status.textContent = 'Messages appear after review. Do not include personal contact details.';
    loadMessages();
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if(!form.reportValidity()) return;
    const draft = values();
    if (!draft.callsign || !draft.message) {status.textContent='Enter a callsign and a message.';return;}
    if(!GUESTBOOK_URL) {
      try { localStorage.setItem(draftKey,JSON.stringify(draft)); status.textContent='Draft saved in this browser. It has not been published or sent.'; }
      catch { status.textContent='This browser cannot save the draft. Copy your message before leaving.'; }
      return;
    }
    submit.disabled=true; status.textContent='Transmitting…';
    try {
      const response=await fetch(GUESTBOOK_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...draft,website:form.elements.website.value}),signal:AbortSignal.timeout(10000)});
      if(response.status===429) throw Error('Please wait a minute before sending another transmission.');
      if(response.status!==202) throw Error('Transmission failed. Your message remains in the form; please try again later.');
      status.textContent='Transmission received. It will appear after review.';
      form.reset(); try {localStorage.removeItem(draftKey);}catch{}
    } catch(error) {status.textContent=error.message || 'Transmission failed. Please try again later.';}
    finally {submit.disabled=false;}
  });
  document.querySelector('#guestbook-clear').addEventListener('click',()=>{
    form.reset(); try {localStorage.removeItem(draftKey);}catch{}
    status.textContent='Form and local draft cleared.';
  });
})();
