'use strict';

/* =====================================================================
   ORGANIZAÇÕES
   Cada tipo de ideia (kind) é descrito aqui: campos do formulário, como o
   card é exibido, filtros e o prompt gerado. Para criar uma 4ª organização,
   basta adicionar uma entrada em KINDS (e liberar os campos em firestore.rules).
   ===================================================================== */
const STATUS = ['Ideia', 'Planejamento', 'Em Progresso', 'Estudo', 'Pausado', 'Concluído'];
const PRIORIDADES = ['Alta', 'Média', 'Baixa'];
const LANG_LABEL = { 'JavaScript (Node.js)': 'JS / Node', Python: 'Python', 'Flutter (Dart)': 'Flutter' };
const COLOR_PRESETS = ['#ffffff', '#000000', '#f5ecd9', '#f6d1dc', '#cfe6f7', '#cdeedd', '#fff3b0', '#d9d0f0', '#8a1c2b', '#1f3a5f'];

const KINDS = {
  projeto: {
    label: 'Programação',
    icon: 'code',
    title: 'MINHAS IDEIAS DE PROJETOS',
    fields: [
      { key: 'nome', label: 'Nome do projeto', hint: '(z)', type: 'text', required: true, max: 120, placeholder: 'Ex.: PWA Planner' },
      { key: 'objetivo', label: 'Função / objetivo', hint: '(y)', type: 'textarea', rows: 3, required: true, max: 5000, placeholder: 'Como ele precisa funcionar?' },
      { key: 'composicao', label: 'Composição / o que precisa ter', hint: '(w)', type: 'textarea', rows: 4, required: true, max: 5000, placeholder: 'Telas, botões, seções, funcionalidades...' },
      { key: 'tipo', label: 'Tipo', type: 'segmented', options: ['App', 'Site', 'PWA'], default: 'App' },
      { key: 'linguagem', label: 'Linguagem', hint: '(x)', type: 'segmented', options: ['JavaScript (Node.js)', 'Python', 'Flutter (Dart)'], labels: LANG_LABEL, default: 'JavaScript (Node.js)' },
    ],
    filters: ['tipo', 'linguagem'],
    titleKey: 'nome',
    cardTitle: (i) => `${i.nome} (${i.tipo})`,
    cardText: (i) => i.objetivo,
    cardMeta: (i) => [LANG_LABEL[i.linguagem] || i.linguagem],
    prompt: (i) =>
      `Vamos organizar um ${i.tipo} de ${i.nome}, ` +
      `ele precisa funcionar da seguinte forma: ${i.objetivo}\n\n` +
      `Ele terá uma interface organizada estruturalmente assim: ${i.composicao}\n\n` +
      `Planejaremos na linguagem ${i.linguagem}.`,
  },

  livro: {
    label: 'Livros',
    icon: 'book',
    title: 'MINHAS IDEIAS DE LIVROS',
    fields: [
      { key: 'titulo', label: 'Título', type: 'text', required: true, max: 150, placeholder: 'Ex.: As cartas que não enviei' },
      {
        key: 'genero', label: 'Gênero', type: 'segmented',
        options: ['Poema', 'Narração 1ª pessoa', 'Narração 3ª pessoa'],
        labels: { Poema: 'Poema', 'Narração 1ª pessoa': '1ª pessoa', 'Narração 3ª pessoa': '3ª pessoa' },
        default: 'Narração 1ª pessoa',
      },
      { key: 'sinopse', label: 'Sinopse', type: 'textarea', rows: 5, required: true, max: 5000, placeholder: 'Do que a história trata?' },
      { key: 'capitulos', label: 'Número de capítulos', type: 'number', min: 0, max: 1000, placeholder: 'Ex.: 12' },
    ],
    filters: ['genero'],
    titleKey: 'titulo',
    cardTitle: (i) => i.titulo,
    cardText: (i) => i.sinopse,
    cardMeta: (i) => [i.genero, i.capitulos ? `${i.capitulos} ${i.capitulos === 1 ? 'capítulo' : 'capítulos'}` : ''],
  },

  estampa: {
    label: 'Estampas',
    icon: 'palette',
    title: 'MINHAS IDEIAS DE ESTAMPAS',
    fields: [
      {
        key: 'genero', label: 'Gênero', type: 'text', required: true, max: 60, placeholder: 'Ex.: Floral',
        suggestions: ['Floral', 'Geométrico', 'Infantil', 'Animais', 'Frases', 'Religioso', 'Abstrato', 'Vintage', 'Minimalista', 'Tropical'],
      },
      { key: 'objetos', label: 'Objeto ou objetos', type: 'text', required: true, max: 300, placeholder: 'Ex.: gato, xícara de café, folhas' },
      { key: 'descricao', label: 'Descrição', type: 'textarea', rows: 4, required: true, max: 5000, placeholder: 'Estilo, composição, clima da estampa...' },
      { key: 'cores', label: 'Variação de cor de fundo', type: 'colors', max: 20 },
    ],
    filters: ['genero'],
    titleKey: 'objetos',
    cardTitle: (i) => i.objetos,
    cardText: (i) => i.descricao,
    cardMeta: (i) => [i.genero],
    prompt: (i) =>
      `Vamos criar uma estampa do gênero ${i.genero}, com ${i.objetos}.\n\n` +
      `Descrição: ${i.descricao}\n\n` +
      (i.cores.length
        ? `Variações de cor de fundo: ${i.cores.join(', ')}.\n\n`
        : '') +
      `Sugira composição, paleta de cores para os elementos (com bom contraste em cada fundo) ` +
      `e um prompt detalhado para gerar a arte.`,
  },
};

