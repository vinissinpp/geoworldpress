// Atualização de hora em hora: RSS dos portais → Claude escolhe e resume → data/news.json
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { fetchFeed } = require('./rss');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const STATE = path.join(DATA, 'state');
const NEWS = path.join(DATA, 'news.json');
const SEEN = path.join(STATE, 'seen.json');
const LOG = path.join(STATE, 'log.txt');
const PROMPT = path.join(__dirname, 'prompt.md');

const HORA = 36e5, DIA = 24 * HORA;
const LOTE = 350;          // manchetes por chamada ao Claude
const MAX_POR_PAIS = 3;
const MAX_FONTES = 6;
const CATS = ['eleicao', 'votacao', 'protesto', 'conflito', 'diplomacia', 'crise'];
const ALIAS = { PSE: 'PSX', SSD: 'SDS', ESH: 'SAH', XKX: 'KOS' }; // ISO oficial → código do mapa (Natural Earth)

fs.mkdirSync(STATE, { recursive: true });

function log(msg) {
  const line = `[${new Date().toLocaleString('pt-BR')}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG, line + '\n');
}
function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJson(file, data) {
  // Escreve num temporário e renomeia: o globo nunca lê um arquivo pela metade
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 1));
  fs.renameSync(tmp, file);
}

// Posição de cada país: a capital (a mais populosa, quando há várias) ou o centro do país
function carregarLugares() {
  const lugares = new Map();
  for (const f of readJson(path.join(DATA, 'paises.geojson'), { features: [] }).features) {
    lugares.set(f.properties.a3, { lat: f.properties.lat, lng: f.properties.lng, pop: -1 });
  }
  for (const c of readJson(path.join(DATA, 'capitais.json'), [])) {
    const atual = lugares.get(c.a3);
    if (!atual || c.pop > atual.pop) lugares.set(c.a3, { lat: c.lat, lng: c.lng, pop: c.pop });
  }
  return lugares;
}

async function coletar(seen) {
  const feeds = readJson(path.join(__dirname, 'feeds.json'), []);
  const agora = Date.now();
  const resultados = await Promise.allSettled(feeds.map(f => fetchFeed(f.url)));
  const manchetes = [], falhas = [], links = new Set();
  resultados.forEach((r, i) => {
    const feed = feeds[i];
    if (r.status === 'rejected') return falhas.push(feed.nome);
    for (const item of r.value) {
      if (seen[item.link] || links.has(item.link)) continue;
      if (item.publicado && agora - Date.parse(item.publicado) > DIA) continue;
      links.add(item.link);
      manchetes.push({ ...item, fonte: feed.nome, lang: feed.lang, regiao: feed.regiao });
    }
  });
  if (falhas.length) log(`Feeds com erro: ${falhas.join(', ')}`);
  manchetes.sort((a, b) => (b.publicado || '').localeCompare(a.publicado || ''));
  return manchetes;
}

// O claude não está no PATH: foi instalado pelo app desktop, que guarda o AppData numa pasta privada
function acharClaude() {
  const local = process.env.LOCALAPPDATA || '';
  const pacotes = path.join(local, 'Packages');
  const candidatos = [
    path.join(process.env.APPDATA || '', 'npm', 'claude.cmd'),
    ...(fs.existsSync(pacotes) ? fs.readdirSync(pacotes).filter(d => d.startsWith('Claude_'))
      .map(d => path.join(pacotes, d, 'LocalCache', 'Roaming', 'npm', 'claude.cmd')) : []),
    path.join(process.env.USERPROFILE || '', '.local', 'bin', 'claude.exe'),
  ];
  const achado = candidatos.find(c => fs.existsSync(c));
  return achado ? `"${achado}"` : 'claude';
}

function perguntarClaude(entrada) {
  return new Promise((resolve, reject) => {
    const claude = acharClaude();
    const cmd = `${claude} -p --model claude-haiku-5-5 --tools "" --system-prompt-file "${PROMPT}" ` +
      '--output-format json --no-session-persistence --strict-mcp-config';
    const proc = spawn(cmd, { shell: true, cwd: STATE, windowsHide: true });
    let out = '', err = '';
    const timer = setTimeout(() => { proc.kill(); reject(new Error('Claude demorou mais de 10 min')); }, 10 * 60e3);
    proc.stdout.on('data', d => out += d);
    proc.stderr.on('data', d => err += d);
    proc.on('error', reject);
    proc.on('close', code => {
      clearTimeout(timer);
      let envelope;
      try { envelope = JSON.parse(out); } catch { return reject(new Error(`Saída inválida (código ${code}): ${(err || out).slice(0, 300)}`)); }
      if (envelope.is_error) return reject(new Error('Claude: ' + String(envelope.result).slice(0, 300)));
      const texto = String(envelope.result);
      const json = texto.slice(texto.indexOf('{'), texto.lastIndexOf('}') + 1);
      try { resolve({ resposta: JSON.parse(json), custo: envelope.total_cost_usd || 0 }); } catch {
        reject(new Error('Claude não devolveu JSON: ' + texto.slice(0, 300)));
      }
    });
    proc.stdin.end(JSON.stringify(entrada));
  });
}

function aplicar(estado, resp, porH, lugares) {
  const agora = new Date().toISOString();
  const fontesDe = hs => (Array.isArray(hs) ? hs : []).map(h => porH.get(h)).filter(Boolean)
    .map(m => ({ nome: m.fonte, url: m.link, lang: m.lang, publicado: m.publicado || agora }));
  const datas = fs_ => fs_.map(f => f.publicado).sort();
  const porId = id => estado.noticias.find(n => n.id === id);
  const texto = (s, max) => String(s || '').trim().slice(0, max);

  const remover = new Set(resp.remover || []);
  estado.noticias = estado.noticias.filter(n => !remover.has(n.id));

  for (const r of resp.reforcar || []) {
    const n = porId(r.id);
    if (!n) continue;
    for (const f of fontesDe(r.fontes)) {
      if (n.fontes.length < MAX_FONTES && !n.fontes.some(x => x.url === f.url || x.nome === f.nome)) n.fontes.push(f);
    }
    if (r.rel >= 1 && r.rel <= 5) n.rel = Math.round(r.rel);
    n.atualizado = datas(n.fontes).at(-1);
  }

  const novos = [];
  for (const a of resp.adicionar || []) {
    const a3 = ALIAS[a.a3] || String(a.a3 || '').toUpperCase();
    const lugar = lugares.get(a3);
    const fontes = fontesDe(a.fontes).filter((f, i, all) => all.findIndex(x => x.nome === f.nome) === i).slice(0, MAX_FONTES);
    if (!lugar || !CATS.includes(a.cat) || !fontes.length || !a.titulo) { novos.push(null); continue; }
    if (a.substitui) estado.noticias = estado.noticias.filter(n => n.id !== a.substitui);
    const d = datas(fontes);
    const n = {
      id: 'n' + (++estado.seq), a3, pais: texto(a.pais, 40) || a3, cat: a.cat,
      rel: Math.min(5, Math.max(1, Math.round(a.rel) || 2)),
      titulo: texto(a.titulo, 110), resumo: texto(a.resumo, 260), fontes,
      lat: lugar.lat, lng: lugar.lng, publicado: d[0], atualizado: d.at(-1),
    };
    estado.noticias.push(n);
    novos.push(n.id);
  }

  // Garante o limite por país: fica com as mais relevantes e, no empate, as mais recentes
  const grupos = {};
  for (const n of estado.noticias) (grupos[n.a3] ||= []).push(n);
  estado.noticias = Object.values(grupos).flatMap(g =>
    g.sort((x, y) => y.rel - x.rel || y.atualizado.localeCompare(x.atualizado)).slice(0, MAX_POR_PAIS));

  const lances = (resp.lances || []).map(l => String(l).startsWith('+') ? novos[+String(l).slice(1)] : l);
  estado.lances = [...new Set(lances)].filter(id => id && porId(id)).slice(0, 5);
  completarLances(estado);
  return novos.filter(Boolean).length;
}

function completarLances(estado) {
  estado.lances = estado.lances.filter(id => estado.noticias.some(n => n.id === id));
  const resto = estado.noticias.filter(n => !estado.lances.includes(n.id))
    .sort((x, y) => y.rel - x.rel || y.atualizado.localeCompare(x.atualizado));
  while (estado.lances.length < 3 && resto.length) estado.lances.push(resto.shift().id);
}

async function main() {
  const lugares = carregarLugares();
  const estado = readJson(NEWS, { atualizado: null, seq: 0, lances: [], noticias: [] });
  const seen = readJson(SEEN, {});
  const agora = Date.now();

  // Tira o que passou de 24h e esquece links vistos há mais de 48h
  const antes = estado.noticias.length;
  estado.noticias = estado.noticias.filter(n => agora - Date.parse(n.atualizado) < DIA);
  for (const [k, t] of Object.entries(seen)) if (agora - t > 2 * DIA) delete seen[k];
  completarLances(estado);

  const manchetes = await coletar(seen);
  log(`${manchetes.length} manchetes novas · ${antes - estado.noticias.length} notícias expiraram`);

  let custo = 0, adicionadas = 0, seq = 0;
  for (let i = 0; i < manchetes.length; i += LOTE) {
    const lote = manchetes.slice(i, i + LOTE).map(m => ({ ...m, h: 'h' + (++seq) }));
    const porH = new Map(lote.map(m => [m.h, m]));
    const entrada = {
      agora: new Date().toISOString(),
      atuais: estado.noticias.map(({ id, a3, pais, cat, rel, titulo, atualizado }) => ({ id, a3, pais, cat, rel, titulo, atualizado })),
      manchetes: lote.map(m => ({
        h: m.h, fonte: m.fonte, lang: m.lang, regiao: m.regiao, titulo: m.titulo,
        resumo: m.resumo && m.resumo !== m.titulo ? m.resumo.slice(0, 160) : undefined, publicado: m.publicado,
      })),
    };
    try {
      const { resposta, custo: c } = await perguntarClaude(entrada);
      custo += c;
      adicionadas += aplicar(estado, resposta, porH, lugares);
      for (const m of lote) seen[m.link] = agora; // só marca como visto o que o Claude processou
    } catch (e) {
      log('ERRO no lote: ' + e.message);
    }
  }

  estado.atualizado = new Date().toISOString();
  writeJson(NEWS, estado);
  writeJson(SEEN, seen);
  const paises = new Set(estado.noticias.map(n => n.a3)).size;
  log(`OK · +${adicionadas} notícias · ${estado.noticias.length} no globo em ${paises} países · custo ≈ US$ ${custo.toFixed(3)}`);
}

// Trava: impede duas atualizações ao mesmo tempo (ex.: tarefa agendada + execução manual)
const LOCK = path.join(STATE, 'rodando.lock');
function travar() {
  try { fs.writeFileSync(LOCK, String(Date.now()), { flag: 'wx' }); return true; } catch {}
  const desde = +fs.readFileSync(LOCK, 'utf8') || 0;
  if (Date.now() - desde < 40 * 60e3) return false;
  fs.writeFileSync(LOCK, String(Date.now())); // trava esquecida por uma execução que travou
  return true;
}

if (!travar()) {
  log('Outra atualização já está rodando, esta foi pulada');
} else {
  main().catch(e => { log('ERRO: ' + e.stack); process.exitCode = 1; })
    .finally(() => fs.rmSync(LOCK, { force: true }));
}
