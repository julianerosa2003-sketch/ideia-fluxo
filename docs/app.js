'use strict';

/* ================== Opções (fonte única) ================== */
const OPTIONS = {
  tipo: ['App', 'Site', 'PWA'],
  linguagem: ['JavaScript (Node.js)', 'Python', 'Flutter (Dart)'],
  categoria: ['Tecnologia', 'Criação', 'Negócio', 'Hobby', 'Outro'],
  status: ['Ideia', 'Planejamento', 'Em Progresso', 'Estudo', 'Pausado', 'Concluído'],
};
const LANG_LABEL = { 'JavaScript (Node.js)': 'JS / Node', Python: 'Python', 'Flutter (Dart)': 'Flutter' };
const DEFAULTS = { tipo: 'App', linguagem: 'JavaScript (Node.js)', categoria: 'Tecnologia', status: 'Ideia' };

/* ================== Storage ================== */
// Dois modos:
//  - local: sem login, ideias no localStorage deste navegador
//  - cloud: logado com Google, ideias no Firestore (sincroniza entre aparelhos)
// A UI sempre lê de store.list (memória); quem muda é para onde as escritas vão.
const KEY = 'ideias:v1';
const FIELDS = ['id', 'nome', 'objetivo', 'composicao', 'tipo', 'linguagem', 'categoria', 'status', 'createdAt', 'updatedAt'];

// Garante formato válido (ideias antigas ganham categoria/status; campos extras saem)
function normalize(raw) {
  const i = { ...DEFAULTS, ...raw };
  const out = {};
  for (const k of FIELDS) out[k] = i[k];
  out.createdAt = Math.trunc(Number(out.createdAt) || Date.now());
  out.updatedAt = Math.trunc(Number(out.updatedAt) || out.createdAt);
  return out;
}
const isValid = (i) => i && typeof i.id === 'string' && i.nome && i.objetivo && i.composicao;
const byNewest = (a, b) => b.createdAt - a.createdAt;

function loadLocal() {
  try { return (JSON.parse(localStorage.getItem(KEY)) || []).filter(isValid).map(normalize); }
  catch { return []; }
}

let cloud = null;      // módulo cloud.js (carregado sob demanda)
let user = null;       // usuário Firebase logado
let stopWatch = null;  // cancela o listener do Firestore

const onCloudError = (e) => {
  console.error(e);
  toast(e?.code === 'permission-denied'
    ? 'Sem permissão na nuvem: confira as regras do Firestore'
    : 'Erro ao sincronizar com a nuvem');
};

const store = {
  list: loadLocal().sort(byNewest),
  get mode() { return user ? 'cloud' : 'local'; },
  all() { return this.list; },
  get(id) { return this.list.find((x) => x.id === id); },
  persistLocal() { if (!user) localStorage.setItem(KEY, JSON.stringify(this.list)); },

  upsert(idea) {
    idea = normalize(idea);
    const i = this.list.findIndex((x) => x.id === idea.id);
    if (i >= 0) this.list[i] = idea; else this.list.unshift(idea);
    if (user) cloud.saveIdea(user.uid, idea).catch(onCloudError);
    else this.persistLocal();
  },
  remove(id) {
    this.list = this.list.filter((x) => x.id !== id);
    if (user) cloud.deleteIdea(user.uid, id).catch(onCloudError);
    else this.persistLocal();
  },
  merge(ideas) {
    const map = new Map(this.list.map((i) => [i.id, i]));
    ideas.forEach((i) => map.set(i.id, i));
    this.list = [...map.values()].sort(byNewest);
    if (user) cloud.saveMany(user.uid, ideas).catch(onCloudError);
    else this.persistLocal();
  },
  clear() {
    const ids = this.list.map((i) => i.id);
    this.list = [];
    if (user) cloud.deleteMany(user.uid, ids).catch(onCloudError);
    else this.persistLocal();
  },
};

