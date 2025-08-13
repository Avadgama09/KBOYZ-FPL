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

// Proxy base (server.js must be running locally)
const PROXY_ROOT = "http://localhost:5001/api";
// Helper: all FPL paths start with /api/... - FIXED the double /api issue
const FPL = (path) => `${PROXY_ROOT}${path}`;

let currentUser = null;
let leagueStandings = [];

// ---------- Fetch helpers with diagnostics ----------
async function getJson(url) {
  const res = await fetch(url, { credentials: "omit" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText} @ ${url}\nBody: ${text.slice(0, 300)}`);
  }
  const txt = await res.text();
  try { return JSON.parse(txt); }
  catch {
    // Be forgiving if trailing commas sneak in
    return JSON.parse(txt.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]"));
  }
}

async function fetchLeagueStandings(finalEvent = null) {
  let url = FPL(`/leagues-classic/${LEAGUE_ID}/standings/`);
  if (finalEvent) url += `?event=${finalEvent}`;
  console.log("[fetchLeagueStandings] GET", url);
  const data = await getJson(url);

  // Try official standings first
  const standings = data?.standings?.results || [];
  if (standings.length > 0) {
    return standings;
  }

  // Fallback to new_entries before season kickoff
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
  try { return await getJson(url); } catch { return null; }
}

// ------------ LOGIN AND NAVIGATION --------------
document.addEventListener('DOMContentLoaded', initializeApp);

function initializeApp() {
  document.getElementById('loginForm').addEventListener('submit', handleLogin);
  document.getElementById('logoutBtn').addEventListener('click', handleLogout);
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => navigateToSection(btn.getAttribute('data-section')));
  });

  // When opening the League Table tab, (re)render the table
  const leagueBtn = document.querySelector('.nav-btn[data-section="leaguetable"]');
  if (leagueBtn) {
    leagueBtn.addEventListener('click', () => {
      console.log('[nav] leaguetable clicked → populateLeagueTable()');
      populateLeagueTable();
    });
  }

  const savedUser = sessionStorage.getItem('currentUser');
  if (savedUser) {
    currentUser = JSON.parse(savedUser);
    showMainApp();
  } else {
    showLoginScreen();
  }
}

function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('username').value.toLowerCase().trim();
  const password = document.getElementById('password').value;
  const errorDiv = document.getElementById('loginError');
  const manager = managers.find(m => m.username === username);
  if (manager && password === MANAGER_PASSWORD) {
    currentUser = manager;
    sessionStorage.setItem('currentUser', JSON.stringify(manager));
    showMainApp();
    errorDiv.classList.add('hidden');
  } else {
    errorDiv.textContent = "Invalid username or password";
    errorDiv.classList.remove('hidden');
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

function navigateToSection(sectionName) {
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');
  document.querySelectorAll('.main-section').forEach(section => section.classList.remove('active'));
  document.getElementById(sectionName).classList.add('active');
}

// ------------ MAIN: Show app and fetch all -----------
async function showMainApp() {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('mainApp').classList.remove('hidden');
  try {
    leagueStandings = await fetchLeagueStandings();
    console.log("[showMainApp] standings loaded:", leagueStandings?.length);
  } catch (e) {
    console.error("fetchLeagueStandings FAILED:", e);
    alert("Couldn't load live league data.");
  }
  await updateUserHeader();
  await populateDashboardTiles();
  await populateAchievements();

  // Ensure DOM is present; render table once after login
  setTimeout(() => {
    console.log('[init] populateLeagueTable()');
    populateLeagueTable();
  }, 0);
}

// ========== HEADER/DASHBOARD MINICARD ==========
async function updateUserHeader() {
  let welcome = "Manager";
  if (currentUser?.entryId) {
    try {
      const entryData = await fetchManagerEntry(currentUser.entryId);
      welcome = `${entryData.player_first_name} ${entryData.player_last_name}`;
      const r = document.getElementById('currentRank');
      const p = document.getElementById('currentPoints');
      const t = document.getElementById('teamName');
      if (r) r.textContent = entryData.summary_overall_rank ? `#${entryData.summary_overall_rank}` : "#–";
      if (p) p.textContent = entryData.summary_overall_points ? `${entryData.summary_overall_points.toLocaleString()} pts` : "–";
      if (t) t.textContent = entryData.name || "–";
    } catch {
      welcome = currentUser.displayName || "Manager";
    }
  } else {
    welcome = currentUser?.displayName || "Manager";
  }
  const uw = document.getElementById('userWelcome');
  if (uw) uw.textContent = `Welcome, ${welcome}`;
}

