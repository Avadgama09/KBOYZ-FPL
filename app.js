// ------------ USER CONFIGURATION --------------
const managers = [
  { username: "ashishvadgama", entryId: 539005, displayName: "Ashish Vadgama" },
  { username: "rahulsani", entryId: 6379954, displayName: "Rahul Sani" },
  { username: "shaktimelwani", entryId: 5919446, displayName: "Shakti Melwani" },
  { username: "utsavbachani", entryId: 4687835, displayName: "Utsav Bachani" },
  { username: "puravdesai", entryId: 1102461, displayName: "Purav Desai" },
  { username: "ashishvishwakarma", entryId: 569159, displayName: "Ashish Vishwakarma" },
  { username: "marmikajmera", entryId: 4508155, displayName: "Marmik Ajmera" },
  { username: "kaushikbudhelia", entryId: 1800696, displayName: "Kaushik Budhelia" },
  { username: "sidhvickshivalkar", entryId: 1037289, displayName: "Sidhvick Shivalkar" },
  { username: "sagarpanjwani", entryId: 3886462, displayName: "Sagar Panjwani" },
  { username: "harshilbagdai", entryId: 2188411, displayName: "Harshil Bagdai" }
];
const MANAGER_PASSWORD = "kboyz2025";
const LEAGUE_ID = 976735;

// Dynamically set proxy root for local vs production
const isLocal = window.location.hostname === 'localhost'
             || window.location.hostname === '127.0.0.1';
const PROXY_ROOT = isLocal
  ? 'http://localhost:5001/api'
  : '/api';

// Helper: all FPL paths start with /api/...
const FPL = (path) => `${PROXY_ROOT}${path}`;

// ---------- Internal State ----------
let currentUser = null;
let leagueStandings = [];