/* ================== Helpers ================== */
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const fmtDate = (ts) => new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
const slug = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, '-');
const plural = (n) => `${n} ${n === 1 ? 'ideia' : 'ideias'}`;

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  node.append(...children.filter((c) => c !== null && c !== undefined && c !== false));
  return node; // strings viram texto → sem XSS
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
  toastTimer = setTimeout(() => (t.hidden = true), 2400);
}

/* ================== Modelo de dados ================== */
// Todo item: id, kind, prioridade, status, createdAt, updatedAt + campos do kind.
function cleanValue(f, v) {
  switch (f.type) {
    case 'number': {
      if (v === '' || v === null || v === undefined) return null;
      const n = parseInt(v, 10);
      return Number.isFinite(n) && n >= (f.min ?? 0) && n <= (f.max ?? 1e6) ? n : null;
    }
    case 'colors':
      return Array.isArray(v) ? [...new Set(v.filter((c) => /^#[0-9a-f]{6}$/i.test(c)).map((c) => c.toLowerCase()))].slice(0, f.max || 20) : [];
    case 'segmented':
      return f.options.includes(v) ? v : f.default;
    default:
      return typeof v === 'string' ? v.trim().slice(0, f.max || 5000) : '';
  }
}

// Garante formato válido. Ideias antigas (sem kind, com "categoria") viram
// projetos de prioridade Média; campos desconhecidos são descartados.
function normalize(raw) {
  const kind = KINDS[raw.kind] ? raw.kind : 'projeto';
  const out = {
    id: raw.id,
    kind,
    prioridade: PRIORIDADES.includes(raw.prioridade) ? raw.prioridade : 'Média',
    status: STATUS.includes(raw.status) ? raw.status : 'Ideia',
  };
  for (const f of KINDS[kind].fields) out[f.key] = cleanValue(f, raw[f.key]);
  out.createdAt = Math.trunc(Number(raw.createdAt) || Date.now());
  out.updatedAt = Math.trunc(Number(raw.updatedAt) || out.createdAt);
  return out;
}
const isValid = (i) => KINDS[i.kind].fields.every((f) => !f.required || i[f.key]);
const prepare = (list) =>
  (Array.isArray(list) ? list : [])
    .filter((r) => r && typeof r === 'object' && typeof r.id === 'string' && r.id)
    .map(normalize)
    .filter(isValid);
const byNewest = (a, b) => b.createdAt - a.createdAt;

/* ================== Storage ================== */
// Dois modos:
//  - local: sem login, ideias no localStorage deste navegador
//  - cloud: logado com Google, ideias no Firestore (sincroniza entre aparelhos)
// A UI sempre lê de store.list (memória); quem muda é para onde as escritas vão.
const KEY = 'ideias:v1';

function loadLocal() {
  try { return prepare(JSON.parse(localStorage.getItem(KEY))); }
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
  all() { return this.list; },
  ofKind(kind) { return this.list.filter((i) => i.kind === kind); },
  get(id) { return this.list.find((x) => x.id === id); },
  persistLocal() { if (!user) localStorage.setItem(KEY, JSON.stringify(this.list)); },

  upsert(idea) {
    idea = normalize(idea);
    const i = this.list.findIndex((x) => x.id === idea.id);
    if (i >= 0) this.list[i] = idea; else this.list.unshift(idea);
    this.list.sort(byNewest);
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

/* ================== Estado ================== */
const MODE_KEY = 'ideias:kind';
const state = {
  view: 'inicio',
  kind: KINDS[localStorage.getItem(MODE_KEY)] ? localStorage.getItem(MODE_KEY) : 'projeto',
  query: '',
  filters: {},
  currentId: null,
};

const VIEWS = {
  inicio: (K) => K.title,
  explorar: (K) => `EXPLORAR · ${K.label.toUpperCase()}`,
  dashboard: (K) => `DASHBOARD · ${K.label.toUpperCase()}`,
  ajustes: () => 'AJUSTES',
};

function setKind(kind) {
  if (!KINDS[kind] || kind === state.kind) { closeDrawer(); return; }
  state.kind = kind;
  state.filters = {};
  state.query = '';
  $('#search').value = '';
  localStorage.setItem(MODE_KEY, kind);
  closeDrawer();
  if (state.view === 'ajustes') location.hash = '#inicio';
  else { window.scrollTo(0, 0); render(); }
}

/* ================== Agrupamento por data ================== */
function dateGroup(ts) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const DAY = 864e5;
  if (ts >= today) return 'Hoje';
  if (ts >= today - DAY) return 'Ontem';
  if (ts >= today - 6 * DAY) return 'Últimos 7 dias';
  const label = new Date(ts).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function renderGrouped(container, list) {
  const groups = new Map();
  for (const idea of list) {
    const g = dateGroup(idea.createdAt);
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(idea);
  }
  container.replaceChildren(...[...groups].map(([label, items]) =>
    el('section', { class: 'date-group' },
      el('h2', { class: 'date-label' }, label, el('span', {}, String(items.length))),
      el('div', { class: 'grid' }, ...items.map(card)),
    )));
}

/* ================== Componentes ================== */
const prioBadge = (p) => el('span', { class: `prio p-${slug(p)}` }, icon('flag'), p);
const statusPill = (s) => el('span', { class: `status s-${slug(s)}` }, s);
const swatches = (cores, withLabels = false) =>
  el('div', { class: `swatches${withLabels ? ' labeled' : ''}` },
    ...cores.map((c) => {
      const sw = el('span', { class: 'swatch', title: c });
      sw.style.background = c;
      return withLabels ? el('span', { class: 'swatch-item' }, sw, c) : sw;
    }));

function card(idea) {
  const K = KINDS[idea.kind];
  const stop = (fn) => (e) => { e.stopPropagation(); fn(); };
  const meta = K.cardMeta(idea).filter(Boolean);
  return el('article', {
      class: 'card', tabindex: '0',
      onclick: () => openView(idea.id),
      onkeydown: (e) => { if (e.key === 'Enter') openView(idea.id); },
    },
    el('div', { class: 'card-body' },
      el('h3', {}, K.cardTitle(idea)),
      el('div', { class: 'card-tags' }, prioBadge(idea.prioridade), ...meta.map((m) => el('span', { class: 'badge' }, m))),
      el('p', { class: 'card-desc' }, K.cardText(idea)),
      idea.kind === 'estampa' && idea.cores.length ? swatches(idea.cores) : null,
      el('div', { class: 'card-foot-row' }, statusPill(idea.status), el('span', { class: 'date' }, fmtDate(idea.createdAt))),
    ),
    el('div', { class: 'card-actions' },
      el('button', { title: 'Editar', 'aria-label': `Editar ${K.cardTitle(idea)}`, onclick: stop(() => openForm(idea.id)) }, icon('edit')),
      el('button', { title: 'Excluir', 'aria-label': `Excluir ${K.cardTitle(idea)}`, onclick: stop(() => removeIdea(idea.id)) }, icon('trash')),
    ),
  );
}

/* ================== Navegação entre organizações ================== */
function renderKindNav() {
  const counts = Object.fromEntries(Object.keys(KINDS).map((k) => [k, 0]));
  store.all().forEach((i) => counts[i.kind]++);
  const item = (k, compact) => el('button', {
      type: 'button',
      class: `kind-item${k === state.kind ? ' active' : ''}`,
      'aria-pressed': String(k === state.kind),
      onclick: () => setKind(k),
    },
    icon(KINDS[k].icon),
    el('span', { class: 'kind-label' }, KINDS[k].label),
    compact ? null : el('span', { class: 'kind-count' }, String(counts[k])),
  );
  $('#kindNav').replaceChildren(...Object.keys(KINDS).map((k) => item(k, false)));
  $('#kindTabs').replaceChildren(...Object.keys(KINDS).map((k) => item(k, true)));
}

/* ================== Render ================== */
function render() {
  const K = KINDS[state.kind];
  const list = store.ofKind(state.kind);
  const sync = user ? ' · ☁ salvas na nuvem' : ' · salvas neste aparelho';

  renderKindNav();
  $('#kindTabs').hidden = state.view === 'ajustes';
  $('#viewTitle').textContent = VIEWS[state.view](K);
  $('#viewSubtitle').textContent = state.view === 'ajustes'
    ? `Total: ${plural(store.all().length)}${sync}`
    : `${K.label}: ${plural(list.length)}${sync}`;

  if (state.view === 'inicio') {
    renderGrouped($('#gridHome'), list);
    $('#emptyHome').hidden = list.length > 0;
    $('#emptyKind').textContent = K.label.toLowerCase();
  }

  if (state.view === 'explorar') {
    renderFilters(list);
    const q = state.query.trim().toLowerCase();
    const textKeys = K.fields.filter((f) => ['text', 'textarea'].includes(f.type)).map((f) => f.key);
    const result = list.filter((i) =>
      Object.entries(state.filters).every(([k, v]) => v === 'all' || i[k] === v) &&
      (!q || textKeys.map((k) => i[k]).join(' ').toLowerCase().includes(q))
    );
    renderGrouped($('#gridExplore'), result);
    $('#emptyExplore').hidden = result.length > 0;
    $('#viewSubtitle').textContent = `${plural(result.length)} de ${list.length}${sync}`;
  }

  if (state.view === 'dashboard') renderDashboard(list);
}

/* ================== Explorar: filtros ================== */
function filterDefs(list) {
  const K = KINDS[state.kind];
  const defs = K.fields
    .filter((f) => K.filters.includes(f.key))
    .map((f) => ({
      key: f.key,
      label: f.label,
      labels: f.labels,
      // campos livres (ex.: gênero da estampa) usam os valores já cadastrados
      options: f.options || [...new Set(list.map((i) => i[f.key]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    }))
    .filter((d) => d.options.length);
  return [...defs,
    { key: 'prioridade', label: 'Prioridade', options: PRIORIDADES },
    { key: 'status', label: 'Status', options: STATUS }];
}

function renderFilters(list) {
  $('#filterRows').replaceChildren(...filterDefs(list).map((d) => {
    const active = state.filters[d.key] || 'all';
    const chip = (value, text) => el('button', {
      type: 'button',
      class: `chip${value === active ? ' active' : ''}`,
      onclick: () => { state.filters[d.key] = value; render(); },
    }, text);
    return el('div', { class: 'filter-row' },
      el('span', {}, d.label),
      el('div', { class: 'chips' }, chip('all', 'Todos'), ...d.options.map((o) => chip(o, d.labels?.[o] || o))),
    );
  }));
}

/* ================== Dashboard ================== */
function renderDashboard(list) {
  const count = (k, v) => list.filter((i) => i[k] === v).length;
  const ativos = list.filter((i) => ['Planejamento', 'Em Progresso'].includes(i.status)).length;
  const tiles = [
    [list.length, 'Total de ideias'],
    [count('prioridade', 'Alta'), 'Prioridade alta'],
    [ativos, 'Em andamento'],
    [count('status', 'Concluído'), 'Concluídas'],
  ];
  $('#stats').replaceChildren(...tiles.map(([n, l]) => el('div', { class: 'stat' }, el('b', {}, String(n)), el('span', {}, l))));

  const group = (title, key, options, labels) => {
    const max = Math.max(1, ...options.map((v) => count(key, v)));
    return el('div', { class: 'panel' },
      el('h2', {}, title),
      ...options.map((v) => {
        const n = count(key, v);
        const bar = el('i');
        bar.style.width = `${(n / max) * 100}%`;
        return el('div', { class: 'bar-row' }, el('span', {}, labels?.[v] || v), el('div', { class: 'bar' }, bar), el('b', {}, String(n)));
      }),
    );
  };
  $('#dashGroups').replaceChildren(
    ...filterDefs(list).map((d) => group(`Por ${d.label.toLowerCase()}`, d.key, d.options, d.labels)),
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

/* ================== Formulário (montado a partir de KINDS) ================== */
const formModal = $('#formModal');
const form = $('#ideaForm');
let formColors = [];

$('[name=prioridade]', form).append(...PRIORIDADES.map((v) => el('option', { value: v }, v)));
$('[name=status]', form).append(...STATUS.map((v) => el('option', { value: v }, v)));

function fieldLabel(f) {
  return [f.label, f.hint ? el('em', {}, ` ${f.hint}`) : null, f.required || f.type === 'segmented' ? null : el('em', {}, ' (opcional)')];
}

function buildField(f, value) {
  const name = `f_${f.key}`;
  switch (f.type) {
    case 'textarea':
      return el('label', { class: 'field' },
        el('span', {}, ...fieldLabel(f)),
        Object.assign(el('textarea', { name, rows: f.rows || 3, maxlength: f.max, placeholder: f.placeholder }), { value: value || '' }));
    case 'number':
      return el('label', { class: 'field field-small' },
        el('span', {}, ...fieldLabel(f)),
        Object.assign(el('input', { name, type: 'number', inputmode: 'numeric', min: f.min, max: f.max, placeholder: f.placeholder }), { value: value ?? '' }));
    case 'segmented':
      return el('fieldset', { class: 'field' },
        el('legend', {}, ...fieldLabel(f)),
        el('div', { class: 'segmented' }, ...f.options.map((o) => {
          const input = el('input', { type: 'radio', name, value: o });
          input.checked = o === (value || f.default);
          return el('label', {}, input, el('span', {}, f.labels?.[o] || o));
        })));
    case 'colors':
      formColors = [...(value || [])];
      return el('fieldset', { class: 'field' },
        el('legend', {}, ...fieldLabel(f)),
        el('div', { class: 'colors-box', id: 'colorsBox' }));
    default: {
      const listId = f.suggestions ? `dl_${f.key}` : undefined;
      return el('label', { class: 'field' },
        el('span', {}, ...fieldLabel(f)),
        Object.assign(el('input', { name, maxlength: f.max, placeholder: f.placeholder, list: listId, autocomplete: 'off' }), { value: value || '' }),
        f.suggestions ? el('datalist', { id: listId }, ...f.suggestions.map((s) => el('option', { value: s }))) : null);
    }
  }
}

function renderColors() {
  const box = $('#colorsBox');
  if (!box) return;
  const max = KINDS.estampa.fields.find((f) => f.type === 'colors').max;
  const add = (c) => {
    c = c.toLowerCase();
    if (formColors.includes(c)) return;
    if (formColors.length >= max) return toast(`Máximo de ${max} cores`);
    formColors.push(c);
    renderColors();
  };
  const picker = el('input', { type: 'color', value: '#cfe6f7', 'aria-label': 'Escolher cor' });
  picker.addEventListener('change', () => add(picker.value));

  box.replaceChildren(
    el('div', { class: 'chosen' },
      ...(formColors.length
        ? formColors.map((c, idx) => {
            const sw = el('span', { class: 'swatch' });
            sw.style.background = c;
            return el('span', { class: 'color-chip' }, sw, c,
              el('button', {
                type: 'button', class: 'chip-x', 'aria-label': `Remover ${c}`,
                onclick: () => { formColors.splice(idx, 1); renderColors(); },
              }, '×'));
          })
        : [el('span', { class: 'muted' }, 'Nenhuma cor escolhida')]),
    ),
    el('div', { class: 'presets' },
      el('span', { class: 'muted' }, 'Toque para adicionar:'),
      ...COLOR_PRESETS.map((c) => {
        const b = el('button', { type: 'button', class: 'swatch preset', title: c, 'aria-label': `Adicionar ${c}`, onclick: () => add(c) });
        b.style.background = c;
        return b;
      }),
      el('label', { class: 'color-more', title: 'Outra cor' }, picker, '+ outra cor'),
    ),
  );
}

function openForm(id) {
  const idea = id ? store.get(id) : null;
  const kind = idea ? idea.kind : state.kind;
  const K = KINDS[kind];
  form.reset();
  formColors = [];
  $('#formError').hidden = true;
  $('#formTitle').textContent = `${idea ? 'Editar' : 'Nova'} ideia · ${K.label}`;
  form.id.value = idea?.id || '';
  form.kind.value = kind;
  $('#formFields').replaceChildren(...K.fields.map((f) => buildField(f, idea?.[f.key])));
  renderColors();
  form.prioridade.value = idea?.prioridade || 'Média';
  form.status.value = idea?.status || 'Ideia';
  closeDrawer();
  if (viewModal.open) viewModal.close();
  formModal.showModal();
  $('#formFields input, #formFields textarea')?.focus();
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const kind = form.kind.value;
  const K = KINDS[kind];
  const data = { kind, prioridade: form.prioridade.value, status: form.status.value };
  for (const f of K.fields) {
    const name = `f_${f.key}`;
    if (f.type === 'colors') data[f.key] = formColors;
    else if (f.type === 'segmented') data[f.key] = form.querySelector(`[name="${name}"]:checked`)?.value;
    else data[f.key] = form.elements[name].value;
  }
  const missing = K.fields.filter((f) => f.required && !String(data[f.key] || '').trim());
  if (missing.length) {
    $('#formError').textContent = `Preencha: ${missing.map((f) => f.label.toLowerCase()).join(', ')}.`;
    $('#formError').hidden = false;
    return;
  }
  const prev = form.id.value ? store.get(form.id.value) : null;
  const now = Date.now();
  store.upsert({ ...data, id: prev?.id || uid(), createdAt: prev?.createdAt || now, updatedAt: now });
  formModal.close();
  render();
  toast(prev ? 'Ideia atualizada' : 'Ideia salva');
});

/* ================== Visualização ================== */
const viewModal = $('#viewModal');

function displayValue(f, v) {
  if (f.type === 'colors') return v.length ? swatches(v, true) : el('p', {}, '—');
  if (f.type === 'number') return el('p', {}, v ?? '—');
  return el('p', {}, v || '—');
}

function openView(id) {
  const idea = store.get(id);
  if (!idea) return;
  const K = KINDS[idea.kind];
  state.currentId = id;
  $('#vNome').textContent = K.cardTitle(idea);
  $('#vTags').replaceChildren(prioBadge(idea.prioridade), statusPill(idea.status), el('span', { class: 'badge' }, K.label));

  const shown = K.fields.filter((f) => f.key !== K.titleKey); // título já está no cabeçalho
  const block = shown.filter((f) => ['textarea', 'colors'].includes(f.type));
  const inline = shown.filter((f) => !block.includes(f));
  $('#vDetails').replaceChildren(
    el('div', { class: 'detail inline' },
      ...inline.map((f) => el('div', {}, el('h3', {}, f.label), displayValue(f, idea[f.key]))),
      el('div', {}, el('h3', {}, 'Criada em'), el('p', {}, fmtDate(idea.createdAt))),
    ),
    ...block.map((f) => el('div', { class: 'detail' }, el('h3', {}, f.label), displayValue(f, idea[f.key]))),
  );
  $('#promptBox').hidden = true;
  $('#btnPrompt').hidden = !K.prompt; // livros não geram prompt
  viewModal.showModal();
}

$('#btnPrompt').addEventListener('click', () => {
  const idea = store.get(state.currentId);
  $('#promptText').textContent = KINDS[idea.kind].prompt(idea);
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
  if (!idea || !confirm(`Excluir a ideia "${KINDS[idea.kind].cardTitle(idea)}"?`)) return;
  store.remove(id);
  if (viewModal.open) viewModal.close();
  render();
  toast('Ideia excluída');
}

/* ================== Explorar: busca ================== */
$('#search').addEventListener('input', (e) => { state.query = e.target.value; render(); });

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
    const valid = prepare(incoming);
    store.merge(valid); // mescla; importado sobrescreve mesmo id
    render();
    toast(`${plural(valid.length)} importadas`);
  } catch {
    toast('Arquivo inválido');
  }
  e.target.value = '';
});

$('#btnClear').addEventListener('click', () => {
  const n = store.all().length;
  if (!n) return toast('Não há ideias para apagar');
  const onde = user ? 'da sua conta (em todos os aparelhos)' : 'deste navegador';
  if (!confirm(`Apagar TODAS as ${n} ideias (programação, livros e estampas) ${onde}? Exporte um backup antes se tiver dúvida.`)) return;
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
        store.list = prepare(docs).sort(byNewest);
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