// ========== DASHBOARD TILES LOGIC ==========
async function populateDashboardTiles() {
  if (!currentUser) return;
  const fill = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  fill('currentRank', '--'); fill('currentPoints', '-- pts'); fill('teamName', '--');
  fill('lastGWPoints', '-- pts'); fill('lastGWAvg', ''); fill('lastGWCaption', '');
  fill('nextGWDeadline', '--'); fill('nextGWCountdown', '--'); fill('nextCaptainFixture', '--');
  fill('freeTransfers', '-- Free Transfers'); fill('bankValue', 'Bank: --');

  let entryData, histData, bootstrap;
  try {
    [entryData, histData, bootstrap] = await Promise.all([
      fetchManagerEntry(currentUser.entryId),
      fetchManagerHistory(currentUser.entryId),
      fetchBootstrap()
    ]);
  } catch (e) {
    console.error("Dashboard bootstrap failed:", e);
    return;
  }

  fill('currentRank', entryData.summary_overall_rank ? `#${entryData.summary_overall_rank}` : '--');
  fill('currentPoints', entryData.summary_overall_points ? `${entryData.summary_overall_points} pts` : '-- pts');
  fill('teamName', entryData.name || '--');

  const now = new Date();
  const events = bootstrap.events || [];
  const lastFinishedGW = [...events].reverse().find(ev => ev.finished === true);
  const nextGW = events.find(ev => new Date(ev.deadline_time) > now && ev.finished === false);

  if (lastFinishedGW) {
    const gwRow = histData.current?.find(r => r.event === lastFinishedGW.id);
    fill('lastGWPoints', gwRow ? `${gwRow.points} pts` : '-- pts');
    if (typeof lastFinishedGW.average_entry_score === "number") {
      fill('lastGWAvg', `(League avg: ${lastFinishedGW.average_entry_score} pts)`);
    }
    let lastCaptain = '--';
    try {
      const picks = await fetchTeamPicks(currentUser.entryId, lastFinishedGW.id);
      if (picks?.picks?.length) {
        const capId = picks.picks.find(p => p.is_captain)?.element;
        const player = bootstrap.elements?.find(e => e.id === capId);
        if (player) lastCaptain = player.web_name;
      }
    } catch {}
    fill('lastGWCaption', `Captain: ${lastCaptain}`);
  }

  if (nextGW) {
    const deadlineDate = new Date(nextGW.deadline_time);
    fill('nextGWDeadline', deadlineDate.toLocaleString('en-GB', {
      weekday: 'short', hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric'
    }));
    const diff = deadlineDate - Date.now();
    if (diff > 0) {
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff / 3600000) % 24);
      const mins = Math.floor((diff / 60000) % 60);
      fill('nextGWCountdown', `in ${days}d ${hours}h ${mins}m`);
    } else {
      fill('nextGWCountdown', 'Deadline passed!');
    }
    let nextCaptain = '--';
    try {
      const picks = await fetchTeamPicks(currentUser.entryId, nextGW.id);
      if (picks?.picks?.length) {
        const capId = picks.picks.find(p => p.is_captain)?.element;
        const player = bootstrap.elements?.find(e => e.id === capId);
        if (player) nextCaptain = player.web_name;
      }
    } catch {}
    fill('nextCaptainFixture', `Captain: ${nextCaptain}`);
  }

  if (histData?.current?.length) {
    const currGW = histData.current[histData.current.length - 1];
    if (typeof currGW?.event_transfers === "number") {
      fill('freeTransfers', `${currGW.event_transfers} Free Transfers`);
    }
  }
  fill('bankValue', entryData.bank ? `Bank: £${(entryData.bank / 10).toFixed(1)}m` : "Bank: --");
}