/* ================== Prompt ================== */
function buildPrompt(idea) {
  return (
    `Vamos organizar um ${idea.tipo} de ${idea.nome}, ` +
    `ele precisa funcionar da seguinte forma: ${idea.objetivo}\n\n` +
    `Ele terá uma interface organizada estruturalmente assim: ${idea.composicao}\n\n` +
    `Planejaremos na linguagem ${idea.linguagem}.`
  );
}

/* ================== Helpers ================== */
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const fmtDate = (ts) => new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, '-');
const plural = (n) => `${n} ${n === 1 ? 'ideia' : 'ideias'}`;

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  node.append(...children); // strings viram texto → sem XSS
  return node;
}
function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#i-${name}`);
  svg.append(use);
  return svg;
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 2200);
}

/* ================== Estado ================== */
const state = {
  view: 'inicio',
  query: '',
  filters: { tipo: 'all', categoria: 'all', status: 'all' },
  currentId: null,
};

const VIEWS = {
  inicio: { title: 'MINHAS IDEIAS DE PROJETOS' },
  explorar: { title: 'EXPLORAR IDEIAS' },
  dashboard: { title: 'DASHBOARD' },
  ajustes: { title: 'AJUSTES' },
};

/* ================== Card ================== */
function card(idea) {
  const stop = (fn) => (e) => { e.stopPropagation(); fn(); };
  return el('article', {
      class: 'card', tabindex: '0',
      onclick: () => openView(idea.id),
      onkeydown: (e) => { if (e.key === 'Enter') openView(idea.id); },
    },
    el('div', { class: 'card-body' },
      el('h3', {}, `${idea.nome} (${idea.tipo})`),
      el('span', { class: 'badge' }, idea.categoria),
      el('p', { class: 'card-desc' }, idea.objetivo),
      el('span', { class: `status s-${slug(idea.status)}` }, idea.status),
    ),
    el('div', { class: 'card-actions' },
      el('button', { title: 'Editar', 'aria-label': `Editar ${idea.nome}`, onclick: stop(() => openForm(idea.id)) }, icon('edit')),
      el('button', { title: 'Excluir', 'aria-label': `Excluir ${idea.nome}`, onclick: stop(() => removeIdea(idea.id)) }, icon('trash')),
    ),
  );
}

/* ================== Render ================== */
function render() {
  const all = store.all();
  const sync = user ? ' · ☁ salvas na nuvem' : ' · salvas neste aparelho';
  $('#viewTitle').textContent = VIEWS[state.view].title;
  $('#viewSubtitle').textContent = `Total: ${plural(all.length)}${sync}`;

  if (state.view === 'inicio') {
    $('#gridHome').replaceChildren(...all.map(card));
    $('#emptyHome').hidden = all.length > 0;
  }

  if (state.view === 'explorar') {
    const q = state.query.trim().toLowerCase();
    const f = state.filters;
    const list = all.filter((i) =>
      ['tipo', 'categoria', 'status'].every((k) => f[k] === 'all' || i[k] === f[k]) &&
      (!q || [i.nome, i.objetivo, i.composicao].join(' ').toLowerCase().includes(q))
    );
    $('#gridExplore').replaceChildren(...list.map(card));
    $('#emptyExplore').hidden = list.length > 0;
    $('#viewSubtitle').textContent = `${plural(list.length)} de ${all.length}${sync}`;
  }

  if (state.view === 'dashboard') renderDashboard(all);
}