// ---------- Fetch Helpers ----------
async function getJson(url) {
  const res = await fetch(url, { credentials: "omit" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText} @ ${url}\nBody: ${text.slice(0,300)}`);
  }
  const txt = await res.text();
  try {
    return JSON.parse(txt);
  } catch {
    // strip trailing commas
    return JSON.parse(
      txt.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]")
    );
  }
}

async function fetchLeagueStandings(finalEvent = null) {
  let url = FPL(`/leagues-classic/${LEAGUE_ID}/standings/`);
  if (finalEvent) url += `?event=${finalEvent}`;
  console.log("[fetchLeagueStandings] GET", url);
  const data = await getJson(url);

  const standings = data?.standings?.results || [];
  if (standings.length > 0) {
    return standings;
  }

  const newEntries = data?.new_entries?.results || [];
  console.warn("[fetchLeagueStandings] No standings yet; using new_entries:", newEntries);
  return newEntries.map((e, i) => ({
    entry: e.entry,
    entry_name: e.entry_name,
    player_name: `${e.player_first_name} ${e.player_last_name}`,
    total: 0,
    rank: i + 1
  }));
}

async function fetchManagerEntry(entryId) {
  const url = FPL(`/entry/${entryId}/`);
  console.log("[fetchManagerEntry] GET", url);
  return await getJson(url);
}

async function fetchManagerHistory(entryId) {
  const url = FPL(`/entry/${entryId}/history/`);
  console.log("[fetchManagerHistory] GET", url);
  return await getJson(url);
}

async function fetchBootstrap() {
  const url = FPL(`/bootstrap-static/`);
  console.log("[fetchBootstrap] GET", url);
  return await getJson(url);
}

async function fetchTeamPicks(entryId, event) {
  const url = FPL(`/entry/${entryId}/event/${event}/picks/`);
  console.log("[fetchTeamPicks] GET", url);
  try { return await getJson(url); }
  catch { return null; }
}

// ------------ Initialization & Routing --------------
document.addEventListener('DOMContentLoaded', initializeApp);

function initializeApp() {
  document.getElementById('loginForm').addEventListener('submit', handleLogin);
  document.getElementById('logoutBtn').addEventListener('click', handleLogout);
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => navigateToSection(btn.dataset.section));
  });

  const leagueBtn = document.querySelector('.nav-btn[data-section="leaguetable"]');
  if (leagueBtn) {
    leagueBtn.addEventListener('click', () => populateLeagueTable());
  }

  const saved = sessionStorage.getItem('currentUser');
  if (saved) {
    currentUser = JSON.parse(saved);
    showMainApp();
  } else {
    showLoginScreen();
  }
}

function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('username').value.toLowerCase().trim();
  const password = document.getElementById('password').value;
  const err = document.getElementById('loginError');
  const manager = managers.find(m => m.username === username);

  if (manager && password === MANAGER_PASSWORD) {
    currentUser = manager;
    sessionStorage.setItem('currentUser', JSON.stringify(manager));
    showMainApp();
    err.classList.add('hidden');
  } else {
    err.textContent = "Invalid username or password";
    err.classList.remove('hidden');
  }
}

function handleLogout() {
  currentUser = null;
  sessionStorage.removeItem('currentUser');
  showLoginScreen();
}

function showLoginScreen() {
  document.getElementById('loginScreen').classList.remove('hidden');
  document.getElementById('mainApp').classList.add('hidden');
}

function navigateToSection(sec) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`[data-section="${sec}"]`).classList.add('active');
  document.querySelectorAll('.main-section').forEach(s => s.classList.remove('active'));
  document.getElementById(sec).classList.add('active');
}

// ------------ Main App Rendering -------------
async function showMainApp() {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('mainApp').classList.remove('hidden');

  try {
    leagueStandings = await fetchLeagueStandings();
    console.log("[showMainApp] standings loaded:", leagueStandings.length);
  } catch (e) {
    console.error("fetchLeagueStandings FAILED:", e);
    alert("Couldn't load live league data.");
  }

  await updateUserHeader();
  await populateDashboardTiles();
  await populateAchievements();

  setTimeout(() => populateLeagueTable(), 0);
}

// ========== Header & Dashboard ==========
async function updateUserHeader() {
  let welcome = "Manager";
  if (currentUser?.entryId) {
    try {
      const data = await fetchManagerEntry(currentUser.entryId);
      welcome = `${data.player_first_name} ${data.player_last_name}`;
      document.getElementById('currentRank').textContent =
        data.summary_overall_rank ? `#${data.summary_overall_rank}` : "#–";
      document.getElementById('currentPoints').textContent =
        data.summary_overall_points ? `${data.summary_overall_points} pts` : "–";
      document.getElementById('teamName').textContent = data.name || "–";
    } catch {
      welcome = currentUser.displayName;
    }
  }
  document.getElementById('userWelcome').textContent = `Welcome, ${welcome}`;
}