// ========== ACHIEVEMENT LEADERBOARDS ==========
async function populateAchievements() {
  const grandDiv = document.getElementById('grandChampionBoard');
  if (grandDiv) {
    grandDiv.innerHTML = "";
    if (leagueStandings?.length) {
      leagueStandings.slice(0, 3).forEach((mgr, i) => {
        grandDiv.appendChild(createLeaderboardItem(i + 1, mgr.player_name, `${mgr.total} pts`));
      });
    }
  }
  const monthlyDiv = document.getElementById('monthlyWinners');
  if (monthlyDiv) monthlyDiv.innerHTML = "<div>Coming soon</div>";
  const streakDiv = document.getElementById('streakBoard');
  if (streakDiv) streakDiv.innerHTML = "<div>Coming soon (streak calculation)</div>";
  const captainDiv = document.getElementById('captainBoard');
  if (captainDiv) captainDiv.innerHTML = "<div>Coming soon (captain points)</div>";
  const gkDiv = document.getElementById('gkBoard');
  if (gkDiv) gkDiv.innerHTML = "<div>Coming soon (GK points)</div>";

  await populateRangeLeaderboard('earlyBirdBoard', 1, 10);
  await populateRangeLeaderboard('endgameStrategistBoard', 29, 38);
  await populateBenchWarmerLeaderboard();
  await populateComebackKidLeaderboard();
  const chipDiv = document.getElementById('chipMasterBoard');
  if (chipDiv) chipDiv.innerHTML = "<div>Coming soon (chip calculation)</div>";
}

function createLeaderboardItem(rank, name, value) {
  const item = document.createElement('div');
  item.className = 'leaderboard-item';
  item.innerHTML = `
    <span class="leaderboard-rank">#${rank}</span>
    <span class="leaderboard-name">${name}</span>
    <span class="leaderboard-value">${value}</span>
  `;
  return item;
}

async function populateRangeLeaderboard(divId, gwStart, gwEnd) {
  const div = document.getElementById(divId);
  if (!div) return;
  
  // Show loading state
  div.innerHTML = "<div>Loading...</div>";
  
  const computed = [];
  let hasAnyData = false;
  
  for (const m of managers) {
    try {
      const hist = await fetchManagerHistory(m.entryId);
      const gwData = (hist.current || []).filter(r => r.event >= gwStart && r.event <= gwEnd);
      const points = gwData.reduce((sum, r) => sum + (r.points || 0), 0);
      
      if (gwData.length > 0) hasAnyData = true;
      computed.push({ 
        name: m.displayName, 
        points,
        gwsPlayed: gwData.length 
      });
    } catch {
      computed.push({ name: m.displayName, points: 0, gwsPlayed: 0 });
    }
  }
  
  // If no gameweek data exists yet
  if (!hasAnyData) {
    div.innerHTML = `<div style="text-align: center; color: #888; padding: 20px;">
      🏁 Waiting for GW${gwStart}-${gwEnd} to begin<br>
      <small>Will update automatically once gameweeks begin</small>
    </div>`;
    return;
  }
  
  // Sort by points, then by GWs played as tiebreaker
  computed.sort((a, b) => b.points - a.points || b.gwsPlayed - a.gwsPlayed);
  
  div.innerHTML = "";
  computed.slice(0, 5).forEach((mgr, idx) => {
    const valueText = mgr.gwsPlayed > 0 ? 
      `${mgr.points} pts (${mgr.gwsPlayed} GWs)` : 
      'No data yet';
    div.appendChild(createLeaderboardItem(idx + 1, mgr.name, valueText));
  });
}