function renderDashboard(all) {
  const count = (k, v) => all.filter((i) => i[k] === v).length;
  const ativos = all.filter((i) => ['Planejamento', 'Em Progresso'].includes(i.status)).length;
  const tiles = [
    [all.length, 'Total de ideias'],
    [count('status', 'Ideia'), 'Só no papel'],
    [ativos, 'Em andamento'],
    [count('status', 'Concluído'), 'Concluídas'],
  ];
  $('#stats').replaceChildren(...tiles.map(([n, l]) => el('div', { class: 'stat' }, el('b', {}, String(n)), el('span', {}, l))));

  const group = (title, key) => {
    const max = Math.max(1, ...OPTIONS[key].map((v) => count(key, v)));
    return el('div', { class: 'panel' },
      el('h2', {}, title),
      ...OPTIONS[key].map((v) => {
        const n = count(key, v);
        const bar = el('i');
        bar.style.width = `${(n / max) * 100}%`;
        return el('div', { class: 'bar-row' }, el('span', {}, key === 'linguagem' ? LANG_LABEL[v] : v), el('div', { class: 'bar' }, bar), el('b', {}, String(n)));
      }),
    );
  };
  $('#dashGroups').replaceChildren(
    group('Por status', 'status'), group('Por categoria', 'categoria'),
    group('Por tipo', 'tipo'), group('Por linguagem', 'linguagem'),
  );
}

/* ================== Roteamento (hash) ================== */
function go() {
  const view = location.hash.slice(1);
  state.view = VIEWS[view] ? view : 'inicio';
  $$('.view').forEach((v) => (v.hidden = v.dataset.view !== state.view));
  $$('a[data-view]').forEach((a) => a.classList.toggle('active', a.dataset.view === state.view));
  closeDrawer();
  window.scrollTo(0, 0);
  render();
}
window.addEventListener('hashchange', go);

/* ================== Drawer (mobile) ================== */
function openDrawer() { $('#sidebar').classList.add('open'); $('#scrim').hidden = false; }
function closeDrawer() { $('#sidebar').classList.remove('open'); $('#scrim').hidden = true; }
$('#btnDrawer').addEventListener('click', openDrawer);
$('#scrim').addEventListener('click', closeDrawer);

/* ================== Formulário ================== */
const formModal = $('#formModal');
const form = $('#ideaForm');

// Monta radios/selects a partir de OPTIONS
$$('[data-radio]', form).forEach((box) => {
  const name = box.dataset.radio;
  box.append(...OPTIONS[name].map((v) =>
    el('label', {}, el('input', { type: 'radio', name, value: v }), el('span', {}, LANG_LABEL[v] || v))));
});
$$('[data-select]', form).forEach((sel) => {
  sel.append(...OPTIONS[sel.dataset.select].map((v) => el('option', { value: v }, v)));
});

function setFormValues(idea) {
  for (const k of ['nome', 'objetivo', 'composicao']) form[k].value = idea[k] || '';
  form.id.value = idea.id || '';
  for (const k of ['tipo', 'linguagem']) {
    const r = form.querySelector(`[name=${k}][value="${CSS.escape(idea[k])}"]`);
    if (r) r.checked = true;
  }
  form.categoria.value = idea.categoria;
  form.status.value = idea.status;
}

function openForm(id) {
  const idea = id ? store.get(id) : null;
  $('#formError').hidden = true;
  $('#formTitle').textContent = idea ? 'Editar ideia' : 'Nova ideia';
  setFormValues(idea || { ...DEFAULTS });
  closeDrawer();
  if (viewModal.open) viewModal.close();
  formModal.showModal();
  form.nome.focus();
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  for (const k of ['nome', 'objetivo', 'composicao']) data[k] = (data[k] || '').trim();
  if (!data.nome || !data.objetivo || !data.composicao) {
    $('#formError').hidden = false;
    return;
  }
  const prev = data.id ? store.get(data.id) : null;
  const now = Date.now();
  store.upsert({
    id: data.id || uid(),
    nome: data.nome,
    objetivo: data.objetivo,
    composicao: data.composicao,
    tipo: data.tipo,
    linguagem: data.linguagem,
    categoria: data.categoria,
    status: data.status,
    createdAt: prev?.createdAt || now,
    updatedAt: now,
  });
  formModal.close();
  render();
  toast(prev ? 'Ideia atualizada' : 'Ideia salva');
});

/* ================== Visualização ================== */
const viewModal = $('#viewModal');