async function populateDashboardTiles() {
  if (!currentUser) return;
  const fill = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  fill('currentRank', "--"); fill('currentPoints', "-- pts"); fill('teamName', "–");
  fill('lastGWPoints', "-- pts"); fill('lastGWAvg', ""); fill('lastGWCaption', "");
  fill('nextGWDeadline', "--"); fill('nextGWCountdown', "--"); fill('nextCaptainFixture', "--");
  fill('freeTransfers', "-- Free Transfers"); fill('bankValue', "Bank: --");

  let entryData, histData, bootstrap;
  try {
    [entryData, histData, bootstrap] = await Promise.all([
      fetchManagerEntry(currentUser.entryId),
      fetchManagerHistory(currentUser.entryId),
      fetchBootstrap()
    ]);
  } catch {
    console.error("Dashboard bootstrap failed");
    return;
  }

  fill('currentRank', entryData.summary_overall_rank ? `#${entryData.summary_overall_rank}` : "--");
  fill('currentPoints', entryData.summary_overall_points ? `${entryData.summary_overall_points} pts` : "-- pts");
  fill('teamName', entryData.name || "--");

  const now = new Date();
  const events = bootstrap.events || [];
  const lastGW = [...events].reverse().find(ev => ev.finished);
  const nextGW = events.find(ev => new Date(ev.deadline_time) > now && !ev.finished);

  if (lastGW) {
    const row = histData.current.find(r => r.event === lastGW.id);
    fill('lastGWPoints', row ? `${row.points} pts` : "-- pts");
    fill('lastGWAvg', ` (League avg: ${lastGW.average_entry_score} pts)`);
    let cap = "--";
    try {
      const picks = await fetchTeamPicks(currentUser.entryId, lastGW.id);
      const capPick = picks.picks.find(p => p.is_captain);
      const player = bootstrap.elements.find(e => e.id === capPick.element);
      cap = player.web_name;
    } catch {}
    fill('lastGWCaption', `Captain: ${cap}`);
  }

  if (nextGW) {
    const dl = new Date(nextGW.deadline_time);
    fill('nextGWDeadline', dl.toLocaleString('en-GB', {
      weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    }));
    const diff = dl - Date.now();
    const days = Math.floor(diff / 86400000);
    const hrs = Math.floor((diff/3600000) % 24);
    const mins = Math.floor((diff/60000) % 60);
    fill('nextGWCountdown', diff>0 ? `in ${days}d ${hrs}h ${mins}m` : "Deadline passed!");
    let cap = "--";
    try {
      const picks = await fetchTeamPicks(currentUser.entryId, nextGW.id);
      const capPick = picks.picks.find(p => p.is_captain);
      const player = bootstrap.elements.find(e => e.id === capPick.element);
      cap = player.web_name;
    } catch{}
    fill('nextCaptainFixture', `Captain: ${cap}`);
  }

  if (histData.current.length) {
    const last = histData.current[histData.current.length-1];
    fill('freeTransfers', `${last.event_transfers} Free Transfers`);
  }
  fill('bankValue', entryData.bank ? `Bank: £${(entryData.bank/10).toFixed(1)}m` : "Bank: --");
}

// ========== Achievements ==========
async function populateAchievements() {
  const grand = document.getElementById('grandChampionBoard');
  if (grand) {
    grand.innerHTML = "";
    leagueStandings.slice(0,3).forEach((m,i) => {
      grand.appendChild(createLeaderboardItem(i+1, m.player_name, `${m.total} pts`));
    });
  }

  document.getElementById('monthlyWinners').innerHTML = "<div>Coming soon</div>";
  document.getElementById('streakBoard').innerHTML = "<div>Coming soon</div>";
  document.getElementById('captainBoard').innerHTML = "<div>Coming soon</div>";
  document.getElementById('gkBoard').innerHTML = "<div>Coming soon</div>";

  await populateRangeLeaderboard('earlyBirdBoard', 1, 10);
  await populateRangeLeaderboard('endgameStrategistBoard', 29, 38);
  await populateBenchWarmerLeaderboard();
  await populateComebackKidLeaderboard();
  document.getElementById('chipMasterBoard').innerHTML = "<div>Coming soon</div>";
}

// Helper to create leaderboard entries
function createLeaderboardItem(rank, name, value) {
  const d = document.createElement('div');
  d.className = 'leaderboard-item';
  d.innerHTML = `
    <span class="leaderboard-rank">#${rank}</span>
    <span class="leaderboard-name">${name}</span>
    <span class="leaderboard-value">${value}</span>
  `;
  return d;
}