async function populateBenchWarmerLeaderboard() {
  const div = document.getElementById('benchWarmerBoard');
  if (!div) return;
  div.innerHTML = "<div>Loading...</div>";
  const computed = [];
  for (const m of managers) {
    try {
      const hist = await fetchManagerHistory(m.entryId);
      const benchPts = (hist.current || []).reduce((sum, gw) => sum + (gw.points_on_bench || 0), 0);
      computed.push({ name: m.displayName, points: benchPts });
    } catch {}
  }
  computed.sort((a, b) => b.points - a.points);
  div.innerHTML = "";
  computed.slice(0, 5).forEach((mgr, idx) => {
    div.appendChild(createLeaderboardItem(idx + 1, mgr.name, `${mgr.points} pts`));
  });
}

async function populateComebackKidLeaderboard() {
  const div = document.getElementById('comebackKidBoard');
  if (!div) return;
  div.innerHTML = "<div>Loading...</div>";
  let standings19 = [], standings38 = [];
  try { standings19 = await fetchLeagueStandings(19); } catch { div.innerHTML = "<div>Could not load GW19 data</div>"; return; }
  try { standings38 = await fetchLeagueStandings(38); } catch { div.innerHTML = "<div>Could not load GW38 data</div>"; return; }
  const rankAtGW19 = {}; standings19.forEach(s => { rankAtGW19[s.entry] = s.rank; });
  const rankAtGW38 = {}; standings38.forEach(s => { rankAtGW38[s.entry] = s.rank; });
  const improvement = [];
  for (const m of managers) {
    const e = m.entryId;
    if (typeof rankAtGW19[e] === 'number' && typeof rankAtGW38[e] === 'number') {
      improvement.push({ name: m.displayName, up: rankAtGW19[e] - rankAtGW38[e] });
    }
  }
  improvement.sort((a, b) => b.up - a.up);
  div.innerHTML = "";
  improvement.forEach((mgr, idx) => {
    div.appendChild(createLeaderboardItem(idx + 1, mgr.name, `${mgr.up > 0 ? "+" : ""}${mgr.up} places`));
  });
}

// ========== LEAGUE TABLE ==========
async function populateLeagueTable() {
  const hdr = document.getElementById('currentGWHeader');
  if (hdr) hdr.textContent = "Total Points";
  const tbody = document.getElementById('leagueTableBody');
  if (!tbody) { console.warn("[populateLeagueTable] #leagueTableBody not found"); return; }
  tbody.innerHTML = '';
  console.log('League standings:', leagueStandings);

  if (leagueStandings && leagueStandings.length) {
    leagueStandings.forEach((m, idx) => {
      const row = document.createElement('tr');
      if (matchEntry(m, currentUser)) row.className = 'table-current-user';
      row.innerHTML = `
        <td class="table-rank">#${idx + 1}</td>
        <td>${m.player_name || "Unknown"}</td>
        <td>${m.entry_name || "Untitled Team"}</td>
        <td>${m.total}</td>
        <td>${m.total}</td>
        <td>-</td>
      `;
      tbody.appendChild(row);
    });
  } else {
    tbody.innerHTML = '<tr><td colspan="6">League data not available</td></tr>';
  }
}

function matchEntry(standing, user) {
  return (user?.entryId && standing.entry === user.entryId) ||
    (standing.player_name && user?.displayName && standing.player_name.toLowerCase().includes(user.displayName.toLowerCase()));
}

// ========== ACHIEVEMENT CARD EXPAND/COLLAPSE ==========
function toggleExpand(card) {
  const already = card.classList.contains('expanded');
  document.querySelectorAll('.achievement-card.expanded').forEach(c => c.classList.remove('expanded'));
  if (!already) card.classList.add('expanded');
}
