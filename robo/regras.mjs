/* Regras dos lembretes: decide o que avisar para cada pessoa, só o que ainda não foi registrado */
const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
const TREINO_MIN = { manha: 6 * 60 + 30, almoco: 11 * 60 + 30, tarde: 16 * 60, noite: 18 * 60 + 30 };

export function horaLocal(agora, tz) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: tz || 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short'
  }).formatToParts(agora).map(x => [x.type, x.value]));
  const wd = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[p.weekday];
  return { dia: `${p.year}-${p.month}-${p.day}`, min: (+p.hour) * 60 + (+p.minute), semana: DIAS[wd] };
}

const fmtL = ml => { ml = Math.round(ml || 0); return ml >= 1000 ? String(Math.round(ml / 100) / 10).replace('.', ',') + ' L' : ml + ' ml'; };

export function lembretesDevidos(doc, agora) {
  if (!doc || !doc.sub || !doc.sub.endpoint) return [];
  const L = horaLocal(agora, doc.tz);
  const prefs = Object.assign({ agua: true, creatina: true, vacuo: true, treino: true, whey: true, checkin: true }, doc.prefs || {});
  const st0 = doc.status || {};
  const hoje = st0.day === L.dia;               // se o app não foi aberto hoje, nada foi registrado
  const st = {
    aguaMl: hoje ? (st0.aguaMl || 0) : 0, meta: st0.meta || 2000,
    supps: hoje ? (st0.supps || {}) : {}, en: st0.en || {},
    checkin: hoje ? !!st0.checkin : false, trained: hoje ? !!st0.trained : false
  };
  const treinosHoje = (st0.sched || {})[L.semana] || [];
  const enviados = doc.sent || {};
  const tMin = TREINO_MIN[doc.treinoHora] || TREINO_MIN.manha;
  const regras = [
    { k: 'vacuo', de: 8 * 60, ate: 11 * 60, ok: prefs.vacuo && st.en.vacuo && !st.supps.vacuo,
      t: '🌬️ Vácuo abdominal', b: 'Bom dia! Já fez o vácuo em jejum? Se já fez, marca no app ✓', u: './?go=hoje' },
    { k: 'treino', de: tMin, ate: tMin + 180, ok: prefs.treino && treinosHoje.length > 0 && !st.trained,
      t: '🏋️ Hoje é dia de ' + treinosHoje.join(' + '),
      b: 'Bora? 💪' + (st.en.pre && !st.supps.pre ? ' Lembra do pré-treino uns 30 min antes.' : ''), u: './?go=treinos' },
    { k: 'creatina', de: 10 * 60, ate: 14 * 60, ok: prefs.creatina && st.en.creatina && !st.supps.creatina,
      t: '💊 Creatina', b: 'Você ainda não marcou a creatina hoje. Já tomou?', u: './?go=hoje' },
    { k: 'whey', de: 7 * 60, ate: 22 * 60, ok: prefs.whey && st.en.whey && st.trained && !st.supps.whey,
      t: '🥤 Whey pós-treino', b: 'Treino registrado! 🔥 Já tomou o whey?', u: './?go=hoje' },
    { k: 'agua11', de: 11 * 60, ate: 14 * 60, ok: prefs.agua && st.aguaMl < st.meta * 0.25,
      t: '💧 Hora da água', b: `Até agora: ${fmtL(st.aguaMl)} de ${fmtL(st.meta)}. Bora um copo?`, u: './?go=hoje' },
    { k: 'agua15', de: 15 * 60, ate: 18 * 60, ok: prefs.agua && st.aguaMl < st.meta * 0.5,
      t: '💧 Água', b: `Você está com ${fmtL(st.aguaMl)} de ${fmtL(st.meta)} hoje. Que tal encher a garrafa?`, u: './?go=hoje' },
    { k: 'agua19', de: 19 * 60, ate: 21 * 60, ok: prefs.agua && st.aguaMl < st.meta * 0.75,
      t: '💧 Ainda dá tempo', b: `Faltam ${fmtL(st.meta - st.aguaMl)} pra sua meta de água hoje.`, u: './?go=hoje' },
    { k: 'creatina2', de: 20 * 60, ate: 23 * 60, ok: prefs.creatina && st.en.creatina && !st.supps.creatina,
      t: '💊 Último lembrete da creatina', b: 'Ela funciona pela constância. Toma antes de dormir? 💪', u: './?go=hoje' },
    { k: 'checkin', de: 20 * 60 + 30, ate: 23 * 60 + 30, ok: prefs.checkin && !st.checkin,
      t: '📝 Como foi seu dia?', b: 'Faz o check-in em 1 minuto. Pode ser falando 🎙️', u: './?go=checkin' }
  ];
  return regras.filter(r => r.ok && L.min >= r.de && L.min < r.ate && enviados[r.k] !== L.dia)
    .map(r => ({ chave: r.k, title: r.t, body: r.b, url: r.u, dia: L.dia }));
}

/* junta vários lembretes do mesmo horário numa notificação só, pra não encher o celular */
export function montarNotificacao(devidos) {
  if (devidos.length === 1) { const d = devidos[0]; return { title: d.title, body: d.body, url: d.url, tag: d.chave }; }
  return { title: 'Meu Treino: ' + devidos.length + ' lembretes', body: devidos.map(d => d.title).join('\n'), url: devidos.some(d => d.url.includes('checkin')) ? './?go=checkin' : './?go=hoje', tag: 'varios' };
}
