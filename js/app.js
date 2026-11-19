/* =========================================================
   산도와 웅교의 NBA 데이트 — app
   - 첫 화면: 산도(돈치치) vs 웅교(커리) 매치업
   - 입장하면 실시간 스코어보드 + 문자중계 + 채팅방이 메인
   - 탭: 채팅 / 레이커스 / 워리어스 / 맞대결
   - 데이터: js/data.js (ESPN 2026-11-19 09:15 KST 스냅샷)
   ========================================================= */
(function () {
  'use strict';

  var D = window.NBA_DATA;
  var SB = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard';
  var SUM = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=';
  var NAVER = 'https://m.sports.naver.com/basketball/index';
  var POLL_MS = 25000;

  var PROFILES = {
    sando: { key: 'sando', name: '산도', team: 'lal', emoji: '🟣', initial: '산', cls: 'is-sando', fan: 'LA 레이커스 팬', other: 'woonggyo' },
    woonggyo: { key: 'woonggyo', name: '웅교', team: 'gs', emoji: '🔵', initial: '웅', cls: 'is-woonggyo', fan: '골든스테이트 팬', other: 'sando' }
  };

  var TEAM = {
    lal: { key: 'lal', name: '레이커스', full: 'LA 레이커스', en: 'Los Angeles Lakers', abbr: 'LAL', logo: 'assets/lal.png', profile: 'sando', owner: '산도' },
    gs: { key: 'gs', name: '워리어스', full: '골든스테이트 워리어스', en: 'Golden State Warriors', abbr: 'GS', logo: 'assets/gs.png', profile: 'woonggyo', owner: '웅교' }
  };

  var ABBR_KO = {
    ATL: '애틀랜타', BOS: '보스턴', BKN: '브루클린', CHA: '샬럿', CHI: '시카고', CLE: '클리블랜드',
    DAL: '댈러스', DEN: '덴버', DET: '디트로이트', GS: '골든스테이트', HOU: '휴스턴', IND: '인디애나',
    LAC: '클리퍼스', LAL: '레이커스', MEM: '멤피스', MIA: '마이애미', MIL: '밀워키', MIN: '미네소타',
    NO: '뉴올리언스', NY: '뉴욕', OKC: '오클라호마시티', ORL: '올랜도', PHI: '필라델피아', PHX: '피닉스',
    POR: '포틀랜드', SAC: '새크라멘토', SA: '샌안토니오', TOR: '토론토', UTAH: '유타', WSH: '워싱턴'
  };

  var GAMES = [
    { id: D.teams.gs.nextGame.id, team: 'gs', opp: D.teams.gs.nextGame.opp, ha: D.teams.gs.nextGame.ha, time: D.teams.gs.nextGame.time, date: D.teams.gs.nextGame.date, iso: D.teams.gs.nextGame.iso },
    { id: D.teams.lal.nextGame.id, team: 'lal', opp: D.teams.lal.nextGame.opp, ha: D.teams.lal.nextGame.ha, time: D.teams.lal.nextGame.time, date: D.teams.lal.nextGame.date, iso: D.teams.lal.nextGame.iso }
  ];

  /* ---------------- 저장소 ---------------- */
  var K = { profile: 'nbadata.profile', chat: 'nbadata.chat', picks: 'nbadata.picks', tab: 'nbadata.tab' };
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} },
    json: function (k, fb) {
      var raw = store.get(k);
      if (!raw) return fb;
      try { return JSON.parse(raw); } catch (e) { return fb; }
    }
  };

  /* ---------------- 상태 ---------------- */
  var state = {
    profile: store.get(K.profile),
    tab: 'chat',
    live: {},
    pbp: {},
    pbpGame: GAMES[0].id,
    pbpOpen: false,
    online: false,
    attempted: false,
    updated: null,
    polling: false,
    modal: null
  };
  if (!PROFILES[state.profile]) state.profile = null;

  /* ---------------- 유틸 ---------------- */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function hhmm(d) {
    var h = d.getHours(), m = d.getMinutes();
    var ap = h < 12 ? '오전' : '오후';
    var hh = h % 12 || 12;
    return ap + ' ' + hh + ':' + (m < 10 ? '0' + m : m);
  }
  function timeText(iso) {
    try { return hhmm(new Date(iso)); } catch (e) { return ''; }
  }
  function oppLogo(abbr) {
    if (abbr === 'LAL') return 'assets/lal.png';
    if (abbr === 'GS') return 'assets/gs.png';
    return 'assets/opp/' + abbr.toLowerCase() + '.png';
  }
  function ko(abbr) { return ABBR_KO[abbr] || abbr; }
  function todayLabel() {
    var d = new Date();
    var w = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
    return (d.getMonth() + 1) + '월 ' + d.getDate() + '일 (' + w + ')';
  }
  function curProfile() { return state.profile ? PROFILES[state.profile] : null; }
  function el(id) { return document.getElementById(id); }

  /* ---------------- 채팅 데이터 ---------------- */
  function seedChat() {
    var base = new Date();
    base.setHours(8, 42, 0, 0);
    function at(min) { return new Date(base.getTime() + min * 60000).toISOString(); }
    return [
      { id: 'seed1', who: 'woonggyo', type: 'text', at: at(0), text: '커리 없는 동안이 진짜 시험대네 ㅋㅋ 오늘 댈러스 원정 어떻게 버티나 보자' },
      { id: 'seed2', who: 'sando', type: 'text', at: at(5), text: '돈치치 어제 샬럿전 연장까지 뛰고 36점 7어시 찍었는데 오늘 유타전도 나온다 ㅋㅋ 9연승 간다' },
      { id: 'seed3', who: 'woonggyo', type: 'text', at: at(11), text: '레이커스 13-2인 건 인정. 근데 우리랑 상대전적 1-1인 거 알지? 1월에 체이스에서 보자' }
    ];
  }
  function getChat() {
    var v = store.json(K.chat, null);
    if (Array.isArray(v) && v.length) return v;
    var seeded = seedChat();
    store.set(K.chat, JSON.stringify(seeded));
    return seeded;
  }
  function saveChat(list) { store.set(K.chat, JSON.stringify(list.slice(-300))); }
  function pushMessage(msg) {
    var list = getChat();
    list.push(msg);
    saveChat(list);
    return list;
  }
  function getPicks() { return store.json(K.picks, {}); }
  function savePicks(p) { store.set(K.picks, JSON.stringify(p)); }

  function postPick(game, pickAbbr) {
    var p = getPicks();
    p[game.id] = p[game.id] || {};
    p[game.id][state.profile] = { team: pickAbbr, at: Date.now() };
    savePicks(p);
    var t = TEAM[game.team];
    var oppName = ko(game.opp);
    var winName = pickAbbr === t.abbr ? t.full : oppName;
    pushMessage({
      id: 'p' + Date.now(), who: state.profile, type: 'pick', at: new Date().toISOString(),
      pick: pickAbbr, team: game.team, opp: game.opp,
      text: t.name + ' vs ' + oppName + ' · ' + winName + ' 승 예측'
    });
    renderTimeline();
  }

  /* ---------------- 실시간 데이터 ---------------- */
  function parseEvent(e, game) {
    var c = e.competitions && e.competitions[0];
    if (!c) return null;
    var mine = null, other = null;
    (c.competitors || []).forEach(function (x) {
      var ab = x.team && x.team.abbreviation;
      if (ab === TEAM[game.team].abbr) mine = x; else other = x;
    });
    if (!mine || !other) return null;
    var st = c.status || {};
    var t = st.type || {};
    var stateName = t.state || 'pre'; // pre | in | post
    var clock = st.displayClock || '';
    var period = st.period || 0;
    var periodLabel = '';
    if (t.name === 'STATUS_HALFTIME') periodLabel = '하프타임';
    else if (period > 4) periodLabel = '연장';
    else if (period > 0) periodLabel = period + '쿼터';
    var situation = c.situation || null;
    return {
      state: stateName,
      statusName: t.name || '',
      detail: t.shortDetail || t.detail || '',
      periodLabel: periodLabel,
      clock: clock,
      myScore: mine.score != null ? String(mine.score) : null,
      oppScore: other.score != null ? String(other.score) : null,
      myWinner: !!mine.winner,
      oppWinner: !!other.winner,
      start: c.date || e.date,
      lastPlay: situation && situation.lastPlay ? situation.lastPlay.text : null
    };
  }

  function fetchJSON(url) {
    return fetch(url, { cache: 'no-store', mode: 'cors' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  function pollLive() {
    if (state.polling) return Promise.resolve();
    state.polling = true;
    var days = ['20261118', '20261119', '20261120'];
    var reqs = [fetchJSON(SB)].concat(days.map(function (d) { return fetchJSON(SB + '?dates=' + d); }));
    return Promise.allSettled(reqs).then(function (res) {
      var map = {};
      res.forEach(function (r) {
        if (r.status === 'fulfilled' && r.value && r.value.events) {
          r.value.events.forEach(function (e) { map[e.id] = e; });
        }
      });
      var got = 0;
      GAMES.forEach(function (g) {
        var e = map[g.id];
        if (e) {
          var parsed = parseEvent(e, g);
          if (parsed) { state.live[g.id] = parsed; got++; }
        }
      });
      state.online = got > 0;
      state.attempted = true;
      state.updated = new Date();
      state.polling = false;
      paintScoreboard();
      return pollPlays();
    }).catch(function () {
      state.polling = false;
      state.online = false;
      state.attempted = true;
      paintScoreboard();
    });
  }

  function pollPlays() {
    var jobs = GAMES.filter(function (g) {
      var l = state.live[g.id];
      return l && (l.state === 'in' || l.state === 'post');
    }).map(function (g) {
      return fetchJSON(SUM + g.id).then(function (d) {
        var plays = (d.plays || []).filter(function (p) { return p.text; });
        var rows = plays.slice(-12).reverse().map(function (p) {
          return {
            text: p.text,
            period: (p.period && (p.period.displayValue || p.period.number)) || '',
            clock: (p.clock && p.clock.displayValue) || '',
            away: p.awayScore, home: p.homeScore,
            scoring: !!p.scoringPlay
          };
        });
        state.pbp[g.id] = rows;
      }).catch(function () {});
    });
    return Promise.all(jobs).then(function () { paintPbp(); });
  }

  /* ---------------- 실시간 UI ---------------- */
  function liveTeamInfo(game) {
    var t = TEAM[game.team];
    var opp = game.opp;
    var l = state.live[game.id];
    return { t: t, opp: opp, l: l };
  }

  function statusLine(game) {
    var l = state.live[game.id];
    if (!l) {
      return { cls: '', dot: '', text: '경기 전 · ' + game.time, live: false };
    }
    if (l.state === 'in') {
      var txt = l.periodLabel || '진행 중';
      if (l.statusName === 'STATUS_HALFTIME') return { cls: 'live', dot: '', text: '하프타임', live: true };
      return { cls: 'live', dot: '', text: txt + (l.clock ? ' · ' + l.clock : ''), live: true };
    }
    if (l.state === 'post') {
      var d = l.detail || '종료';
      return { cls: 'final', dot: '', text: /OT/i.test(d) ? '종료 (연장)' : '종료', live: false };
    }
    return { cls: '', dot: '', text: '경기 전 · ' + game.time, live: false };
  }

  function scoreCardHTML(game) {
    var t = TEAM[game.team];
    var l = state.live[game.id];
    var sl = statusLine(game);
    var myScore = l && l.state !== 'pre' && l.myScore != null ? l.myScore : '–';
    var oppScore = l && l.state !== 'pre' && l.oppScore != null ? l.oppScore : '–';
    var myCls = 'score-num', oppCls = 'score-num';
    if (l && l.state === 'post') {
      myCls += l.myWinner ? ' win' : ' lose';
      oppCls += l.oppWinner ? ' win' : ' lose';
    }
    return '' +
      '<div class="score-card ' + game.team + '">' +
        '<div class="score-top"><span class="who">' + esc(t.abbr === 'LAL' ? '레이커스' : '워리어스') + '</span>' +
          '<span class="ven">' + (l && l.state === 'in' ? '<span style="color:#ff8d8d">● LIVE</span>' : esc(game.ha === '@' ? '원정' : '홈')) + ' · ' + esc(game.date) + '</span></div>' +
        '<div class="score-main">' +
          '<div class="score-side"><img src="' + t.logo + '" alt="' + esc(t.abbr) + '"><span class="ab">' + esc(t.abbr) + '</span></div>' +
          '<span class="' + myCls + '">' + esc(myScore) + '</span>' +
          '<span class="score-dash">:</span>' +
          '<span class="' + oppCls + '">' + esc(oppScore) + '</span>' +
          '<div class="score-side" style="margin-left:auto"><span class="ab">' + esc(game.opp) + '</span><img src="' + oppLogo(game.opp) + '" alt="' + esc(game.opp) + '"></div>' +
        '</div>' +
        '<div class="score-state ' + sl.cls + '"><span class="dot"></span>' +
          (sl.cls === 'live' ? '<span class="clock">' + esc(sl.text) + '</span>' : esc(sl.text)) +
        '</div>' +
      '</div>';
  }

  function paintScoreboard() {
    var box = el('score-cards');
    if (!box) return;
    box.innerHTML = GAMES.map(scoreCardHTML).join('');
    var meta = el('score-meta');
    if (meta) {
      var t;
      if (!state.online && state.attempted) {
        t = '<span class="offline">⚠ 실시간 연결 불가 — ' + esc(D.site.updatedLabel) + ' 스냅샷 표시</span>';
      } else if (state.updated && state.online) {
        t = '<b>' + hhmm(state.updated) + '</b> ESPN 실시간';
      } else {
        t = 'ESPN 실시간 연결 중…';
      }
      meta.innerHTML = '<span>' + t + '</span>' +
        '<span style="margin-left:auto;color:#55556a">25초 자동 갱신</span>' +
        '<button class="refresh" data-act="refresh" title="지금 새로고침" aria-label="새로고침"><span>⟳</span></button>';
    }
    paintPbp();
  }

  function pbpRowsHTML(game) {
    var l = state.live[game.id];
    var rows = state.pbp[game.id] || [];
    if (!l || l.state === 'pre') {
      var tips = GAMES.map(function (g) {
        return hhmm(new Date(g.iso));
      }).join(' / ');
      return '<div class="pbp-note">' +
        '<span class="pbp-hint">경기 시작 전 · ' + esc(tips) + ' 팁오프 시 실시간 문자중계가 자동 시작됩니다</span>' +
        '<a class="pbp-link" href="' + NAVER + '" target="_blank" rel="noopener">네이버 스포츠 NBA ↗</a>' +
      '</div>';
    }
    if (!rows.length) {
      var lp = l.lastPlay;
      if (lp) return '<div class="pbp-rows"><div class="pbp-row"><span class="pt">' + esc(lp) + '</span></div></div>';
      return '<div class="pbp-note"><span class="pbp-hint">문자중계 준비 중…</span>' +
        '<a class="pbp-link" href="' + NAVER + '" target="_blank" rel="noopener">네이버 스포츠 NBA ↗</a></div>';
    }
    return '<div class="pbp-rows">' + rows.map(function (r) {
      var q = (r.period && r.period !== '1' && r.period !== '2' && r.period !== '3' && r.period !== '4')
        ? (r.period === 'OT' || Number(r.period) > 4 ? '연장' : r.period + 'Q') : (r.period ? r.period + 'Q' : '');
      return '<div class="pbp-row' + (r.scoring ? ' scoring' : '') + '">' +
        '<span class="pt-period">' + esc(q || '·') + '</span>' +
        '<span class="pt-clock">' + esc(r.clock || '') + '</span>' +
        '<span class="pt">' + esc(r.text) + '</span>' +
        '<span class="pt-score">' + (r.away != null ? esc(r.away) + '-' + esc(r.home) : '') + '</span>' +
      '</div>';
    }).join('') + '</div>';
  }

  function paintPbp() {
    var body = el('pbp-body');
    if (!body) return;
    var g = GAMES.filter(function (x) { return x.id === state.pbpGame; })[0] || GAMES[0];
    body.innerHTML = pbpRowsHTML(g);
    body.setAttribute('data-open', state.pbpOpen ? '1' : '0');
    var sel = el('pbp-sel');
    if (sel) {
      sel.querySelectorAll('button').forEach(function (b) {
        b.classList.toggle('on', b.getAttribute('data-g') === state.pbpGame);
        var l = state.live[b.getAttribute('data-g')];
        var dot = l && l.state === 'in' ? '<i class="pd"></i>' : '';
        var g2 = GAMES.filter(function (x) { return x.id === b.getAttribute('data-g'); })[0];
        if (g2) b.innerHTML = dot + esc(TEAM[g2.team].abbr) + '–' + esc(g2.opp);
      });
    }
    var tog = el('pbp-toggle');
    if (tog) tog.textContent = state.pbpOpen ? '접기' : '펼치기';
  }

  /* ---------------- 랜딩 ---------------- */
  function brandHTML(compact) {
    return '<div class="brand">' +
      '<span class="ball">🏀</span>' +
      '<div class="brand-txt">' +
        '<span class="brand-name">' + esc(D.site.name) + '</span>' +
        (compact ? '' : '<span class="brand-sub">2026-27 · Lakers vs Warriors</span>') +
      '</div>' +
    '</div>';
  }

  function profileBadgeHTML() {
    if (!state.profile) {
      return '<span class="profile-badge idle"><span class="dot" style="background:#6f6f83"></span>프로필 선택</span>';
    }
    var p = curProfile();
    return '<span class="profile-badge ' + p.cls + '">' +
      '<span class="dot" style="background:' + (p.team === 'lal' ? '#fdb927' : '#ffc72c') + '"></span>' +
      '현재 활동: ' + p.name + ' ' + p.emoji +
    '</span>' +
    '<button class="switch-btn" data-act="switch-profile">프로필 바꾸기</button>';
  }

  function landingHTML() {
    var p = curProfile();
    return '' +
    '<header class="topbar poster-top">' + brandHTML(false) +
      '<div class="topbar-right">' + profileBadgeHTML() + '</div>' +
    '</header>' +
    '<div class="poster">' +
      '<button class="half sando" data-act="enter" data-who="sando" aria-label="산도(LA 레이커스)로 입장">' +
        '<img class="shot" src="assets/action_doncic.jpg" alt="루카 돈치치, LA 레이커스 77번 유니폼으로 드리블하는 전신 액션">' +
        '<span class="wash"></span>' +
        '<span class="who-name"><b>산도</b><i>LAL</i></span>' +
        '<span class="cta">산도 입장 <span class="ar">→</span></span>' +
      '</button>' +
      '<button class="half woonggyo" data-act="enter" data-who="woonggyo" aria-label="웅교(골든스테이트 워리어스)로 입장">' +
        '<img class="shot" src="assets/action_curry.jpg" alt="스테판 커리, 골든스테이트 30번 유니폼으로 슛을 던지는 전신 액션">' +
        '<span class="wash"></span>' +
        '<span class="who-name"><b>웅교</b><i>GSW</i></span>' +
        '<span class="cta">웅교 입장 <span class="ar">→</span></span>' +
      '</button>' +
      '<div class="seam" aria-hidden="true"></div>' +
      '<div class="vs-mark" aria-hidden="true"><span>VS</span></div>' +
      '<div class="poster-hint">사진 Wikimedia Commons · Erik Drost (CC BY 4.0) / Keith Allison (CC BY-SA 2.0)</div>' +
    '</div>';
  }

  function sandoCardHTML() {
    var t = D.teams.lal, pl = D.players.doncic;
    return '<button class="card-player sando" data-act="enter" data-who="sando" aria-label="산도로 입장 — LA 레이커스">' +
      '<img class="photo" src="' + pl.photo + '" alt="루카 돈치치">' +
      '<span class="scrim"></span>' +
      '<div class="card-body">' +
        '<div class="card-top">' +
          '<img class="team-mark" src="' + t.logo + '" alt="LA 레이커스">' +
          '<span class="who">산도</span>' +
          '<span class="role">🟣 레이커스 팬</span>' +
        '</div>' +
        '<div>' +
          '<h2 class="card-name">산도<span class="en">Luka Dončić · #77</span></h2>' +
          '<p class="card-team">' + esc(t.nameKo) + ' <span>' + esc(t.record) + ' · 서부 ' + t.confRank + '위</span></p>' +
          '<div class="card-foot">' +
            '<span class="chip gold">' + esc(pl.season.pts) + '점 ' + esc(pl.season.reb) + '리바</span>' +
            '<span class="chip mute">' + esc(t.streak) + '</span>' +
          '</div>' +
          '<span class="enter-hint">돈치치 사진으로 입장 <span class="arw">→</span></span>' +
        '</div>' +
      '</div>' +
    '</button>';
  }

  function woonggyoCardHTML() {
    var t = D.teams.gs, pl = D.players.curry;
    return '<button class="card-player woonggyo" data-act="enter" data-who="woonggyo" aria-label="웅교로 입장 — 골든스테이트 워리어스">' +
      '<img class="photo" src="' + pl.photo + '" alt="스테판 커리">' +
      '<span class="scrim"></span>' +
      '<div class="card-body">' +
        '<div class="card-top">' +
          '<img class="team-mark" src="' + t.logo + '" alt="골든스테이트 워리어스">' +
          '<span class="who">웅교</span>' +
          '<span class="role">🔵 워리어스 팬</span>' +
        '</div>' +
        '<div>' +
          '<h2 class="card-name">웅교<span class="en">Stephen Curry · #30</span></h2>' +
          '<p class="card-team">' + esc(t.nameKo) + ' <span>' + esc(t.record) + ' · 서부 ' + t.confRank + '위</span></p>' +
          '<div class="card-foot">' +
            '<span class="chip blue-gold">' + esc(pl.season.pts) + '점 ' + esc(pl.season.tpm) + '3점</span>' +
            '<span class="chip mute">커리 부상 결장</span>' +
          '</div>' +
          '<span class="enter-hint">커리 사진으로 입장 <span class="arw">→</span></span>' +
        '</div>' +
      '</div>' +
    '</button>';
  }

  /* ---------------- 룸 ---------------- */
  var TABS = [
    { id: 'chat', label: '💬 채팅' },
    { id: 'lakers', label: '🟣 레이커스' },
    { id: 'warriors', label: '🔵 워리어스' },
    { id: 'h2h', label: '⚡ 맞대결' }
  ];

  function roomHTML() {
    var p = curProfile();
    var chatCount = getChat().length;
    return '' +
    '<header class="topbar room-top">' +
      '<div class="rt-row">' + brandHTML(true) +
        '<button class="switch-btn back" data-act="go-home" title="대결 화면으로">←</button>' +
      '</div>' +
      '<div class="rt-row2">' + profileBadgeHTML() + '</div>' +
    '</header>' +

    '<nav class="tabs">' +
      TABS.map(function (t) {
        var cnt = t.id === 'chat' ? '<span class="cnt">' + chatCount + '</span>' : '';
        return '<button class="tab' + (state.tab === t.id ? ' active' : '') + '" data-tab="' + t.id + '" data-act="tab">' + t.label + cnt + '</button>';
      }).join('') +
    '</nav>' +

    '<main class="content" id="content"></main>';
  }

  function scoreblockHTML() {
    return '<div class="scorebar">' +
      '<div class="score-cards" id="score-cards"></div>' +
      '<div class="score-meta" id="score-meta"></div>' +
    '</div>';
  }

  function pbpHTML() {
    return '<section class="pbp" id="pbp">' +
      '<div class="pbp-head">' +
        '<span class="pbp-title">📻 문자중계</span>' +
        '<div class="pbp-sel" id="pbp-sel">' +
          GAMES.map(function (g) {
            var t = TEAM[g.team];
            return '<button data-g="' + g.id + '" data-act="pbp-sel">' + esc(t.abbr) + '–' + esc(g.opp) + '</button>';
          }).join('') +
        '</div>' +
        '<button class="pbp-toggle" id="pbp-toggle" data-act="pbp-toggle">펼치기</button>' +
      '</div>' +
      '<div class="pbp-body" id="pbp-body" data-open="0"></div>' +
    '</section>';
  }

  function miniTeamHTML(key) {
    var t = D.teams[key];
    var pl = D.players[key === 'lal' ? 'doncic' : 'curry'];
    var tab = key === 'lal' ? 'lakers' : 'warriors';
    var inj = pl.key === 'curry' ? '<span class="mini-out">부상 결장</span>' : '<span class="mini-inj">부상 ' + t.injuries.length + '</span>';
    return '<button class="mini-team ' + key + '" data-act="tab" data-tab="' + tab + '">' +
      '<span class="mt-top">' +
        '<img src="' + t.logo + '" alt="">' +
        '<b>' + esc(TEAM[key].name) + '</b>' +
        '<span class="rec">' + esc(t.record) + '</span>' +
        '<span class="seed">서부 ' + t.confRank + '위</span>' +
        '<span class="streak ' + (t.streakType === 'W' ? 'hot' : 'cold') + '">' + esc(t.streak) + '</span>' +
        '<span class="go">자세히 →</span>' +
      '</span>' +
      '<span class="mt-line">' +
        '<span>' + esc(pl.name) + ' <b>' + esc(pl.season.pts) + '</b>점 · <b>' + esc(pl.season.reb) + '</b>리바 · <b>' + esc(pl.season.ast) + '</b>어시</span>' +
        inj +
      '</span>' +
    '</button>';
  }

  function pickStripHTML() {
    var key = curProfile().team;
    var t = D.teams[key];
    var kt = TEAM[key];
    var game = GAMES.filter(function (g) { return g.team === key; })[0];
    var picks = getPicks()[game.id] || {};
    var mine = picks[state.profile];
    function opt(abbr, name, logo) {
      var sel = mine && mine.team === abbr;
      return '<button class="pick-opt' + (sel ? ' sel' : '') + '" data-act="pick" data-game="' + esc(game.id) + '" data-pick="' + esc(abbr) + '">' +
        '<img src="' + logo + '" alt="">' + esc(name) + '</button>';
    }
    var sp = picks.sando ? (picks.sando.team === t.abbr ? kt.name : ko(game.opp)) : '—';
    var wp = picks.woonggyo ? (picks.woonggyo.team === t.abbr ? kt.name : ko(game.opp)) : '—';
    return '<div class="pick-strip">' +
      '<div class="ps-hd"><span>🏀 오늘의 승부예측</span><span class="ps-game">' + esc(t.abbr) + (game.ha === '@' ? ' @ ' : ' vs ') + esc(game.opp) + ' · ' + esc(game.time) + '</span></div>' +
      '<div class="ps-body">' +
        opt(t.abbr, kt.name, t.logo) + opt(game.opp, ko(game.opp), oppLogo(game.opp)) +
        '<span class="ps-picks">산도 <b class="s">' + esc(sp) + '</b> · 웅교 <b class="w">' + esc(wp) + '</b></span>' +
      '</div>' +
    '</div>';
  }

  function chatHalfHTML() {
    var p = curProfile();
    return '<section class="chat-half">' +
      '<div class="chat-head">' +
        '<span class="room-title"># 산도 vs 웅교 라운지</span>' +
        '<span class="spacer"></span>' +
        '<button class="mini" data-act="clear-chat">대화 지우기</button>' +
      '</div>' +
      '<div class="timeline" id="timeline"></div>' +
      '<form class="composer ' + (p.team === 'gs' ? 'gs' : 'lal') + '" id="composer">' +
        '<textarea id="msg" rows="1" maxlength="500" placeholder="' + esc(p.name) + '로 메시지 보내기"></textarea>' +
        '<button class="send ' + (p.team === 'gs' ? 'gs' : 'lal') + '" type="submit" id="send" aria-label="전송">↑</button>' +
      '</form>' +
    '</section>';
  }

  function chatTabHTML() {
    return '<div class="room-split">' +
      '<section class="info-half" id="info-half">' +
        scoreblockHTML() + pbpHTML() +
        '<div class="mini-info">' + miniTeamHTML('lal') + miniTeamHTML('gs') + pickStripHTML() + '</div>' +
      '</section>' +
      chatHalfHTML() +
    '</div>';
  }

  function renderContent() {
    var c = el('content');
    if (!c) return;
    if (state.tab === 'chat') c.innerHTML = chatTabHTML();
    else if (state.tab === 'lakers') c.innerHTML = teamPanelHTML('lal');
    else if (state.tab === 'warriors') c.innerHTML = teamPanelHTML('gs');
    else c.innerHTML = h2hHTML();
    if (state.tab === 'chat') {
      paintScoreboard();
      renderTimeline();
      focusComposer(false);
    } else {
      c.scrollTop = 0;
    }
  }

  /* ---------------- 채팅 UI ---------------- */
  function chatHTML() { return chatHalfHTML(); }

  function msgHTML(m) {
    var me = m.who === state.profile;
    var p = PROFILES[m.who] || PROFILES.sando;
    var bubble;
    if (m.type === 'pick') {
      var t = TEAM[m.team];
      var pickName = m.pick === t.abbr ? t.full : ko(m.opp);
      bubble = '<div class="bubble" style="padding:0;border:0;background:none">' +
        '<div class="pick-card ' + m.team + '">' +
          '<div class="lab">🏀 승부 예측 픽</div>' +
          '<div class="match">' + esc(t.name) + ' vs ' + esc(ko(m.opp)) + '</div>' +
          '<div class="sel">내 선택 <b>' + esc(pickName) + ' 승</b></div>' +
        '</div></div>';
    } else {
      bubble = '<div class="bubble"><span class="txt">' + esc(m.text) + '</span></div>';
    }
    return '<div class="msg' + (me ? ' me' : '') + (m.who === 'woonggyo' ? ' is-gs' : '') + '" data-id="' + esc(m.id) + '">' +
      '<div class="avatar ' + m.who + '">' + p.initial + '</div>' +
      '<div class="msg-col">' +
        '<div class="msg-meta"><span class="nm ' + m.who + '">' + esc(p.name) + '</span><span>' + timeText(m.at) + '</span></div>' +
        bubble +
      '</div>' +
    '</div>';
  }

  function dayKey(iso) {
    try {
      var d = new Date(iso);
      return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
    } catch (e) { return ''; }
  }
  function dayLabel(iso) {
    var d = new Date(iso);
    var key = dayKey(iso);
    if (key === dayKey(new Date().toISOString())) return '오늘 · ' + todayLabel();
    return (d.getMonth() + 1) + '월 ' + d.getDate() + '일';
  }
  function renderTimeline() {
    var tl = el('timeline');
    if (!tl) return;
    var list = getChat();
    var out = '';
    var lastDay = null;
    out += list.map(function (m, i) {
      var day = dayKey(m.at);
      var sep = '';
      if (i === 0) sep = '<div class="day-divider">' + dayLabel(m.at) + '</div>';
      else if (day && lastDay && day !== lastDay) sep = '<div class="day-divider">' + dayLabel(m.at) + '</div>';
      lastDay = day || lastDay;
      return sep + msgHTML(m);
    }).join('');
    tl.innerHTML = out;
    tl.scrollTop = tl.scrollHeight;
    var cnt = document.querySelector('.tab[data-tab="chat"] .cnt');
    if (cnt) cnt.textContent = list.length;
  }

  function focusComposer(flag) {
    var ta = el('msg');
    if (!ta) return;
    if (flag) ta.focus();
    autoGrow(ta);
    var btn = el('send');
    if (btn) btn.disabled = ta.value.trim().length === 0;
  }

  function autoGrow(ta) {
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 110) + 'px';
  }

  function sendMessage() {
    var ta = el('msg');
    if (!ta) return;
    var text = ta.value.trim();
    if (!text) return;
    pushMessage({ id: 'm' + Date.now(), who: state.profile, type: 'text', at: new Date().toISOString(), text: text });
    ta.value = '';
    autoGrow(ta);
    focusComposer(true);
    renderTimeline();
  }

  /* ---------------- 팀 패널 ---------------- */
  function teamPanelHTML(key) {
    var t = D.teams[key];
    var pl = D.players[key === 'lal' ? 'doncic' : 'curry'];
    var cls = key;
    var out = '<div class="panel">';

    /* 팀 헤로 */
    out += '<div class="team-hero ' + cls + '">' +
      '<img class="logo-bg" src="' + t.logo + '" alt="">' +
      '<div class="row"><img class="logo" src="' + t.logo + '" alt="' + esc(t.nameKo) + '">' +
        '<div><div class="nm">' + esc(t.nameKo) + '</div><div class="en">' + esc(t.name) + '</div></div>' +
        '<span class="pill" style="margin-left:auto">' + (key === 'lal' ? '🟣 산도' : '🔵 웅교') + '</span>' +
      '</div>' +
      '<div class="rec">' + esc(t.record) + '<small>서부 ' + t.confRank + '위 · 승률 ' + esc(String(t.pct).replace('0.', '.')) + '</small></div>' +
      '<div class="hero-pills">' +
        '<span class="pill ' + (t.streakType === 'W' ? 'hot' : 'cold') + '">' + esc(t.streak) + '</span>' +
        '<span class="pill">홈 ' + esc(t.home) + '</span>' +
        '<span class="pill">원정 ' + esc(t.away) + '</span>' +
        '<span class="pill">평균 ' + esc(t.ppg) + '득점 / ' + esc(t.oppPpg) + '실점</span>' +
        '<span class="pill">마진 ' + esc(t.diff) + '</span>' +
      '</div>' +
    '</div>';

    /* 선수 카드 */
    out += '<div class="player-card ' + cls + '">' +
      '<img class="ph" src="' + pl.photo + '" alt="' + esc(pl.name) + '">' +
      '<div class="inner">' +
        '<div class="who">' + (key === 'lal' ? '🟣' : '🔵') + ' ' + esc(pl.name) + ' · #' + pl.num + ' · ' + esc(pl.season.gp) + '경기' +
          (pl.key === 'curry' ? ' <span class="badge-out">부상 결장</span>' : ' <span class="badge-ok">출전 중</span>') +
        '</div>' +
        '<h3 class="nm">' + esc(pl.name) + '</h3>' +
        '<div class="en">' + esc(pl.en) + ' · 2026-27 정규시즌 평균</div>' +
        '<div class="stat-grid">' +
          statHTML(pl.season.pts, 'PTS', true) +
          statHTML(pl.season.reb, 'REB') +
          statHTML(pl.season.ast, 'AST') +
          statHTML(pl.season.min, 'MIN') +
        '</div>' +
        '<div class="split">' +
          '<span>FG <b>' + esc(pl.season.fgPct) + '%</b> <span style="color:#4a4a5c">(' + esc(pl.season.fga) + ')</span></span>' +
          '<span>3P <b>' + esc(pl.season.tpPct) + '%</b> <span style="color:#4a4a5c">(' + esc(pl.season.tpa) + ')</span></span>' +
          '<span>FT <b>' + esc(pl.season.ftPct) + '%</b></span>' +
          '<span>STL <b>' + esc(pl.season.stl) + '</b> · BLK <b>' + esc(pl.season.blk) + '</b> · TO <b>' + esc(pl.season.to) + '</b></span>' +
        '</div>' +
      '</div>' +
    '</div>';

    /* 직전 경기 */
    var lg = pl.lastGame;
    out += '<div class="sec-title">직전 경기 <span class="ln"></span>' + esc(lg.date) + '</div>';
    out += '<div class="h2h-game">' +
      '<div class="top"><span class="dt">' + esc(lg.ha === '@' ? '원정' : '홈') + ' · ' + esc(lg.oppName) + '</span>' +
        '<span class="res ' + (lg.res === 'W' ? 'W' : 'L') + '">' + lg.res + '</span></div>' +
      '<div class="score"><div class="t">' + (lg.res === 'W' ? '승리' : '패배') + '</div>' +
        '<span class="n" style="margin-left:auto">' + esc(lg.score) + '</span></div>' +
      '<div class="lines">' +
        '<div><b>' + esc(pl.name) + '</b> ' + esc(lg.min) + '분 · <b>' + esc(lg.pts) + '점 ' + esc(lg.reb) + '리바 ' + esc(lg.ast) + '어시</b>' +
          ' (FG ' + esc(lg.fg) + ', 3P ' + esc(lg.tp) + ', FT ' + esc(lg.ft) + ')</div>' +
        (pl.key === 'curry'
          ? '<div style="color:#ffb3b3">이 경기 6분만 뛰고 복사근 부상으로 이탈 — 이후 3경기 연속 결장</div>'
          : '') +
      '</div>' +
    '</div>';

    /* 최근 5경기 */
    out += '<div class="sec-title">최근 5경기 <span class="ln"></span></div>';
    out += '<div class="game-list">' + t.recent.map(function (g) {
      return '<div class="game-row">' +
        '<span class="d">' + esc(g.date) + '</span>' +
        '<span class="opp"><span class="ha">' + esc(g.ha) + '</span><img src="' + oppLogo(g.opp) + '" alt="">' +
          '<span class="nm">' + esc(g.oppName) + '</span></span>' +
        '<span class="sc"><span class="res ' + g.result + '">' + g.result + '</span>' +
          '<span class="num">' + esc(g.score) + (g.ot ? ' <span style="color:#9b9bad;font-size:9px">OT</span>' : '') + '</span></span>' +
      '</div>';
    }).join('') + '</div>';

    /* 다가오는 경기 + 픽 */
    out += '<div class="sec-title">다가오는 경기 <span class="ln"></span></div>';
    out += '<div class="game-list">' + t.upcoming.map(function (g) {
      return '<div class="game-row upcoming">' +
        '<span class="d">' + esc(g.date) + (g.today ? ' <span class="today-tag">오늘</span>' : '') + '</span>' +
        '<span class="opp"><span class="ha">' + esc(g.ha) + '</span><img src="' + oppLogo(g.opp) + '" alt="">' +
          '<span class="nm">' + esc(g.oppName) + '</span></span>' +
        '<span class="sc"><span style="color:#e8c476;font-weight:800;font-size:10.5px">' + esc(g.time) + '</span></span>' +
      '</div>';
    }).join('') + '</div>';

    out += pickHTML(key);

    /* 부상자 */
    out += '<div class="sec-title">부상자 명단 <span class="ln"></span>' + t.injuries.length + '명</div>';
    out += '<div class="inj-list">' + t.injuries.map(function (inj) {
      return '<div class="inj" title="' + esc(inj.raw) + '">' +
        '<div class="nm">' + esc(nameKo(inj.name)) + ' <span class="part">' + esc(inj.part) + '</span></div>' +
        '<span class="st">' + esc(inj.status) + '</span>' +
        '<div class="nt">' + esc(inj.note) + '</div>' +
      '</div>';
    }).join('') + '</div>';

    out += '<p class="src-line">출처 · ESPN 공개 API (부상 리포트 ' + esc(D.site.updatedLabel) + ' 기준) · 원문은 항목에 마우스를 올리면 표시됩니다</p>';
    out += '</div>';
    return out;
  }

  var NAME_KO = {
    'Austin Reaves': '오스틴 리브스', 'Stephen Curry': '스테판 커리', 'Al Horford': '앨 호포드',
    'Brandon Williams': '브랜든 윌리엄스', 'Kristaps Porzingis': '크리스탑스 포르징기스',
    'Moses Moody': '모지스 무디', 'Jimmy Butler III': '지미 버틀러 3세'
  };
  function nameKo(n) { return NAME_KO[n] || n; }

  function statHTML(v, l, lead) {
    return '<div class="stat' + (lead ? ' lead' : '') + '"><div class="v">' + esc(v) + '</div><div class="l">' + l + '</div></div>';
  }

  function pickHTML(key) {
    var t = D.teams[key];
    var game = GAMES.filter(function (g) { return g.team === key; })[0] || D.teams[key].nextGame;
    var picks = getPicks()[game.id] || {};
    var mine = picks[state.profile];
    function opt(abbr, name, logo) {
      var sel = mine && mine.team === abbr;
      return '<button class="pick-opt' + (sel ? ' sel' : '') + '" data-act="pick" data-game="' + esc(game.id) + '" data-pick="' + esc(abbr) + '">' +
        '<img src="' + logo + '" alt="">' + esc(name) + ' 승</button>';
    }
    var sp = picks.sando ? (picks.sando.team === t.abbr ? TEAM[key].name : ko(game.opp)) : '—';
    var wp = picks.woonggyo ? (picks.woonggyo.team === t.abbr ? TEAM[key].name : ko(game.opp)) : '—';
    return '<div class="pick-box">' +
      '<div class="hd"><div><div class="ttl">🏀 오늘의 승부 예측</div>' +
        '<div class="sub">' + esc(TEAM[key].name) + ' ' + (game.ha === '@' ? '@ ' : 'vs ') + esc(ko(game.opp)) + ' · ' + esc(game.time) + ' 팁오프</div></div>' +
        '<span class="pill">' + esc(curProfile().name) + '로 픽</span></div>' +
      '<div class="pick-opts">' +
        opt(t.abbr, TEAM[key].name, t.logo) +
        opt(game.opp, ko(game.opp), oppLogo(game.opp)) +
      '</div>' +
      '<div class="pick-note"><span>산도 픽 <b class="s">' + esc(sp) + '</b></span><span>웅교 픽 <b class="w">' + esc(wp) + '</b></span></div>' +
    '</div>';
  }

  /* ---------------- H2H ---------------- */
  function cmpRows(rows, leftName, rightName) {
    var head = '<div class="cmp-row cmp-head"><div class="a">' + esc(leftName || '레이커스') + '</div><div class="k">비교</div><div class="b">' + esc(rightName || '워리어스') + '</div></div>';
    var body = rows.map(function (r) {
      var aCls = 'a' + (r.better === 'a' ? ' win' : '');
      var bCls = 'b' + (r.better === 'b' ? ' win' : '');
      return '<div class="cmp-row"><div class="' + aCls + '">' + esc(r.a) + '</div><div class="k">' + esc(r.k) + '</div><div class="' + bCls + '">' + esc(r.b) + '</div></div>';
    }).join('');
    return '<div class="cmp">' + head + body + '</div>';
  }

  function num(x) {
    if (x === null || x === undefined || x === '') return null;
    var n = parseFloat(String(x).replace('+', ''));
    return isNaN(n) ? null : n;
  }

  function better(a, b, lowerWins) {
    if (num(a) === null || num(b) === null) return '';
    if (num(a) === num(b)) return '';
    if (lowerWins) return num(a) < num(b) ? 'a' : 'b';
    return num(a) > num(b) ? 'a' : 'b';
  }

  function h2hHTML() {
    var lal = D.teams.lal, gs = D.teams.gs, H = D.h2h;
    var dl = D.players.doncic, cu = D.players.curry;
    var out = '<div class="panel">';

    out += '<div class="series-hero">' +
      '<div class="side"><img src="' + lal.logo + '" alt=""><span class="nm">레이커스</span></div>' +
      '<div class="mid"><div class="sc">' + esc(String(H.series).replace('-', ' : ')) + '</div><div class="lab">2026-27 상대전적</div></div>' +
      '<div class="side"><img src="' + gs.logo + '" alt=""><span class="nm">워리어스</span></div>' +
    '</div>';

    out += '<div class="sec-title">치른 맞대결 <span class="ln"></span>2경기</div>';
    out += H.games.map(function (g) {
      var home = D.teams[g.home === 'LAL' ? 'lal' : 'gs'];
      var away = D.teams[g.away === 'LAL' ? 'lal' : 'gs'];
      var hs = g.homeScore, as = g.awayScore;
      var hWin = g.winner === g.home;
      return '<div class="h2h-game">' +
        '<div class="top"><span class="dt">' + esc(g.date) + ' · ' + esc(g.venue) + '</span>' +
          '<span class="pill" style="font-size:9px">' + (g.winner === 'LAL' ? '레이커스 승' : '워리어스 승') + '</span></div>' +
        '<div class="score">' +
          '<div class="t"><img src="' + away.logo + '" alt="">' + esc(away.abbr) + '</div>' +
          '<span class="n' + (hWin ? ' lose' : '') + '">' + as + '</span>' +
          '<span style="color:#6f6f83">:</span>' +
          '<span class="n' + (hWin ? '' : ' lose') + '">' + hs + '</span>' +
          '<div class="t"><img src="' + home.logo + '" alt="">' + esc(home.abbr) + '</div>' +
        '</div>' +
        '<div class="lines">' +
          '<div><b class="s">돈치치</b> ' + esc(g.doncic) + '</div>' +
          '<div><b class="w">커리</b> ' + esc(g.curry) + '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    out += '<div class="sec-title">남은 맞대결 <span class="ln"></span>2경기</div>';
    out += H.upcoming.map(function (g) {
      var home = D.teams[g.home === 'LAL' ? 'lal' : 'gs'];
      var away = D.teams[g.away === 'LAL' ? 'lal' : 'gs'];
      return '<div class="game-row upcoming">' +
        '<span class="d">' + esc(g.date) + '</span>' +
        '<span class="opp"><img src="' + away.logo + '" alt=""><span class="nm">' + esc(away.abbr) + '</span>' +
          '<span class="ha">@</span><img src="' + home.logo + '" alt=""><span class="nm">' + esc(home.abbr) + '</span></span>' +
        '<span class="sc"><span style="color:#e8c476;font-weight:800;font-size:10.5px">' + esc(g.time) + '</span></span>' +
      '</div>';
    }).join('');

    out += '<div class="sec-title">팀 성적 비교 <span class="ln"></span></div>';
    out += cmpRows([
      { k: '전적', a: lal.record, b: gs.record, better: better(lal.wins - lal.losses, gs.wins - gs.losses) },
      { k: '승률', a: lal.pct, b: gs.pct, better: better(lal.pct, gs.pct) },
      { k: '서부 순위', a: lal.confRank + '위', b: gs.confRank + '위', better: better(lal.confRank, gs.confRank, true) },
      { k: '최근 흐름', a: lal.streak, b: gs.streak, better: 'a' },
      { k: '득점', a: lal.ppg, b: gs.ppg, better: better(lal.ppg, gs.ppg) },
      { k: '실점', a: lal.oppPpg, b: gs.oppPpg, better: better(lal.oppPpg, gs.oppPpg, true) },
      { k: '마진', a: lal.diff, b: gs.diff, better: better(lal.diff, gs.diff) },
      { k: '야투%', a: lal.stats.fg, b: gs.stats.fg, better: better(lal.stats.fg, gs.stats.fg) },
      { k: '3점%', a: lal.stats.tp, b: gs.stats.tp, better: better(lal.stats.tp, gs.stats.tp) },
      { k: '자유투%', a: lal.stats.ft, b: gs.stats.ft, better: better(lal.stats.ft, gs.stats.ft) },
      { k: '리바운드', a: lal.stats.reb, b: gs.stats.reb, better: better(lal.stats.reb, gs.stats.reb) },
      { k: '어시스트', a: lal.stats.ast, b: gs.stats.ast, better: better(lal.stats.ast, gs.stats.ast) },
      { k: '스틸', a: lal.stats.stl, b: gs.stats.stl, better: better(lal.stats.stl, gs.stats.stl) },
      { k: '블록', a: lal.stats.blk, b: gs.stats.blk, better: better(lal.stats.blk, gs.stats.blk) },
      { k: '턴오버', a: lal.stats.to, b: gs.stats.to, better: better(lal.stats.to, gs.stats.to, true) }
    ]);

    out += '<div class="sec-title">돈치치 vs 커리 <span class="ln"></span>시즌 평균</div>';
    out += cmpRows([
      { k: '경기', a: dl.season.gp + '경기', b: cu.season.gp + '경기', better: better(dl.season.gp, cu.season.gp) },
      { k: '출전시간', a: dl.season.min, b: cu.season.min, better: better(dl.season.min, cu.season.min) },
      { k: '득점', a: dl.season.pts, b: cu.season.pts, better: better(dl.season.pts, cu.season.pts) },
      { k: '리바운드', a: dl.season.reb, b: cu.season.reb, better: better(dl.season.reb, cu.season.reb) },
      { k: '어시스트', a: dl.season.ast, b: cu.season.ast, better: better(dl.season.ast, cu.season.ast) },
      { k: '스틸', a: dl.season.stl, b: cu.season.stl, better: better(dl.season.stl, cu.season.stl) },
      { k: '야투%', a: dl.season.fgPct, b: cu.season.fgPct, better: better(dl.season.fgPct, cu.season.fgPct) },
      { k: '3점%', a: dl.season.tpPct, b: cu.season.tpPct, better: better(dl.season.tpPct, cu.season.tpPct) },
      { k: '자유투%', a: dl.season.ftPct, b: cu.season.ftPct, better: better(dl.season.ftPct, cu.season.ftPct) },
      { k: '3점 성공', a: dl.season.tpm, b: cu.season.tpm, better: better(dl.season.tpm, cu.season.tpm) }
    ], '돈치치', '커리');
    out += '<p class="note"><b>참고</b> · 커리는 11/12 휴스턴전에서 복사근 파열 부상으로 6분 만에 이탈했고, 이후 3경기 연속 결장 중입니다. 시즌 평균은 10경기 기준입니다. 돈치치는 13경기 기준.</p>';

    out += '<div class="sec-title">서부 컨퍼런스 순위 <span class="ln"></span></div>';
    out += '<div class="game-list">' + H.westTable.slice(0, 15).map(function (r, i) {
      var me = r.abbr === 'LAL' || r.abbr === 'GS';
      return '<div class="game-row"' + (me ? ' style="border-color:rgba(253,185,39,.25);background:rgba(253,185,39,.05)"' : '') + '>' +
        '<span class="d">' + (i + 1) + '</span>' +
        '<span class="opp"><img src="' + oppLogo(r.abbr) + '" alt=""><span class="nm">' + esc(r.name) + '</span>' +
          (me ? ' <span class="today-tag">' + (r.abbr === 'LAL' ? '산도' : '웅교') + '</span>' : '') + '</span>' +
        '<span class="sc"><span class="num">' + esc(r.record) + '</span></span>' +
      '</div>';
    }).join('') + '</div>';

    out += '<p class="src-line">모든 수치는 ESPN 공개 API · ' + esc(D.site.updatedLabel) + ' 기준 실제 2026-27 시즌 기록입니다.</p>';
    out += '</div>';
    return out;
  }

  /* ---------------- 프로필 모달 ---------------- */
  function modalHTML() {
    return '<div class="modal-wrap" data-act="modal-bg">' +
      '<div class="modal" role="dialog" aria-modal="true">' +
        '<h3>누구로 활동할까요?</h3>' +
        '<p>고른 프로필로 채팅·승부예측이 등록되고, 상단에 계속 표시됩니다.</p>' +
        '<div class="switch-grid">' +
          '<button class="switch-opt sando' + (state.profile === 'sando' ? ' cur' : '') + '" data-act="choose" data-who="sando">' +
            '<img class="bg" src="assets/doncic.png" alt="">' +
            '<span class="t">🟣 산도</span><span class="s">LA 레이커스 팬 · 돈치치</span>' +
          '</button>' +
          '<button class="switch-opt woonggyo' + (state.profile === 'woonggyo' ? ' cur' : '') + '" data-act="choose" data-who="woonggyo">' +
            '<img class="bg" src="assets/curry.png" alt="">' +
            '<span class="t">🔵 웅교</span><span class="s">골든스테이트 팬 · 커리</span>' +
          '</button>' +
        '</div>' +
        '<button class="btn modal-close" data-act="close-modal">닫기</button>' +
      '</div>' +
    '</div>';
  }

  /* ---------------- 라우팅/렌더 ---------------- */
  function currentTab() {
    var h = (location.hash || '').replace('#', '');
    if (['chat', 'lakers', 'warriors', 'h2h'].indexOf(h) >= 0) return h;
    return null;
  }

  function render() {
    var app = el('app');
    var tab = currentTab();
    if (!state.profile) {
      state.tab = tab || 'chat';
      app.innerHTML = landingHTML() + (state.modal ? modalHTML() : '');
      return;
    }
    if (!tab) {
      history.replaceState(null, '', '#chat');
      tab = 'chat';
    }
    state.tab = tab;
    state.pbpGame = autoGame();
    app.innerHTML = roomHTML() + (state.modal ? modalHTML() : '') + '<div class="toast" id="toast" hidden></div>';
    renderContent();
    paintPbp();
  }

  function autoGame() {
    var live = GAMES.filter(function (g) { var l = state.live[g.id]; return l && l.state === 'in'; });
    if (live.length) return live[0].id;
    var pre = GAMES.filter(function (g) { var l = state.live[g.id]; return !l || l.state === 'pre'; });
    if (pre.length) return pre[0].id;
    return GAMES[0].id;
  }

  function toast(text) {
    var t = el('toast');
    if (!t) return;
    t.textContent = text;
    t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.hidden = true; }, 1800);
  }

  function enter(who) {
    if (!PROFILES[who]) return;
    state.profile = who;
    store.set(K.profile, who);
    state.modal = null;
    if (!currentTab()) history.replaceState(null, '', '#chat');
    render();
    pollLive();
    startPolling();
  }

  /* ---------------- 이벤트 ---------------- */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-act]');
    if (!t) {
      var tabBtn = e.target.closest('[data-tab]');
      if (tabBtn) { location.hash = '#' + tabBtn.getAttribute('data-tab'); }
      return;
    }
    var act = t.getAttribute('data-act');

    if (act === 'enter' || act === 'choose') {
      enter(t.getAttribute('data-who'));
      return;
    }
    if (act === 'switch-profile') {
      state.modal = 'switch';
      render();
      return;
    }
    if (act === 'close-modal') {
      state.modal = null;
      render();
      return;
    }
    if (act === 'modal-bg') {
      if (e.target === t) { state.modal = null; render(); }
      return;
    }
    if (act === 'go-home') {
      state.modal = null;
      location.hash = '';
      render();
      return;
    }
    if (act === 'go-chat') {
      if (state.profile) { location.hash = '#chat'; }
      else { state.modal = 'switch'; render(); }
      return;
    }
    if (act === 'go-h2h') {
      if (!state.profile) { state.modal = 'switch'; render(); }
      else location.hash = '#h2h';
      return;
    }
    if (act === 'tab') {
      location.hash = '#' + t.getAttribute('data-tab');
      return;
    }
    if (act === 'refresh') {
      t.classList.add('spin');
      Promise.resolve(pollLive()).then(function () { setTimeout(function () { t.classList.remove('spin'); }, 600); });
      return;
    }
    if (act === 'pbp-toggle') {
      state.pbpOpen = !state.pbpOpen;
      paintPbp();
      return;
    }
    if (act === 'pbp-sel') {
      state.pbpGame = t.getAttribute('data-g');
      paintPbp();
      return;
    }
    if (act === 'pick') {
      var gid = t.getAttribute('data-game'), pick = t.getAttribute('data-pick');
      var g = GAMES.filter(function (x) { return x.id === gid; })[0];
      if (!g) g = D.teams.lal.nextGame.id === gid ? { id: gid, team: 'lal', opp: D.teams.lal.nextGame.opp } : { id: gid, team: 'gs', opp: D.teams.gs.nextGame.opp };
      postPick(g, pick);
      var strip = document.querySelector('.pick-strip');
      if (strip) {
        var holder = document.createElement('div');
        holder.innerHTML = pickStripHTML();
        strip.replaceWith(holder.firstElementChild);
      }
      if (state.tab !== 'chat') {
        var sc = el('content').scrollTop;
        renderContent();
        el('content').scrollTop = sc;
      }
      toast(curProfile().name + ' 픽 등록 · 채팅방에 올라갔어요');
      return;
    }
    if (act === 'clear-chat') {
      if (window.confirm('이 브라우저에 저장된 대화를 모두 지울까요?')) {
        store.del(K.chat);
        renderTimeline();
        toast('대화를 비웠어요');
      }
      return;
    }
  });

  document.addEventListener('input', function (e) {
    if (e.target && e.target.id === 'msg') {
      autoGrow(e.target);
      var btn = el('send');
      if (btn) btn.disabled = e.target.value.trim().length === 0;
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.target && e.target.id === 'msg' && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  document.addEventListener('submit', function (e) {
    if (e.target && e.target.id === 'composer') {
      e.preventDefault();
      sendMessage();
    }
  });

  window.addEventListener('hashchange', function () {
    state.modal = null;
    render();
    if (state.profile) pollLive();
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stopPolling();
    else if (state.profile) { pollLive(); startPolling(); }
  });

  var timer = null;
  function startPolling() {
    stopPolling();
    timer = setInterval(function () {
      if (!document.hidden) pollLive();
    }, POLL_MS);
  }
  function stopPolling() {
    if (timer) { clearInterval(timer); timer = null; }
  }

  /* ---------------- 시작 ---------------- */
  var initialTab = currentTab();
  if (state.profile) {
    if (!initialTab) history.replaceState(null, '', '#chat');
    render();
    pollLive();
    startPolling();
  } else {
    render();
  }
  // 해시 없이 열었고 저장된 프로필이 있으면 채팅방으로
  window.addEventListener('load', function () {
    if (state.profile && !currentTab()) { location.hash = '#chat'; }
  });
})();