// ========== Range Leaderboards ==========
async function populateRangeLeaderboard(divId, gwStart, gwEnd) {
  const div = document.getElementById(divId);
  if (!div) return;
  div.innerHTML = "<div>Loading...</div>";

  const computed = [];
  let hasData = false;
  for (const m of managers) {
    try {
      const hist = await fetchManagerHistory(m.entryId);
      const data = hist.current.filter(r => r.event>=gwStart && r.event<=gwEnd);
      const pts = data.reduce((s,r)=>s+(r.points||0),0);
      if (data.length) hasData = true;
      computed.push({ name: m.displayName, points: pts, gws: data.length });
    } catch {
      computed.push({ name: m.displayName, points:0, gws:0 });
    }
  }

  if (!hasData) {
    div.innerHTML = `<div style="text-align:center;color:#888;padding:20px;">
      🏁 Waiting for GW${gwStart}-${gwEnd} to begin<br>
      <small>Will update automatically once gameweeks begin</small>
    </div>`;
    return;
  }

  computed.sort((a,b)=>b.points - a.points || b.gws - a.gws);
  div.innerHTML = "";
  computed.slice(0,5).forEach((mgr,i)=>{
    const text = mgr.gws>0
      ? `${mgr.points} pts (${mgr.gws} GWs)`
      : "No data yet";
    div.appendChild(createLeaderboardItem(i+1, mgr.name, text));
  });
}

// ========== Bench Warmer ==========
async function populateBenchWarmerLeaderboard() {
  const div = document.getElementById('benchWarmerBoard');
  if (!div) return;
  div.innerHTML = "<div>Loading...</div>";
  const arr = [];
  for (const m of managers) {
    try {
      const hist = await fetchManagerHistory(m.entryId);
      const pts = hist.current.reduce((s,gw)=>s+(gw.points_on_bench||0),0);
      arr.push({ name: m.displayName, points: pts });
    } catch {}
  }
  arr.sort((a,b)=>b.points - a.points);
  div.innerHTML = "";
  arr.slice(0,5).forEach((mgr,i)=>{
    div.appendChild(createLeaderboardItem(i+1, mgr.name, `${mgr.points} pts`));
  });
}

// ========== Comeback Kid ==========
async function populateComebackKidLeaderboard() {
  const div = document.getElementById('comebackKidBoard');
  if (!div) return;
  div.innerHTML = "<div>Loading...</div>";

  let s19=[], s38=[];
  try { s19 = await fetchLeagueStandings(19); } catch{ div.innerHTML="<div>Could not load GW19</div>"; return; }
  try { s38 = await fetchLeagueStandings(38); } catch{ div.innerHTML="<div>Could not load GW38</div>"; return; }

  const r19 = Object.fromEntries(s19.map(s=>[s.entry,s.rank]));
  const r38 = Object.fromEntries(s38.map(s=>[s.entry,s.rank]));

  const diff = [];
  for (const m of managers) {
    if (r19[m.entryId] && r38[m.entryId]) {
      diff.push({ name: m.displayName, up: r19[m.entryId] - r38[m.entryId] });
    }
  }
  diff.sort((a,b)=>b.up - a.up);

  div.innerHTML = "";
  diff.forEach((mgr,i)=>{
    const txt = `${mgr.up>0?"+":""}${mgr.up} places`;
    div.appendChild(createLeaderboardItem(i+1, mgr.name, txt));
  });
}

// ========== League Table ==========
async function populateLeagueTable() {
  const hdr = document.getElementById('currentGWHeader');
  if (hdr) hdr.textContent = "Total Points";
  const tbody = document.getElementById('leagueTableBody');
  if (!tbody) return;
  tbody.innerHTML = "";

  if (leagueStandings.length) {
    leagueStandings.forEach((m,i) => {
      const tr = document.createElement('tr');
      if (m.entry === currentUser?.entryId) tr.classList.add('table-current-user');
      tr.innerHTML = `
        <td class="table-rank">#${i+1}</td>
        <td>${m.player_name || "Unknown"}</td>
        <td>${m.entry_name || "Untitled Team"}</td>
        <td>${m.total}</td>
        <td>${m.total}</td>
        <td>-</td>
      `;
      tbody.appendChild(tr);
    });
  } else {
    tbody.innerHTML = '<tr><td colspan="6">League data not available</td></tr>';
  }
}

// ========== Card Toggle ==========
function toggleExpand(card) {
  const was = card.classList.contains('expanded');
  document.querySelectorAll('.achievement-card.expanded')
    .forEach(c=>c.classList.remove('expanded'));
  if (!was) card.classList.add('expanded');
}