function openView(id) {
  const idea = store.get(id);
  if (!idea) return;
  state.currentId = id;
  $('#vNome').textContent = idea.nome;
  $('#vCategoria').textContent = idea.categoria;
  const st = $('#vStatus');
  st.textContent = idea.status;
  st.className = `status s-${slug(idea.status)}`;
  $('#vObjetivo').textContent = idea.objetivo;
  $('#vComposicao').textContent = idea.composicao;
  $('#vTipo').textContent = idea.tipo;
  $('#vLinguagem').textContent = idea.linguagem;
  $('#vData').textContent = fmtDate(idea.createdAt);
  $('#promptBox').hidden = true;
  $('#btnPrompt').hidden = false;
  viewModal.showModal();
}

$('#btnPrompt').addEventListener('click', () => {
  $('#promptText').textContent = buildPrompt(store.get(state.currentId));
  $('#promptBox').hidden = false;
  $('#btnPrompt').hidden = true;
});

$('#btnCopy').addEventListener('click', async () => {
  const text = $('#promptText').textContent;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const r = document.createRange();
    r.selectNodeContents($('#promptText'));
    getSelection().removeAllRanges();
    getSelection().addRange(r);
    document.execCommand('copy');
  }
  toast('Prompt copiado!');
});

$('#vEdit').addEventListener('click', () => openForm(state.currentId));
$('#vDelete').addEventListener('click', () => removeIdea(state.currentId));

function removeIdea(id) {
  const idea = store.get(id);
  if (!idea || !confirm(`Excluir a ideia "${idea.nome}"?`)) return;
  store.remove(id);
  if (viewModal.open) viewModal.close();
  render();
  toast('Ideia excluída');
}

/* ================== Explorar: filtros ================== */
$('#search').addEventListener('input', (e) => { state.query = e.target.value; render(); });
$$('.chips[data-filter]').forEach((box) => {
  const key = box.dataset.filter;
  const mk = (value, label) => el('button', { type: 'button', class: `chip${value === 'all' ? ' active' : ''}`, 'data-value': value }, label);
  box.append(mk('all', 'Todos'), ...OPTIONS[key].map((v) => mk(v, v)));
  box.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    $$('.chip', box).forEach((c) => c.classList.toggle('active', c === chip));
    state.filters[key] = chip.dataset.value;
    render();
  });
});

/* ================== Ajustes ================== */
$('#btnExport').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(store.all(), null, 2)], { type: 'application/json' });
  const a = el('a', { href: URL.createObjectURL(blob), download: `ideia-fluxo-${new Date().toISOString().slice(0, 10)}.json` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('Backup exportado');
});

$('#fileImport').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const incoming = JSON.parse(await file.text());
    if (!Array.isArray(incoming)) throw new Error();
    const valid = incoming.filter(isValid).map(normalize);
    store.merge(valid); // mescla; importado sobrescreve mesmo id
    render();
    toast(`${valid.length} ideias importadas`);
  } catch {
    toast('Arquivo inválido');
  }
  e.target.value = '';
});

$('#btnClear').addEventListener('click', () => {
  const n = store.all().length;
  if (!n) return toast('Não há ideias para apagar');
  const onde = user ? 'da sua conta (em todos os aparelhos)' : 'deste navegador';
  if (!confirm(`Apagar TODAS as ${n} ideias ${onde}? Exporte um backup antes se tiver dúvida.`)) return;
  store.clear();
  render();
  toast('Todas as ideias foram apagadas');
});

/* ================== Ações globais ================== */
$$('[data-action="new"]').forEach((b) => b.addEventListener('click', () => openForm()));
$$('[data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));
$$('dialog').forEach((d) => d.addEventListener('click', (e) => { if (e.target === d) d.close(); }));

/* ================== Conta Google ================== */
function googleIcon() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 48 48');
  svg.setAttribute('class', 'g-icon');
  const paths = [
    ['#FFC107', 'M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5'],
    ['#FF3D00', 'm6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7'],
    ['#4CAF50', 'M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44'],
    ['#1976D2', 'M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5'],
  ];
  for (const [fill, d] of paths) {
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('fill', fill);
    p.setAttribute('d', d);
    svg.append(p);
  }
  return svg;
}

