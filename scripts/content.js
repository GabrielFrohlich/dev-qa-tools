/*
Content script that:
- Scans for text-like inputs and textareas.
- Injects a small button next to each field to generate fake data.
- Uses @faker-js/faker when available via ESM import on CDN; falls back to simple generators.
- Supports Brazilian CPF/CNPJ generation and masking.
*/

(function () {
  const STYLE_ID = "dev-qa-tools-style";
  const STORAGE_KEY = 'dqt_enabled';
  let enabled = true; // default ON

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .dqt-btn{cursor:pointer;border:1px solid #888;background:#fff;color:#333;padding:2px 6px;border-radius:4px;font-size:11px;margin-left:4px;line-height:1.6;}
      .dqt-btn:hover{background:#f3f4f6}
      .dqt-wrap{display:inline-flex;align-items:center;width: 100%}
      .dqt-hidden{display:none!important}
    `;
    document.head.appendChild(style);
  }

  function isDisabledOrReadOnly(el){
    if (!el) return false;
    const ariaDisabled = (el.getAttribute && el.getAttribute('aria-disabled')) === 'true';
    return !!(
      el.disabled ||
      el.readOnly ||
      (el.hasAttribute && (el.hasAttribute('disabled') || el.hasAttribute('readonly'))) ||
      ariaDisabled
    );
  }

  // CPF & CNPJ generators (valid with check digits)
  function onlyDigits(s){return (s+"").replace(/\D+/g,'');}

  function randomInt(min, max){
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function generateCPF({masked=true}={}){
    // 9 base digits
    const n = Array.from({length:9},()=>randomInt(0,9));
    // first DV
    const d1 = (n.reduce((acc,cur,idx)=>acc + cur * (10 - idx), 0) * 10) % 11 % 10;
    // second DV
    const d2 = ((n.reduce((acc,cur,idx)=>acc + cur * (11 - idx), 0) + d1 * 2) * 10) % 11 % 10;
    const digits = [...n, d1, d2].join('');
    if (!masked) return digits;
    return `${digits.substring(0,3)}.${digits.substring(3,6)}.${digits.substring(6,9)}-${digits.substring(9)}`;
  }

  function generateCNPJ({masked=true}={}){
    // 12 base digits
    const n = Array.from({length:12},()=>randomInt(0,9));
    const calcDV = (arr) => {
      const weights = [5,4,3,2,9,8,7,6,5,4,3,2];
      const weights2 = [6,5,4,3,2,9,8,7,6,5,4,3,2];
      const d1 = 11 - (arr.reduce((acc,cur,idx)=>acc + cur * weights[idx],0) % 11);
      const dv1 = d1 > 9 ? 0 : d1;
      const d2 = 11 - ([...arr, dv1].reduce((acc,cur,idx)=>acc + cur * weights2[idx],0) % 11);
      const dv2 = d2 > 9 ? 0 : d2;
      return [dv1, dv2];
    };
    const [dv1, dv2] = calcDV(n);
    const digits = [...n, dv1, dv2].join('');
    if (!masked) return digits;
    return `${digits.substring(0,2)}.${digits.substring(2,5)}.${digits.substring(5,8)}/${digits.substring(8,12)}-${digits.substring(12)}`;
  }

  // Obtain faker only from a safe source (pre-bundled in the extension via vendor/faker-bundle.js) or window if the page has it
  let fakerRef = null;
  async function getFaker(){
    if (fakerRef) return fakerRef;
    if (typeof window !== 'undefined' && window.faker) { fakerRef = window.faker; }
    return fakerRef;
  }

  function inferFieldKind(input){
    const name = (input.getAttribute('name') || input.id || '').toLowerCase();
    const type = (input.getAttribute('type') || input.tagName).toLowerCase();
    if (/cpf/.test(name)) return 'cpf';
    if (/cnpj/.test(name)) return 'cnpj';
    if (/email/.test(name) || type === 'email') return 'email';
    if (/phone|telefone|cel/.test(name) || type === 'tel') return 'phone';
    if (/name|nome/.test(name)) return 'name';
    if (/address|endereco|endereço/.test(name)) return 'address';
    if (/city|cidade/.test(name)) return 'city';
    if (/zip|cep/.test(name) || type === 'postal') return 'cep';
    if (/company|empresa|org|organization/.test(name)) return 'company';
    if (/birthday|data_nascimento/.test(name)) return 'date';
    if (type === 'number') return 'number';
    return 'text';
  }

  async function generateValue(kind){
    const faker = await getFaker();
    switch(kind){
      case 'cpf': return generateCPF({masked:true});
      case 'cnpj': return generateCNPJ({masked:true});
      case 'email': return faker ? faker.internet.email().toLowerCase() : `user${Date.now()}@example.com`;
      case 'phone': return faker ? faker.phone.number('(##) 9####-####') : `(11) 9${randomInt(1000,9999)}-${randomInt(1000,9999)}`;
      case 'name': return faker ? faker.person.fullName() : 'Fulano de Tal';
      case 'address': return faker ? faker.location.streetAddress({ useFullAddress: true }) : 'Rua Exemplo, 123';
      case 'city': return faker ? faker.location.city() : 'São Paulo';
      case 'cep': return faker ? faker.location.zipCode('#####-###') : `${randomInt(10000,99999)}-${randomInt(100,999)}`;
      case 'company': return faker ? faker.company.name() : 'Empresa Exemplo Ltda';
      case 'number': return String(randomInt(0, 99999));
      case 'date': return faker ? faker.date.birthdate({ min: 18, max: 65, mode: 'age' }) : '01/01/2000';
      default: return faker ? faker.lorem.words({ min: 1, max: 3 }) : 'texto exemplo';
    }
  }

  function wrapInput(input){
    if (input.dataset.dqtEnhanced === '1') return;
  if (isDisabledOrReadOnly(input)) return; // do not enhance disabled/readonly
    input.dataset.dqtEnhanced = '1';
    // Avoid wrapping inputs that are not visible
    const rect = input.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;

    const parent = input.parentElement;
    if (!parent) return;

    // Create wrapper to place button inline without breaking layout
    const wrap = document.createElement('span');
    wrap.className = 'dqt-wrap';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dqt-btn';
    btn.title = 'Gerar dado com Faker';
    btn.textContent = '🎲';

    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const kind = inferFieldKind(input);
      const value = await generateValue(kind);
      const setValue = (el, val) => {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
          || Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
        if (nativeInputValueSetter) nativeInputValueSetter.call(el, val);
        else el.value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };
      setValue(input, value);
      input.focus();
    });

    // Insert wrap and button next to input
    parent.insertBefore(wrap, input);
    wrap.appendChild(input);
    wrap.appendChild(btn);
  }

  function scan(){
  if (!enabled) return hideAllButtons();
  ensureStyles();
    const inputs = Array.from(document.querySelectorAll('input, input[type="text"], input[type="email"], input[type="tel"], input[type="number"], textarea'));

    inputs.forEach((input) => {
      const parent = input.parentElement;
      const isEnhanced = input.dataset.dqtEnhanced === '1';
      const btn = parent && parent.classList && parent.classList.contains('dqt-wrap')
        ? parent.querySelector('button.dqt-btn')
        : null;

      if (isDisabledOrReadOnly(input)) {
        // Skip enhancing; if already enhanced, hide the button
        if (btn) btn.classList.add('dqt-hidden');
        return;
      }

      // Active/interactive input
      if (btn) btn.classList.remove('dqt-hidden');
      if (!isEnhanced) wrapInput(input);
    });
  }

  // Initial and dynamic scans
  const debouncedScan = debounce(scan, 300);
  const observer = new MutationObserver(() => debouncedScan());
  observer.observe(document.documentElement || document.body, { childList: true, subtree: true });

  function debounce(fn, wait){
    let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn.apply(null, args), wait); };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAndScan);
  } else {
    initAndScan();
  }

  function hideAllButtons(){
    const btns = document.querySelectorAll('button.dqt-btn');
    btns.forEach(b => b.classList.add('dqt-hidden'));
  }

  function showAllButtons(){
    const btns = document.querySelectorAll('button.dqt-btn');
    btns.forEach(b => b.classList.remove('dqt-hidden'));
  }

  function getEnabled(){
    return new Promise((resolve) => {
      try {
        chrome.storage?.local?.get([STORAGE_KEY], (res) => {
          resolve(res?.[STORAGE_KEY] !== false);
        });
      } catch {
        resolve(true);
      }
    });
  }

  async function initAndScan(){
    enabled = await getEnabled();
    if (enabled) scan(); else hideAllButtons();
  }

  // Listen for toggle messages from service worker
  try {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg?.type === 'DQT_TOGGLE') {
        enabled = !!msg.enabled;
        if (enabled) { showAllButtons(); scan(); } else { hideAllButtons(); }
      }
    });
  } catch {}
})();
