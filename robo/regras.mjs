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

const PADRAO = { vacuo: '08:00', creatina: '10:00', pre: '06:00', treino: '06:30', whey: '08:30', checkin: '20:30' };
const hm = v => { const m = /^(\d{1,2}):(\d{2})$/.exec(v || ''); return m ? (+m[1]) * 60 + (+m[2]) : null; };
const JANELA = 150; // o lembrete pode sair até 2h30 depois do horário escolhido (se o agendador do GitHub atrasar)

export function lembretesDevidos(doc, agora) {
  if (!doc || !doc.sub || !doc.sub.endpoint) return [];
  const L = horaLocal(agora, doc.tz);
  const prefs = Object.assign({ agua: true, creatina: true, vacuo: true, pre: true, treino: true, whey: true, checkin: true }, doc.prefs || {});
  const st0 = doc.status || {};
  const hoje = st0.day === L.dia;               // se o app não foi aberto hoje, nada foi registrado
  const st = {
    aguaMl: hoje ? (st0.aguaMl || 0) : 0, meta: st0.meta || 2000,
    supps: hoje ? (st0.supps || {}) : {}, en: st0.en || {},
    checkin: hoje ? !!st0.checkin : false, trained: hoje ? !!st0.trained : false
  };
  const sched = st0.sched || {};
  const treinosHoje = sched[L.semana] || [];
  // dia de treino: tem treino marcado pra hoje; se a pessoa não marcou dias, vale de segunda a sexta
  const diaDeTreino = treinosHoje.length > 0 || (Object.keys(sched).length === 0 && !['sab', 'dom'].includes(L.semana));
  const enviados = doc.sent || {};
  const legado = TREINO_MIN[doc.treinoHora];
  const T = k => {
    const t = hm((doc.times || {})[k]);
    if (t != null) return t;
    if (legado != null && k === 'treino') return legado;
    if (legado != null && k === 'pre') return legado - 30;
    return hm(PADRAO[k]);
  };
  const em = (k, ok, t, b, u) => ({ k, de: T(k), ate: T(k) + JANELA, ok, t, b, u });
  const regras = [
    em('vacuo', prefs.vacuo && st.en.vacuo && !st.supps.vacuo, '🌬️ Vácuo abdominal', 'Já fez o vácuo hoje? Se já fez, marca no app ✓', './?go=hoje'),
    em('creatina', prefs.creatina && st.en.creatina && !st.supps.creatina, '💊 Creatina', 'Hora da creatina! Se já tomou, marca no app ✓', './?go=hoje'),
    em('pre', prefs.pre && st.en.pre && !st.supps.pre && diaDeTreino && !st.trained, '⚡ Pré-treino', 'Hora do pré-treino pra chegar com energia no treino 💪', './?go=hoje'),
    em('treino', prefs.treino && diaDeTreino && !st.trained, treinosHoje.length ? '🏋️ Hoje é dia de ' + treinosHoje.join(' + ') : '🏋️ Hora do treino', 'Bora? 💪', './?go=treinos'),
    em('whey', prefs.whey && st.en.whey && !st.supps.whey && (diaDeTreino || st.trained), '🥤 Whey', 'Já tomou o whey hoje? Se já tomou, marca no app ✓', './?go=hoje'),
    { k: 'agua11', de: 11 * 60, ate: 14 * 60, ok: prefs.agua && st.aguaMl < st.meta * 0.25,
      t: '💧 Hora da água', b: `Até agora: ${fmtL(st.aguaMl)} de ${fmtL(st.meta)}. Bora um copo?`, u: './?go=hoje' },
    { k: 'agua15', de: 15 * 60, ate: 18 * 60, ok: prefs.agua && st.aguaMl < st.meta * 0.5,
      t: '💧 Água', b: `Você está com ${fmtL(st.aguaMl)} de ${fmtL(st.meta)} hoje. Que tal encher a garrafa?`, u: './?go=hoje' },
    { k: 'agua19', de: 19 * 60, ate: 21 * 60, ok: prefs.agua && st.aguaMl < st.meta * 0.75,
      t: '💧 Ainda dá tempo', b: `Faltam ${fmtL(st.meta - st.aguaMl)} pra sua meta de água hoje.`, u: './?go=hoje' },
    { k: 'creatina2', de: 21 * 60, ate: 23 * 60, ok: prefs.creatina && st.en.creatina && !st.supps.creatina && T('creatina') <= 19 * 60,
      t: '💊 Último lembrete da creatina', b: 'Ela funciona pela constância. Toma antes de dormir? 💪', u: './?go=hoje' },
    em('checkin', prefs.checkin && !st.checkin, '📝 Como foi seu dia?', 'Faz o check-in em 1 minuto. Pode ser falando 🎙️', './?go=checkin')
  ];
  return regras.filter(r => r.ok && L.min >= r.de && L.min < r.ate && enviados[r.k] !== L.dia)
    .map(r => ({ chave: r.k, title: r.t, body: r.b, url: r.u, dia: L.dia }));
}

/* junta vários lembretes do mesmo horário numa notificação só, pra não encher o celular */
export function montarNotificacao(devidos) {
  if (devidos.length === 1) { const d = devidos[0]; return { title: d.title, body: d.body, url: d.url, tag: d.chave }; }
  return { title: 'Meu Treino: ' + devidos.length + ' lembretes', body: devidos.map(d => d.title).join('\n'), url: devidos.some(d => d.url.includes('checkin')) ? './?go=checkin' : './?go=hoje', tag: 'varios' };
}