function loginButton() {
  return el('button', { type: 'button', class: 'btn-google', onclick: doLogin }, googleIcon(), 'Entrar com Google');
}

function userChip() {
  const avatar = user.photoURL
    ? el('img', { src: user.photoURL, alt: '', referrerpolicy: 'no-referrer', class: 'avatar' })
    : el('span', { class: 'avatar' }, (user.displayName || user.email || '?')[0].toUpperCase());
  return el('div', { class: 'user-chip' },
    avatar,
    el('div', { class: 'user-info' },
      el('strong', {}, user.displayName || 'Conta Google'),
      el('span', {}, user.email || ''),
    ),
  );
}

function renderAccount() {
  const box = $('#accountBox');
  const panel = $('#accountPanel');
  if (!cloud) { box.replaceChildren(); return; }

  if (user) {
    box.replaceChildren(userChip(), el('button', { type: 'button', class: 'link-btn', onclick: doLogout }, 'Sair'));
    panel.replaceChildren(
      el('p', {}, 'Suas ideias estão salvas na nuvem e aparecem em qualquer aparelho em que você entrar com esta conta.'),
      userChip(),
      el('div', { class: 'settings-actions' },
        el('button', { type: 'button', class: 'btn outline', onclick: doLogout }, 'Sair da conta')),
    );
  } else {
    box.replaceChildren(el('p', { class: 'account-hint' }, 'Salve suas ideias na nuvem'), loginButton());
    panel.replaceChildren(
      el('p', {}, 'Entre com sua conta Google para salvar as ideias na nuvem e acessá-las no celular e no computador. As ideias que já estão neste aparelho serão enviadas para a sua conta.'),
      el('div', { class: 'settings-actions' }, loginButton()),
    );
  }
}

async function doLogin() {
  if (!navigator.onLine) return toast('Sem internet: conecte-se para entrar');
  try {
    await cloud.login();
  } catch (e) {
    if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') return;
    console.error(e);
    toast(e.code === 'auth/unauthorized-domain'
      ? 'Domínio não autorizado no Firebase (Authentication → Configurações)'
      : 'Não foi possível entrar. Tente de novo.');
  }
}

async function doLogout() {
  if (!confirm('Sair da conta? As ideias continuam salvas na nuvem e voltam quando você entrar de novo.')) return;
  try {
    stopWatch?.();
    await cloud.logout();
  } finally {
    location.reload(); // reinicia limpo, no modo local
  }
}

// Envia ideias que estavam só no navegador para a conta (uma única vez)
async function migrateLocalToCloud(uid) {
  const local = loadLocal();
  if (!local.length) return;
  try {
    await cloud.saveMany(uid, local);
    localStorage.removeItem(KEY);
    toast(`${plural(local.length)} deste aparelho enviadas para a nuvem`);
  } catch (e) {
    onCloudError(e); // mantém no localStorage para tentar no próximo login
  }
}

async function initCloud() {
  try {
    cloud = await import('./cloud.js');
  } catch (e) {
    console.warn('Nuvem indisponível, usando só modo local.', e);
    return;
  }
  renderAccount();
  cloud.watchAuth((u) => {
    stopWatch?.();
    stopWatch = null;
    user = u;
    if (u) {
      migrateLocalToCloud(u.uid);
      stopWatch = cloud.watchIdeas(u.uid, (docs) => {
        store.list = docs.filter(isValid).map(normalize).sort(byNewest);
        render();
      }, onCloudError);
    } else {
      store.list = loadLocal().sort(byNewest);
    }
    renderAccount();
    render();
  });
}

/* ================== PWA ================== */
let installPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e;
  $('#btnInstall').hidden = false;
});
$('#btnInstall').addEventListener('click', async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  $('#btnInstall').hidden = true;
});
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

go();
initCloud();
