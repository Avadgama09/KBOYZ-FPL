// ============================================
// K-BOYZ FPL 2025/26 - Production App.js
// ============================================

// ------------ CONFIGURATION --------------
const CONFIG = {
  // Manager data
  managers: [
    { username: "rahulsani", entryId: 6379954, displayName: "Rahul Sani" },
    { username: "shaktimelwani", entryId: 5919446, displayName: "Shakti Melwani" },
    { username: "utsavbachani", entryId: 4687835, displayName: "Utsav Bachani" },
    { username: "puravdesai", entryId: 1102461, displayName: "Purav Desai" },
    { username: "ashishvishwakarma", entryId: 569159, displayName: "Ashish Vishwakarma" },
    { username: "marmikajmera", entryId: 4508155, displayName: "Marmik Ajmera" },
    { username: "kaushikbudhelia", entryId: 1800696, displayName: "Kaushik Budhelia" },
    { username: "sidhvickshivalkar", entryId: 1037289, displayName: "Sidhvick Shivalkar" },
    { username: "sagarpanjwani", entryId: 3886462, displayName: "Sagar Panjwani" },
    { username: "harshilbagdai", entryId: 2188411, displayName: "Harshil Bagdai" },
    { username: "siddheshnaringrekar", entryId: 6645307, displayName: "Siddhesh Naringrekar" },
    { username: "amanjangid", entryId: 7772100, displayName: "Aman Jangid" },
    { username: "ashishvadgama", entryId: 539005, displayName: "Ashish Vadgama" },
  ],

  // League settings
  MANAGER_PASSWORD: "kboyz2025",
  LEAGUE_ID: 976735,

  // Prize configuration - single source of truth
  PRIZES: {
    grandChampion: { 
      first: 4500, 
      second: 3500, 
      third: 2500,
      description: "Awarded to the managers ranked 1st–3rd in the final overall league standings."
    },
    managerOfMonth: { 
      amount: 2000,
      description: "Highest total points in each calendar month across the season."
    },
    streakSpecialist: {
      amount: 1000,
      description: "Manager with the longest consecutive run of above-average weekly scores."
    },
    eliteTactician: {
      amount: 2000,
      description: "Based on best combined captain and goalkeeper point choices all season."
    },
    earlyBird: {
      amount: 1500,
      description: "Manager with the most points scored in the opening 10 GWs."
    },
    endgameStrategist: {
      amount: 1500,
      description: "Manager with the most points in the final 10 gameweeks of the season."
    },
    benchWarmer: {
      amount: 1000,
      description: "Celebrates the manager who left the highest total points on their bench all season."
    },
    comebackKid: {
      amount: 1000,
      description: "Manager who improved their ranking the most from midseason (GW19) to the end (GW38)."
    },
    chipMaster: {
      amount: 1500,
      description: "Award for maximizing the chips (Free Hit, Bench Boost, Triple Captain, etc.) throughout the season."
    }
  },

  // API settings
  PROXY_ROOT: (() => {
    const isLocal = window.location.hostname === 'localhost' || 
                   window.location.hostname === '127.0.0.1';
    return isLocal ? 'http://localhost:5001/api' : '/api';
  })(),

  // Cache settings
  CACHE_DURATION: {
    BOOTSTRAP: 30 * 60 * 1000, // 30 minutes
    ENTRY: 5 * 60 * 1000,      // 5 minutes
    STANDINGS: 5 * 60 * 1000   // 5 minutes
  }
};

// ------------ STATE MANAGEMENT --------------
const AppState = {
  currentUser: null,
  leagueStandings: [],
  bootstrapData: null,
  isLoading: false,
  lastUpdateTime: null,
  cache: new Map(),

  // Reset state
  reset() {
    this.currentUser = null;
    this.leagueStandings = [];
    this.bootstrapData = null;
    this.isLoading = false;
    this.lastUpdateTime = null;
    this.cache.clear();
  },

  // Cache management
  setCache(key, data, duration = CONFIG.CACHE_DURATION.ENTRY) {
    const item = {
      data,
      timestamp: Date.now(),
      duration
    };
    this.cache.set(key, item);
  },

  getCache(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() - item.timestamp > item.duration) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }
};

// ------------ UTILITY FUNCTIONS --------------
const Utils = {
  // Helper: Generate FPL API URLs
  FPL: (path) => `${CONFIG.PROXY_ROOT}${path}`,

  // Safe element update
  updateElement: (id, value) => {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
      element.setAttribute('aria-live', 'polite');
    }
  },

  // Format currency
  formatCurrency: (amount) => `₹${amount.toLocaleString()}`,

  // Format date
  formatDate: (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-GB', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  },

  // Calculate time difference
  getTimeRemaining: (targetDate) => {
    const now = Date.now();
    const diff = new Date(targetDate) - now;

    if (diff <= 0) return 'Deadline passed!';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return `in ${days}d ${hours}h ${minutes}m`;
  },

  // Debounce function
  debounce: (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  // Loading state management
  setLoadingState: (isLoading) => {
    AppState.isLoading = isLoading;
    if (window.FPLUtils) {
      window.FPLUtils.setGlobalLoadingState(isLoading);
    }
  },

  // Error handling
  handleError: (error, context = '') => {
    console.error(`[${context}] Error:`, error);
    if (window.FPLUtils) {
      window.FPLUtils.showErrorToast(
        `Failed to load ${context}. Please try again.`
      );
    }
  }
};

// ------------ API FUNCTIONS --------------
const API = {
  // Generic JSON fetch with caching
  async fetchJSON(url, cacheKey = null, cacheDuration = CONFIG.CACHE_DURATION.ENTRY) {
    // Check cache first
    if (cacheKey) {
      const cached = AppState.getCache(cacheKey);
      if (cached) return cached;
    }

    const response = await fetch(url, { 
      credentials: "omit",
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`HTTP ${response.status} ${response.statusText} @ ${url}\nBody: ${text.slice(0, 300)}`);
    }

    const textResponse = await response.text();
    let jsonData;

    try {
      jsonData = JSON.parse(textResponse);
    } catch {
      // Handle malformed JSON with trailing commas
      jsonData = JSON.parse(
        textResponse.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]")
      );
    }

    // Cache the result
    if (cacheKey) {
      AppState.setCache(cacheKey, jsonData, cacheDuration);
    }

    return jsonData;
  },

  // Fetch league standings
  async fetchLeagueStandings(finalEvent = null) {
    let url = Utils.FPL(`/leagues-classic/${CONFIG.LEAGUE_ID}/standings/`);
    if (finalEvent) url += `?event=${finalEvent}`;

    console.log("[API] Fetching league standings:", url);
    const cacheKey = `standings_${finalEvent || 'current'}`;

    const data = await this.fetchJSON(url, cacheKey, CONFIG.CACHE_DURATION.STANDINGS);

    const standings = data?.standings?.results || [];
    if (standings.length > 0) {
      return standings;
    }

    const newEntries = data?.new_entries?.results || [];
    console.warn("[API] No standings yet, using new_entries:", newEntries.length);

    return newEntries.map((entry, index) => ({
      entry: entry.entry,
      entry_name: entry.entry_name,
      player_name: `${entry.player_first_name} ${entry.player_last_name}`,
      total: 0,
      rank: index + 1
    }));
  },

  // Fetch manager entry data
  async fetchManagerEntry(entryId) {
    const url = Utils.FPL(`/entry/${entryId}/`);
    const cacheKey = `entry_${entryId}`;
    console.log("[API] Fetching manager entry:", url);
    return await this.fetchJSON(url, cacheKey);
  },

  // Fetch manager history
  async fetchManagerHistory(entryId) {
    const url = Utils.FPL(`/entry/${entryId}/history/`);
    const cacheKey = `history_${entryId}`;
    console.log("[API] Fetching manager history:", url);
    return await this.fetchJSON(url, cacheKey);
  },

  // Fetch bootstrap data
  async fetchBootstrap() {
    const url = Utils.FPL(`/bootstrap-static/`);
    const cacheKey = 'bootstrap';
    console.log("[API] Fetching bootstrap data:", url);
    return await this.fetchJSON(url, cacheKey, CONFIG.CACHE_DURATION.BOOTSTRAP);
  },

  // Fetch team picks for a specific gameweek
  async fetchTeamPicks(entryId, event) {
    const url = Utils.FPL(`/entry/${entryId}/event/${event}/picks/`);
    const cacheKey = `picks_${entryId}_${event}`;
    console.log("[API] Fetching team picks:", url);

    try {
      return await this.fetchJSON(url, cacheKey);
    } catch (error) {
      console.warn(`[API] Failed to fetch picks for entry ${entryId}, GW ${event}:`, error.message);
      return null;
    }
  }
};

// ------------ AUTHENTICATION --------------
const Auth = {
  // Handle login form submission
  handleLogin(event) {
    event.preventDefault();

    const username = document.getElementById('username').value.toLowerCase().trim();
    const password = document.getElementById('password').value;
    const errorElement = document.getElementById('loginError');

    const manager = CONFIG.managers.find(m => m.username === username);

    if (manager && password === CONFIG.MANAGER_PASSWORD) {
      AppState.currentUser = manager;
      sessionStorage.setItem('currentUser', JSON.stringify(manager));
      this.showMainApp();
      errorElement.classList.add('hidden');
    } else {
      errorElement.textContent = "Invalid username or password";
      errorElement.classList.remove('hidden');

      // Clear password field for security
      document.getElementById('password').value = '';
    }
  },

  // Handle logout
  handleLogout() {
    AppState.reset();
    sessionStorage.removeItem('currentUser');
    this.showLoginScreen();
  },

  // Show login screen
  showLoginScreen() {
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('mainApp').classList.add('hidden');

    // Focus username field for accessibility
    setTimeout(() => {
      const usernameField = document.getElementById('username');
      if (usernameField) usernameField.focus();
    }, 100);
  },

  // Show main application
  async showMainApp() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');

    Utils.setLoadingState(true);

    try {
      // Load core data
      await Promise.all([
        this.loadBootstrapData(),
        this.loadLeagueData()
      ]);

      // Update UI components
      await Promise.all([
        Dashboard.updateUserHeader(),
        Dashboard.populateDashboardTiles(),
        Achievements.populateAchievements()
      ]);

      AppState.lastUpdateTime = new Date();
      this.updateTimestamps();

    } catch (error) {
      Utils.handleError(error, 'main app initialization');
    } finally {
      Utils.setLoadingState(false);

      // Load league table in background
      setTimeout(() => LeagueTable.populate(), 0);
    }
  },

  // Load bootstrap data
  async loadBootstrapData() {
    try {
      AppState.bootstrapData = await API.fetchBootstrap();
      console.log("[Auth] Bootstrap data loaded:", AppState.bootstrapData.events?.length, 'gameweeks');
    } catch (error) {
      Utils.handleError(error, 'bootstrap data');
      throw error;
    }
  },

  // Load league standings
  async loadLeagueData() {
    try {
      AppState.leagueStandings = await API.fetchLeagueStandings();
      console.log("[Auth] League standings loaded:", AppState.leagueStandings.length, 'entries');
    } catch (error) {
      Utils.handleError(error, 'league standings');
      throw error;
    }
  },

  // Update all timestamps
  updateTimestamps() {
    if (!AppState.lastUpdateTime) return;

    const timeString = AppState.lastUpdateTime.toLocaleTimeString();
    const elements = ['lastUpdateTime', 'achievementsUpdateTime', 'leagueUpdateTime'];

    elements.forEach(id => {
      Utils.updateElement(id, `Last updated: ${timeString}`);
    });
  },

  // Initialize authentication
  init() {
    // Check for existing session
    const savedUser = sessionStorage.getItem('currentUser');
    if (savedUser) {
      try {
        AppState.currentUser = JSON.parse(savedUser);
        this.showMainApp();
        return;
      } catch (error) {
        console.warn('[Auth] Invalid saved session, clearing...');
        sessionStorage.removeItem('currentUser');
      }
    }

    this.showLoginScreen();
  }
};

// ------------ DASHBOARD MANAGEMENT --------------
const Dashboard = {
  // Update user header information
  async updateUserHeader() {
    let welcome = "Manager";

    if (AppState.currentUser?.entryId) {
      try {
        const data = await API.fetchManagerEntry(AppState.currentUser.entryId);
        welcome = `${data.player_first_name} ${data.player_last_name}`;
      } catch (error) {
        console.warn('[Dashboard] Failed to load manager name:', error.message);
        welcome = AppState.currentUser.displayName;
      }
    }

    Utils.updateElement('userWelcome', `Welcome, ${welcome}`);
  },

  // Populate all dashboard tiles
  async populateDashboardTiles() {
    if (!AppState.currentUser) return;

    // Show loading state
    this.setTileLoadingState(true);

    try {
      const [entryData, histData] = await Promise.all([
        API.fetchManagerEntry(AppState.currentUser.entryId),
        API.fetchManagerHistory(AppState.currentUser.entryId)
      ]);

      // Update basic stats
      Utils.updateElement('currentRank', 
        entryData.summary_overall_rank ? `#${entryData.summary_overall_rank.toLocaleString()}` : "Unranked"
      );
      Utils.updateElement('currentPoints', 
        `${(entryData.summary_overall_points || 0).toLocaleString()} pts`
      );
      Utils.updateElement('teamName', entryData.name || "Unknown Team");

      // Update gameweek-specific information
      await this.updateGameweekInfo(entryData, histData);

      // Update transfer information
      this.updateTransferInfo(entryData, histData);

    } catch (error) {
      Utils.handleError(error, 'dashboard tiles');
      this.setTileErrorState();
    } finally {
      this.setTileLoadingState(false);
    }
  },

  // Update gameweek-related information
  async updateGameweekInfo(entryData, histData) {
    if (!AppState.bootstrapData?.events) return;

    const events = AppState.bootstrapData.events;
    const now = new Date();

    const lastGW = [...events].reverse().find(ev => ev.finished);
    const nextGW = events.find(ev => new Date(ev.deadline_time) > now && !ev.finished);

    // Last gameweek information
    if (lastGW && histData?.current) {
      const gwData = histData.current.find(r => r.event === lastGW.id);

      Utils.updateElement('lastGWPoints', 
        gwData ? `${gwData.points} pts` : "0 pts"
      );
      Utils.updateElement('lastGWAvg', 
        ` (League avg: ${lastGW.average_entry_score || 0} pts)`
      );

      // Get captain information
      try {
        const captain = await this.getCaptainInfo(AppState.currentUser.entryId, lastGW.id);
        Utils.updateElement('lastGWCaption', `Captain: ${captain}`);
      } catch {
        Utils.updateElement('lastGWCaption', 'Captain: Unknown');
      }
    } else {
      Utils.updateElement('lastGWPoints', 'No data');
      Utils.updateElement('lastGWAvg', '');
      Utils.updateElement('lastGWCaption', '');
    }

    // Next gameweek information
    if (nextGW) {
      const deadline = new Date(nextGW.deadline_time);

      Utils.updateElement('nextGWDeadline', Utils.formatDate(deadline));
      Utils.updateElement('nextGWCountdown', Utils.getTimeRemaining(deadline));

      // Get next captain
      try {
        const captain = await this.getCaptainInfo(AppState.currentUser.entryId, nextGW.id);
        Utils.updateElement('nextCaptainFixture', `Captain: ${captain}`);
      } catch {
        Utils.updateElement('nextCaptainFixture', 'Captain: Not set');
      }
    } else {
      Utils.updateElement('nextGWDeadline', 'Season ended');
      Utils.updateElement('nextGWCountdown', '');
      Utils.updateElement('nextCaptainFixture', '');
    }
  },

  // Get captain information
  async getCaptainInfo(entryId, gameweek) {
    const picks = await API.fetchTeamPicks(entryId, gameweek);
    if (!picks?.picks || !AppState.bootstrapData?.elements) {
      return 'Unknown';
    }

    const captainPick = picks.picks.find(p => p.is_captain);
    if (!captainPick) return 'Not set';

    const player = AppState.bootstrapData.elements.find(e => e.id === captainPick.element);
    return player?.web_name || 'Unknown';
  },

  // Update transfer information
  updateTransferInfo(entryData, histData) {
    // Free transfers
    if (histData?.current?.length) {
      const latest = histData.current[histData.current.length - 1];
      Utils.updateElement('freeTransfers', 
        `${latest.event_transfers || 1} Free Transfer${latest.event_transfers !== 1 ? 's' : ''}`
      );
    } else {
      Utils.updateElement('freeTransfers', '1 Free Transfer');
    }

    // Bank value
    const bankValue = entryData.bank ? (entryData.bank / 10).toFixed(1) : '0.0';
    Utils.updateElement('bankValue', `Bank: £${bankValue}m`);
  },

  // Set loading state for tiles
  setTileLoadingState(isLoading) {
    const tiles = document.querySelectorAll('.dashboard-tile');
    tiles.forEach(tile => {
      if (isLoading) {
        tile.classList.add('loading');
      } else {
        tile.classList.remove('loading');
      }
    });
  },

  // Set error state for tiles
  setTileErrorState() {
    const errorElements = [
      'currentRank', 'currentPoints', 'teamName',
      'lastGWPoints', 'nextGWDeadline', 'freeTransfers'
    ];

    errorElements.forEach(id => {
      Utils.updateElement(id, 'Error');
    });
  }
};

// ------------ ACHIEVEMENTS MANAGEMENT --------------
// Monthly gameweek mapping for 2025/26 season
const monthlyGameweeks = {
  'August': { start: 1, end: 3 },
  'September': { start: 4, end: 6 },
  'October': { start: 7, end: 9 },
  'November': { start: 10, end: 12 },
  'December': { start: 13, end: 17 },
  'January': { start: 18, end: 22 },
  'February': { start: 23, end: 26 },
  'March': { start: 27, end: 30 },
  'April': { start: 31, end: 35 },
  'May': { start: 36, end: 38 }
};

// Get current month based on gameweek
function getCurrentMonth(currentGW) {
  for (const [month, data] of Object.entries(monthlyGameweeks)) {
    if (currentGW >= data.start && currentGW <= data.end) {
      return month;
    }
  }
  return 'May'; // Default to last month if beyond GW38
}

// Manager of the Month state
let managerOfTheMonthExpanded = false;
let streakSpecialistExpanded = false;
let chipMasterExpanded = false;
let benchWarmerExpanded = false;
let eliteTacticianExpanded = false;
let cachedStreakData = null;
let cachedManagerOfTheMonthData = null;

const Achievements = {
  // Populate all achievements
  async populateAchievements() {
        // Clear cached data when repopulating
    cachedManagerOfTheMonthData = null;
    console.log('[Achievements] Populating achievements...');

    try {
      // Grand Champion (always available)
      this.populateGrandChampion();

      // Other achievements based on current gameweek
      const currentGW = this.getCurrentGameweek();

      await Promise.all([
      this.populateEarlyBird(currentGW),
      this.populateEndgameStrategist(currentGW),
      this.populateBenchWarmer(currentGW),
      this.populateComebackKid(currentGW),
      this.populateManagerOfTheMonth(currentGW),
      this.populateStreakSpecialist(currentGW),
      this.populateChipMaster(currentGW),
      this.populateEliteTactician(currentGW),
      this.populateComingSoon()
      ]);

    } catch (error) {
      Utils.handleError(error, 'achievements');
    }
  },

  // Get current gameweek
  getCurrentGameweek() {
    if (!AppState.bootstrapData?.events) return 1;

    const currentEvent = AppState.bootstrapData.events.find(e => !e.finished);
    return currentEvent ? currentEvent.id : AppState.bootstrapData.events.length;
  },

  // Populate Grand Champion
  populateGrandChampion() {
    const board = document.querySelector('#grandChampionBoard .board-live');
    if (!board) return;

    const prizeInfo = CONFIG.PRIZES.grandChampion;

    board.innerHTML = `
      <div class="achievement-description">${prizeInfo.description}</div>
      <div class="prize-breakdown">
        <div>1st: ${Utils.formatCurrency(prizeInfo.first)}</div>
        <div>2nd: ${Utils.formatCurrency(prizeInfo.second)}</div>
        <div>3rd: ${Utils.formatCurrency(prizeInfo.third)}</div>
      </div>
    `;

    // Add top 3 managers
    AppState.leagueStandings.slice(0, 3).forEach((manager, index) => {
      const item = this.createLeaderboardItem(
        index + 1,
        manager.player_name,
        `${manager.total} pts`
      );
      board.appendChild(item);
    });
  },

  // Populate Early Bird achievement
  async populateEarlyBird(currentGW) {
    const board = document.querySelector('#earlyBirdBoard .board-live');
    if (!board) return;

    const gwsCounted = Math.min(currentGW, 10);
    const prizeInfo = CONFIG.PRIZES.earlyBird;

    board.innerHTML = `
      <div class="achievement-description">${prizeInfo.description}</div>
      <div class="progress-indicator">${gwsCounted}/10 GWs counted</div>
    `;

    if (gwsCounted === 0) {
      board.innerHTML += '<div class="coming-soon">Competition starts GW1</div>';
      return;
    }

    try {
      const leaderboard = await this.calculateRangeLeaderboard(1, 10);
      this.renderLeaderboard(board, leaderboard.slice(0, 5));
    } catch (error) {
      board.innerHTML += '<div class="error">Failed to calculate Early Bird standings</div>';
    }
  },

  // Populate Endgame Strategist
  async populateEndgameStrategist(currentGW) {
    const board = document.querySelector('#endgameStrategistBoard .board-live');
    if (!board) return;

    const prizeInfo = CONFIG.PRIZES.endgameStrategist;

    if (currentGW < 29) {
      board.innerHTML = `
        <div class="achievement-description">${prizeInfo.description}</div>
        <div class="coming-soon">Opens after GW29</div>
      `;
      return;
    }

    const gwsCounted = Math.max(0, currentGW - 28);

    board.innerHTML = `
      <div class="achievement-description">${prizeInfo.description}</div>
      <div class="progress-indicator">${gwsCounted}/10 GWs counted</div>
    `;

    try {
      const leaderboard = await this.calculateRangeLeaderboard(29, 38);
      this.renderLeaderboard(board, leaderboard.slice(0, 5));
    } catch (error) {
      board.innerHTML += '<div class="error">Failed to calculate Endgame standings</div>';
    }
  },

  // Calculate leaderboard for a range of gameweeks
  async calculateRangeLeaderboard(startGW, endGW) {
    const results = [];

    for (const manager of CONFIG.managers) {
      try {
        const history = await API.fetchManagerHistory(manager.entryId);
        if (!history?.current) continue;

        const rangeData = history.current.filter(gw => 
          gw.event >= startGW && gw.event <= endGW
        );

        const total = rangeData.reduce((sum, gw) => sum + gw.points, 0);

        results.push({
          name: manager.displayName,
          total: total,
          gwCount: rangeData.length,
          isCurrentUser: manager.entryId === AppState.currentUser?.entryId
        });
      } catch (error) {
        console.warn(`[Achievements] Failed to fetch history for ${manager.displayName}:`, error.message);
      }
    }

    return results.sort((a, b) => b.total - a.total);
  },

  // Populate Bench Warmer
  async populateBenchWarmer(currentGW) {
    const board = document.querySelector('#benchWarmerBoard .board-live');
    if (!board) return;

    const prizeInfo = CONFIG.PRIZES.benchWarmer;

    try {
      board.innerHTML = `
        <div class="achievement-description">${prizeInfo.description}</div>
        <div class="prize-amount">${Utils.formatCurrency(prizeInfo.amount)}</div>
      `;

      // Calculate bench data
      const data = await this.calculateBenchWarmer(currentGW);
      
      if (data && data.leaderboard.length > 0) {
        board.innerHTML += `
          <div class="bench-warmer-container ${benchWarmerExpanded ? 'expanded' : ''}" onclick="toggleBenchWarmer()">
            ${this.displayBenchWarmer(data, benchWarmerExpanded)}
          </div>
        `;
        
        // Cache the data for toggle
        window.cachedBenchData = data;
      } else {
        board.innerHTML += '<div class="coming-soon">Bench data loading...</div>';
      }
    } catch (error) {
      console.error('[Achievements] Failed to calculate Bench Warmer:', error);
      board.innerHTML = `
        <div class="achievement-description">${prizeInfo.description}</div>
        <div class="error">Failed to load bench data</div>
      `;
    }
  },


  // Populate Comeback Kid
  async populateComebackKid(currentGW) {
    const board = document.querySelector('#comebackKidBoard .board-live');
    if (!board) return;

    const prizeInfo = CONFIG.PRIZES.comebackKid;

    if (currentGW < 19) {
      board.innerHTML = `
        <div class="achievement-description">${prizeInfo.description}</div>
        <div class="coming-soon">Opens after GW19</div>
      `;
      return;
    }

    board.innerHTML = `
      <div class="achievement-description">${prizeInfo.description}</div>
      <div class="coming-soon">Comeback tracking coming soon</div>
    `;
  try {
    // Fetch standings for GW19 and current
    const [gw19Standings, currentStandings] = await Promise.all([
      API.fetchLeagueStandings(19),  // Midseason standings
      API.fetchLeagueStandings()      // Current standings
    ]);

    // Calculate rank improvements
    const improvements = [];
    
    for (const manager of CONFIG.managers) {
      const gw19Entry = gw19Standings.find(s => s.entry === manager.entryId);
      const currentEntry = currentStandings.find(s => s.entry === manager.entryId);
      
      if (gw19Entry && currentEntry) {
        const gw19Rank = gw19Entry.rank || gw19Standings.indexOf(gw19Entry) + 1;
        const currentRank = currentEntry.rank || currentStandings.indexOf(currentEntry) + 1;
        const improvement = gw19Rank - currentRank; // Positive = improved
        
        improvements.push({
          name: manager.displayName,
          gw19Rank,
          currentRank,
          improvement,
          isCurrentUser: manager.entryId === AppState.currentUser?.entryId
        });
      }
    }
    
    // Sort by improvement (biggest improvers first)
    improvements.sort((a, b) => b.improvement - a.improvement);
    
    // Render leaderboard
    board.innerHTML += `
      <div class="comeback-header">
        <span>Manager</span>
        <span>GW19 → Now</span>
        <span>Change</span>
      </div>
    `;
    
    improvements.slice(0, 5).forEach((item, index) => {
      const changeClass = item.improvement > 0 ? 'improvement' : item.improvement < 0 ? 'decline' : 'no-change';
      const arrow = item.improvement > 0 ? '↑' : item.improvement < 0 ? '↓' : '→';
      
      const element = document.createElement('div');
      element.className = `leaderboard-item ${item.isCurrentUser ? 'current-user-row' : ''}`;
      element.innerHTML = `
        <span class="leaderboard-rank">#${index + 1}</span>
        <span class="leaderboard-name">${item.name}</span>
        <span class="rank-change">${item.gw19Rank} → ${item.currentRank}</span>
        <span class="improvement-badge ${changeClass}">
          ${arrow} ${Math.abs(item.improvement)} ${item.improvement !== 0 ? (item.improvement > 0 ? 'places' : 'places') : 'same'}
        </span>
      `;
      board.appendChild(element);
    });
    
  } catch (error) {
    console.error('[Achievements] Failed to calculate Comeback Kid:', error);
    board.innerHTML += '<div class="error">Failed to load comeback standings</div>';
  }
},

    // Calculate Elite Tactician data
  async calculateEliteTactician(currentGW) {
    console.log('[Achievements] Calculating Elite Tactician for GW', currentGW);
    
    const eliteData = {};
    
    // Initialize data for all managers
    for (const manager of CONFIG.managers) {
      eliteData[manager.entryId] = {
        name: manager.displayName,
        captainPoints: 0,
        gkPoints: 0,
        combined: 0,
        captainHistory: [],
        gkHistory: [],
        bestCaptainGW: { gw: 0, points: 0, player: '' },
        bestGKGW: { gw: 0, points: 0, player: '' },
        isCurrentUser: manager.entryId === AppState.currentUser?.entryId
      };
    }
    
    // Process each manager
    for (const manager of CONFIG.managers) {
      try {
        // Process each gameweek
        for (let gw = 1; gw <= currentGW; gw++) {
          try {
            // Get picks for this gameweek
            const picks = await API.fetchTeamPicks(manager.entryId, gw);
            if (!picks?.picks) continue;
            
            // Find and calculate CAPTAIN points
            const captain = picks.picks.find(p => p.is_captain);
            if (captain) {
              // Captain points are already doubled in the API response
              const captainPoints = captain.multiplier * (captain.stats?.total_points || 0);
              const playerInfo = AppState.bootstrapData?.elements?.find(e => e.id === captain.element);
              const captainName = playerInfo?.web_name || `Player ${captain.element}`;
              
              eliteData[manager.entryId].captainPoints += captainPoints;
              eliteData[manager.entryId].captainHistory.push({
                gw,
                points: captainPoints,
                player: captainName
              });
              
              // Track best captain gameweek
              if (captainPoints > eliteData[manager.entryId].bestCaptainGW.points) {
                eliteData[manager.entryId].bestCaptainGW = {
                  gw,
                  points: captainPoints,
                  player: captainName
                };
              }
            }
            
            // Find and calculate GOALKEEPER points
            // Position 1 = GK, and position <= 11 means they're starting
            const startingGK = picks.picks.find(p => 
              p.position === 1 && p.position <= 11
            );
            
            if (startingGK) {
              const gkPoints = startingGK.stats?.total_points || 0;
              const playerInfo = AppState.bootstrapData?.elements?.find(e => e.id === startingGK.element);
              const gkName = playerInfo?.web_name || `Player ${startingGK.element}`;
              
              eliteData[manager.entryId].gkPoints += gkPoints;
              eliteData[manager.entryId].gkHistory.push({
                gw,
                points: gkPoints,
                player: gkName
              });
              
              // Track best GK gameweek
              if (gkPoints > eliteData[manager.entryId].bestGKGW.points) {
                eliteData[manager.entryId].bestGKGW = {
                  gw,
                  points: gkPoints,
                  player: gkName
                };
              }
            }
            
          } catch (error) {
            console.warn(`Failed to fetch GW${gw} picks for ${manager.displayName}:`, error);
          }
        }
        
        // Calculate combined score
        eliteData[manager.entryId].combined = 
          eliteData[manager.entryId].captainPoints + 
          eliteData[manager.entryId].gkPoints;
        
      } catch (error) {
        console.warn(`Failed to process elite data for ${manager.displayName}:`, error);
      }
    }
    
    // Convert to array and sort by combined score
    const eliteLeaderboard = Object.entries(eliteData)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.combined - a.combined);
    
    // Calculate rankings and gaps
    eliteLeaderboard.forEach((manager, index) => {
      manager.rank = index + 1;
      manager.gapToFirst = eliteLeaderboard[0].combined - manager.combined;
      manager.gapToThird = index < 3 ? 0 : eliteLeaderboard[2].combined - manager.combined;
    });
    
    // Create separate captain and GK rankings
    const captainRankings = [...eliteLeaderboard].sort((a, b) => b.captainPoints - a.captainPoints);
    const gkRankings = [...eliteLeaderboard].sort((a, b) => b.gkPoints - a.gkPoints);
    
    // Add captain and GK specific rankings
    captainRankings.forEach((manager, index) => {
      const mainData = eliteLeaderboard.find(m => m.id === manager.id);
      if (mainData) {
        mainData.captainRank = index + 1;
        mainData.captainGapToFirst = captainRankings[0].captainPoints - manager.captainPoints;
      }
    });
    
    gkRankings.forEach((manager, index) => {
      const mainData = eliteLeaderboard.find(m => m.id === manager.id);
      if (mainData) {
        mainData.gkRank = index + 1;
        mainData.gkGapToFirst = gkRankings[0].gkPoints - manager.gkPoints;
      }
    });
    
    return {
      leaderboard: eliteLeaderboard,
      captainLeaders: captainRankings.slice(0, 3),
      gkLeaders: gkRankings.slice(0, 3),
      currentGW
    };
  },

  // Display Elite Tactician
  displayEliteTactician(data, isExpanded = false) {
    if (!data) return '<div class="coming-soon">Calculating elite scores...</div>';
    
    const { leaderboard, captainLeaders, gkLeaders } = data;
    const currentUser = leaderboard.find(m => m.isCurrentUser);
    
    // Exclude top 2 overall managers
    const eligibleManagers = leaderboard.filter((m, index) => {
      const overallStanding = AppState.leagueStandings.findIndex(s => 
        s.entry === parseInt(m.id) || s.player_name === m.name
      );
      return overallStanding > 1; // Index 0 and 1 are top 2
    });
    
    if (!isExpanded) {
      // Collapsed view - show top 3 eligible
      const top3HTML = eligibleManagers.slice(0, 3).map((manager, index) => {
        const position = `#${index + 1}`;
        const highlightClass = manager.isCurrentUser ? 'current-user-row' : '';
        
        return `
          <div class="leaderboard-item ${highlightClass}">
            <span class="leaderboard-rank">${position}</span>
            <span class="leaderboard-name">${manager.name}</span>
            <span class="leaderboard-value">${manager.combined} pts</span>
            <span class="elite-breakdown">C: ${manager.captainPoints} | GK: ${manager.gkPoints}</span>
          </div>
        `;
      }).join('');
      
      const userTracking = currentUser ? `
        <div class="user-elite-tracking">
          <div class="elite-stat">
            <span>Your Captain Points:</span> 
            <strong>${currentUser.captainPoints}</strong> 
            <span class="rank-info">(Rank #${currentUser.captainRank}, -${currentUser.captainGapToFirst} from leader)</span>
          </div>
          <div class="elite-stat">
            <span>Your GK Points:</span> 
            <strong>${currentUser.gkPoints}</strong>
            <span class="rank-info">(Rank #${currentUser.gkRank}, -${currentUser.gkGapToFirst} from leader)</span>
          </div>
          <div class="elite-stat combined">
            <span>Combined Elite Score:</span> 
            <strong>${currentUser.combined}</strong> 
            <span class="rank-info">(Rank #${currentUser.rank})</span>
          </div>
          ${currentUser.gapToThird > 0 ? `
            <div class="gap-info">
              Points to 3rd place: <strong>-${currentUser.gapToThird}</strong> | 
              Points to 1st place: <strong>-${currentUser.gapToFirst}</strong>
            </div>
          ` : ''}
        </div>
      ` : '';
      
      return `
        <div class="elite-header">Elite Tactician Leaderboard</div>
        <div class="elite-note">*Top 2 overall managers excluded</div>
        ${userTracking}
        <div class="elite-leaderboard">
          ${top3HTML}
        </div>
        <div class="expand-hint">Click for detailed breakdown</div>
      `;
    } else {
      // Expanded view - detailed breakdown with separate tables
      const captainTableHTML = captainLeaders.map((manager, index) => {
        const highlightClass = manager.isCurrentUser ? 'highlighted-row' : '';
        return `
          <tr class="${highlightClass}">
            <td>#${index + 1}</td>
            <td>${manager.name}</td>
            <td><strong>${manager.captainPoints}</strong></td>
            <td>${manager.bestCaptainGW.player} (${manager.bestCaptainGW.points} pts, GW${manager.bestCaptainGW.gw})</td>
          </tr>
        `;
      }).join('');
      
      const gkTableHTML = gkLeaders.map((manager, index) => {
        const highlightClass = manager.isCurrentUser ? 'highlighted-row' : '';
        return `
          <tr class="${highlightClass}">
            <td>#${index + 1}</td>
            <td>${manager.name}</td>
            <td><strong>${manager.gkPoints}</strong></td>
            <td>${manager.bestGKGW.player} (${manager.bestGKGW.points} pts, GW${manager.bestGKGW.gw})</td>
          </tr>
        `;
      }).join('');
      
      const combinedTableHTML = eligibleManagers.map((manager, index) => {
        const highlightClass = manager.isCurrentUser ? 'highlighted-row' : '';
        return `
          <tr class="${highlightClass}">
            <td>#${index + 1}</td>
            <td>${manager.name}</td>
            <td>${manager.captainPoints}</td>
            <td>${manager.gkPoints}</td>
            <td class="total-cell"><strong>${manager.combined}</strong></td>
            <td>${manager.gapToFirst > 0 ? `-${manager.gapToFirst}` : 'Leader'}</td>
          </tr>
        `;
      }).join('');
      
      return `
        <div class="expanded-header">Elite Tactician Analysis</div>
        
        <div class="elite-tables-grid">
          <div class="elite-table-section">
            <h4>Top Captaincy</h4>
            <table class="elite-sub-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Manager</th>
                  <th>Total</th>
                  <th>Best Captain GW</th>
                </tr>
              </thead>
              <tbody>
                ${captainTableHTML}
              </tbody>
            </table>
          </div>
          
          <div class="elite-table-section">
            <h4>Top Goalkeepers</h4>
            <table class="elite-sub-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Manager</th>
                  <th>Total</th>
                  <th>Best GK GW</th>
                </tr>
              </thead>
              <tbody>
                ${gkTableHTML}
              </tbody>
            </table>
          </div>
        </div>
        
        <div class="elite-combined-section">
          <h4>Combined Elite Rankings (Eligible Managers)</h4>
          <table class="elite-combined-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Manager</th>
                <th>Captain Pts</th>
                <th>GK Pts</th>
                <th>Combined</th>
                <th>Gap to 1st</th>
              </tr>
            </thead>
            <tbody>
              ${combinedTableHTML}
            </tbody>
          </table>
        </div>
        
        <div class="collapse-hint">Click to collapse</div>
      `;
    }
  },

  // Calculate Bench Warmer data
  async calculateBenchWarmer(currentGW) {
    console.log('[Achievements] Calculating Bench Warmer for GW', currentGW);
    
    const benchData = {};
    
    // Initialize data for all managers
    for (const manager of CONFIG.managers) {
      benchData[manager.entryId] = {
        name: manager.displayName,
        totalBenchPoints: 0,
        weeklyBench: [],
        highestBenchGW: { gw: 0, points: 0 },
        isCurrentUser: manager.entryId === AppState.currentUser?.entryId
      };
    }
    
    // Process each manager
    for (const manager of CONFIG.managers) {
      try {
        // Get manager's history to check for BB usage
        const history = await API.fetchManagerHistory(manager.entryId);
        const bbGameweeks = history?.chips?.filter(c => c.name === 'bboost').map(c => c.event) || [];
        
        // Process each gameweek
        for (let gw = 1; gw <= currentGW; gw++) {
          // Skip if Bench Boost was used this GW
          if (bbGameweeks.includes(gw)) {
            benchData[manager.entryId].weeklyBench.push({
              gw: gw,
              points: 0,
              note: 'BB Used'
            });
            continue;
          }
          
          try {
            // Get picks for this gameweek
            const picks = await API.fetchTeamPicks(manager.entryId, gw);
            if (!picks?.picks) continue;
            
            // Find bench players (positions 12-15)
            const benchPlayers = picks.picks.filter(p => p.position > 11);
            
            // Calculate total bench points
            let gwBenchPoints = 0;
            const benchDetails = [];
            
            for (const player of benchPlayers) {
              const playerPoints = player.stats?.total_points || 0;
              gwBenchPoints += playerPoints;
              
              // Get player name from bootstrap data if available
              const playerInfo = AppState.bootstrapData?.elements?.find(e => e.id === player.element);
              benchDetails.push({
                name: playerInfo?.web_name || `Player ${player.element}`,
                points: playerPoints
              });
            }
            
            // Update totals
            benchData[manager.entryId].totalBenchPoints += gwBenchPoints;
            benchData[manager.entryId].weeklyBench.push({
              gw: gw,
              points: gwBenchPoints,
              players: benchDetails
            });
            
            // Track highest bench GW
            if (gwBenchPoints > benchData[manager.entryId].highestBenchGW.points) {
              benchData[manager.entryId].highestBenchGW = {
                gw: gw,
                points: gwBenchPoints
              };
            }
            
          } catch (error) {
            console.warn(`Failed to fetch GW${gw} picks for ${manager.displayName}:`, error);
          }
        }
        
      } catch (error) {
        console.warn(`Failed to process bench data for ${manager.displayName}:`, error);
      }
    }
    
    // Convert to array and sort by total bench points
    const benchLeaderboard = Object.entries(benchData)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.totalBenchPoints - a.totalBenchPoints);
    
    return {
      leaderboard: benchLeaderboard,
      currentGW
    };
  },

  // Display Bench Warmer
  displayBenchWarmer(data, isExpanded = false) {
    if (!data) return '<div class="coming-soon">Calculating bench points...</div>';
    
    const { leaderboard, currentGW } = data;
    
    if (!isExpanded) {
      // Collapsed view - show top 5
      const top5HTML = leaderboard.slice(0, 5).map((manager, index) => {
        const position = `#${index + 1}`;
        const highlightClass = manager.isCurrentUser ? 'current-user-row' : '';
        const avgPerGW = Math.round(manager.totalBenchPoints / currentGW);
        
        return `
          <div class="leaderboard-item ${highlightClass}">
            <span class="leaderboard-rank">${position}</span>
            <span class="leaderboard-name">${manager.name}</span>
            <span class="leaderboard-value">${manager.totalBenchPoints} pts</span>
            <span class="bench-avg">~${avgPerGW}/GW</span>
          </div>
        `;
      }).join('');
      
      const currentUserData = leaderboard.find(m => m.isCurrentUser);
      const userInfo = currentUserData ? `
        <div class="user-bench-info">
          Your wasted bench points: <strong>${currentUserData.totalBenchPoints}</strong> | 
          Best bench GW: <strong>${currentUserData.highestBenchGW.points} pts (GW${currentUserData.highestBenchGW.gw})</strong>
        </div>
      ` : '';
      
      return `
        <div class="bench-header">Most Points Left on Bench</div>
        ${userInfo}
        <div class="bench-leaderboard">
          ${top5HTML}
        </div>
        <div class="expand-hint">Click to see weekly breakdown</div>
      `;
    } else {
      // Expanded view - detailed breakdown
      const tableHTML = leaderboard.map((manager, index) => {
        const highlightClass = manager.isCurrentUser ? 'highlighted-row' : '';
        const avgPerGW = (manager.totalBenchPoints / currentGW).toFixed(1);
        
        // Get last 5 GWs bench points for recent form
        const recentForm = manager.weeklyBench
          .slice(-5)
          .map(w => w.note === 'BB Used' ? 'BB' : w.points)
          .join(', ');
        
        return `
          <tr class="${highlightClass}">
            <td class="rank-cell">#${index + 1}</td>
            <td class="name-cell">${manager.name}</td>
            <td class="total-cell"><strong>${manager.totalBenchPoints}</strong></td>
            <td>${avgPerGW}</td>
            <td>${manager.highestBenchGW.points} (GW${manager.highestBenchGW.gw})</td>
            <td class="recent-form">${recentForm}</td>
          </tr>
        `;
      }).join('');
      
      return `
        <div class="expanded-header">Bench Points Analysis</div>
        <div class="bench-table-wrapper">
          <table class="bench-warmer-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Manager</th>
                <th>Total Wasted</th>
                <th>Avg/GW</th>
                <th>Best Bench GW</th>
                <th>Last 5 GWs</th>
              </tr>
            </thead>
            <tbody>
              ${tableHTML}
            </tbody>
          </table>
        </div>
        <div class="bench-note">
          Note: Excludes gameweeks where Bench Boost was active
        </div>
        <div class="collapse-hint">Click to collapse</div>
      `;
    }
  },

  // Calculate Chip Master data
  async calculateChipMaster(currentGW) {
    console.log('[Achievements] Calculating Chip Master for GW', currentGW);
    
    const chipData = {};
    
    // Initialize data structure for all managers
    for (const manager of CONFIG.managers) {
      chipData[manager.entryId] = {
        name: manager.displayName,
        tc_first: { gw: null, points: 0 },
        tc_second: { gw: null, points: 0 },
        bb_first: { gw: null, points: 0 },
        bb_second: { gw: null, points: 0 },
        fh_first: { gw: null, points: 0 },
        fh_second: { gw: null, points: 0 },
        total: 0,
        isCurrentUser: manager.entryId === AppState.currentUser?.entryId
      };
    }
    
    // Fetch history and process chips for each manager
    for (const manager of CONFIG.managers) {
      try {
        const history = await API.fetchManagerHistory(manager.entryId);
        if (!history?.chips) continue;
        
        // Process each chip usage
        for (const chip of history.chips) {
          const gwNumber = chip.event;
          const chipName = chip.name;
          const isFirstHalf = gwNumber <= 19;
          const halfKey = isFirstHalf ? 'first' : 'second';
          
          // Get picks data for this gameweek
          const picks = await API.fetchTeamPicks(manager.entryId, gwNumber);
          if (!picks) continue;
          
          let chipPoints = 0;
          
          switch(chipName) {
            case '3xc': // Triple Captain
              // Find captain and calculate triple points
              const captain = picks.picks?.find(p => p.is_captain);
              if (captain) {
                // The multiplier field tells us the actual points earned
                chipPoints = captain.multiplier * (picks.picks.find(p => p.element === captain.element)?.stats?.total_points || 0);
                // For TC, we show the BONUS points (2x captain points, not 3x)
                const basePoints = picks.picks.find(p => p.element === captain.element)?.stats?.total_points || 0;
                chipPoints = basePoints * 2; // Extra points from TC
              }
              
              chipData[manager.entryId][`tc_${halfKey}`] = {
                gw: gwNumber,
                points: chipPoints
              };
              break;
              
            case 'bboost': // Bench Boost
              // Calculate bench players' points (positions 12-15)
              const benchPlayers = picks.picks?.filter(p => p.position >= 12) || [];
              chipPoints = benchPlayers.reduce((sum, player) => {
                return sum + (player.stats?.total_points || 0);
              }, 0);
              
              chipData[manager.entryId][`bb_${halfKey}`] = {
                gw: gwNumber,
                points: chipPoints
              };
              break;
              
            case 'freehit': // Free Hit
              // For Free Hit, use the total gameweek points
              const gwData = history.current?.find(h => h.event === gwNumber);
              chipPoints = gwData?.points || 0;
              
              chipData[manager.entryId][`fh_${halfKey}`] = {
                gw: gwNumber,
                points: chipPoints
              };
              break;
          }
        }
        
        // Calculate total chip value
        const managerChips = chipData[manager.entryId];
        managerChips.total = 
          managerChips.tc_first.points + managerChips.tc_second.points +
          managerChips.bb_first.points + managerChips.bb_second.points +
          managerChips.fh_first.points + managerChips.fh_second.points;
        
      } catch (error) {
        console.warn(`Failed to fetch chip data for ${manager.displayName}:`, error);
      }
    }
    
    // Convert to array and sort by total chip value
    const chipLeaderboard = Object.entries(chipData)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.total - a.total);
    
    return {
      leaderboard: chipLeaderboard,
      currentGW
    };
  },

  // Display Chip Master
  displayChipMaster(data, isExpanded = false) {
    if (!data) return '<div class="coming-soon">Loading chip data...</div>';
    
    const { leaderboard } = data;
    
    if (!isExpanded) {
      // Collapsed view - show top 5 with total chip value
      const top5HTML = leaderboard.slice(0, 5).map((manager, index) => {
        const position = `#${index + 1}`;
        const highlightClass = manager.isCurrentUser ? 'current-user-row' : '';
        
        // Count chips used
        const chipsUsed = [
          manager.tc_first.gw, manager.tc_second.gw,
          manager.bb_first.gw, manager.bb_second.gw,
          manager.fh_first.gw, manager.fh_second.gw
        ].filter(gw => gw !== null).length;
        
        return `
          <div class="leaderboard-item ${highlightClass}">
            <span class="leaderboard-rank">${position}</span>
            <span class="leaderboard-name">${manager.name}</span>
            <span class="leaderboard-value">${manager.total} pts</span>
            <span class="chips-used">${chipsUsed}/6 chips</span>
          </div>
        `;
      }).join('');
      
      return `
        <div class="chip-header">Chip Master Leaderboard</div>
        <div class="chip-leaderboard">
          ${top5HTML}
        </div>
        <div class="expand-hint">Click to view detailed chip breakdown</div>
      `;
    } else {
      // Expanded view - full table with all chip details
      const tableHTML = leaderboard.map((manager, index) => {
        const highlightClass = manager.isCurrentUser ? 'highlighted-row' : '';
        
        // Helper to format cell
        const formatCell = (chipData) => {
          if (chipData.gw) {
            return `<td class="chip-used"><strong>${chipData.points}</strong><br><span class="gw-label">GW${chipData.gw}</span></td>`;
          }
          return '<td class="chip-unused">-</td>';
        };
        
        return `
          <tr class="${highlightClass}">
            <td class="rank-cell">#${index + 1}</td>
            <td class="name-cell">${manager.name}</td>
            ${formatCell(manager.tc_first)}
            ${formatCell(manager.tc_second)}
            ${formatCell(manager.bb_first)}
            ${formatCell(manager.bb_second)}
            ${formatCell(manager.fh_first)}
            ${formatCell(manager.fh_second)}
            <td class="total-cell"><strong>${manager.total}</strong></td>
          </tr>
        `;
      }).join('');
      
      return `
        <div class="expanded-header">Chip Usage Breakdown</div>
        <div class="chip-table-wrapper">
          <table class="chip-master-table">
            <thead>
              <tr>
                <th rowspan="2">Rank</th>
                <th rowspan="2">Manager</th>
                <th colspan="2">Triple Captain</th>
                <th colspan="2">Bench Boost</th>
                <th colspan="2">Free Hit</th>
                <th rowspan="2">Total</th>
              </tr>
              <tr>
                <th>GW1-19</th>
                <th>GW20-38</th>
                <th>GW1-19</th>
                <th>GW20-38</th>
                <th>GW1-19</th>
                <th>GW20-38</th>
              </tr>
            </thead>
            <tbody>
              ${tableHTML}
            </tbody>
          </table>
        </div>
        <div class="table-legend">
          <span><strong>TC:</strong> Extra captain points</span>
          <span><strong>BB:</strong> Bench points</span>
          <span><strong>FH:</strong> Total GW points</span>
        </div>
        <div class="collapse-hint">Click to collapse</div>
      `;
    }
  },

  // Calculate Streak Specialist data
  async calculateStreakSpecialist(currentGW) {
    console.log('[Achievements] Calculating Streak Specialist for GW', currentGW);
    
    // First, get all managers' histories
    const managersWithHistory = [];
    for (const manager of CONFIG.managers) {
      try {
        const history = await API.fetchManagerHistory(manager.entryId);
        if (history?.current) {
          managersWithHistory.push({
            id: manager.entryId,
            name: manager.displayName,
            history: history.current,
            isCurrentUser: manager.entryId === AppState.currentUser?.entryId
          });
        }
      } catch (error) {
        console.warn(`Failed to fetch history for ${manager.displayName}:`, error);
      }
    }
    
    // Calculate league average for each gameweek
    const leagueAverages = {};
    for (let gw = 1; gw <= currentGW; gw++) {
      let totalPoints = 0;
      let managerCount = 0;
      
      managersWithHistory.forEach(manager => {
        const gwData = manager.history.find(h => h.event === gw);
        if (gwData) {
          totalPoints += gwData.points;
          managerCount++;
        }
      });
      
      leagueAverages[gw] = managerCount > 0 ? Math.round(totalPoints / managerCount) : 0;
    }
    
    // Calculate streaks for each manager
    const streakData = managersWithHistory.map(manager => {
      let currentStreak = 0;
      let maxStreak = 0;
      let streakStart = 0;
      let bestStreakStart = 0;
      let bestStreakEnd = 0;
      const streakHistory = [];
      
      // Track each gameweek's performance
      for (let gw = 1; gw <= currentGW; gw++) {
        const gwData = manager.history.find(h => h.event === gw);
        const gwPoints = gwData ? gwData.points : 0;
        const gwAverage = leagueAverages[gw];
        const isAboveAverage = gwPoints > gwAverage;
        
        if (isAboveAverage) {
          if (currentStreak === 0) {
            streakStart = gw; // Mark start of new streak
          }
          currentStreak++;
          
          // Check if this is the best streak so far
          if (currentStreak > maxStreak) {
            maxStreak = currentStreak;
            bestStreakStart = streakStart;
            bestStreakEnd = gw;
          }
        } else {
          // Streak broken
          if (currentStreak > 0) {
            streakHistory.push({
              start: streakStart,
              end: gw - 1,
              length: currentStreak
            });
          }
          currentStreak = 0;
        }
        
        // Store for display
        streakHistory[gw] = {
          points: gwPoints,
          average: gwAverage,
          aboveAverage: isAboveAverage
        };
      }
      
      // Don't forget to save the current streak if it's still active
      if (currentStreak > 0) {
        streakHistory.push({
          start: streakStart,
          end: currentGW,
          length: currentStreak,
          active: true
        });
      }
      
      return {
        id: manager.id,
        name: manager.name,
        maxStreak,
        currentStreak,
        bestStreakRange: maxStreak > 0 ? `GW${bestStreakStart}-${bestStreakEnd}` : 'None',
        isCurrentUser: manager.isCurrentUser,
        recentForm: streakHistory.slice(-5) // Last 5 GWs for display
      };
    });
    
    // Sort by max streak (descending)
    streakData.sort((a, b) => b.maxStreak - a.maxStreak);
    
    // Get current user's position
    const currentUserData = streakData.find(m => m.isCurrentUser);
    const userPosition = currentUserData ? streakData.indexOf(currentUserData) + 1 : null;
    
    return {
      leaderboard: streakData.slice(0, 5), // Top 5
      leagueAverages,
      currentUserData,
      userPosition,
      currentGW
    };
  },

  // Display Streak Specialist
  displayStreakSpecialist(data, isExpanded = false) {
    if (!data) return '<div class="coming-soon">Calculating streaks...</div>';
    
    const { leaderboard, currentUserData, userPosition } = data;
    
    if (!isExpanded) {
      // Collapsed view - show top 5
      const leaderboardHTML = leaderboard.map((manager, index) => {
        const position = `#${index + 1}`;
        const highlightClass = manager.isCurrentUser ? 'current-user-row' : '';
        const activeIndicator = manager.currentStreak > 0 ? '🔥' : '';
        
        return `
          <div class="leaderboard-item ${highlightClass}">
            <span class="leaderboard-rank">${position}</span>
            <span class="leaderboard-name">${manager.name} ${activeIndicator}</span>
            <span class="leaderboard-value">${manager.maxStreak} GWs</span>
            <span class="streak-range">${manager.bestStreakRange}</span>
          </div>
        `;
      }).join('');
      
      const currentStreakInfo = currentUserData && currentUserData.currentStreak > 0
        ? `<div class="current-streak-alert">🔥 You're on a ${currentUserData.currentStreak} game streak!</div>`
        : '';
      
      return `
        <div class="streak-header">Longest Above-Average Streaks</div>
        ${currentStreakInfo}
        <div class="streak-leaderboard">
          ${leaderboardHTML}
        </div>
        <div class="expand-hint">Click to see detailed streak analysis</div>
      `;
    } else {
      // Expanded view - show detailed analysis
      const detailedHTML = leaderboard.map((manager, index) => {
        const highlightClass = manager.isCurrentUser ? 'highlighted-cell' : '';
        const statusIcon = manager.currentStreak > 0 ? '🔥 Active' : '⏸️ Ended';
        
        return `
          <tr class="${highlightClass}">
            <td>#${index + 1}</td>
            <td>${manager.name}</td>
            <td><strong>${manager.maxStreak} GWs</strong></td>
            <td>${manager.bestStreakRange}</td>
            <td>${manager.currentStreak} GWs</td>
            <td>${statusIcon}</td>
          </tr>
        `;
      }).join('');
      
      const userStats = currentUserData ? `
        <div class="personal-stats">
          <span>Your Best Streak: ${currentUserData.maxStreak} GWs</span>
          <span>Current Streak: ${currentUserData.currentStreak} GWs</span>
          <span>Your Position: #${userPosition}</span>
        </div>
      ` : '';
      
      return `
        <div class="expanded-header">Streak Analysis</div>
        ${userStats}
        <div class="streak-table-wrapper">
          <table class="streak-history-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Manager</th>
                <th>Best Streak</th>
                <th>Period</th>
                <th>Current</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${detailedHTML}
            </tbody>
          </table>
        </div>
        <div class="collapse-hint">Click to collapse</div>
      `;
    }
  },
  // Calculate Manager of the Month data
  async calculateManagerOfTheMonth(currentGW, currentUser) {
    const currentMonth = getCurrentMonth(currentGW);
    const monthData = monthlyGameweeks[currentMonth];
    
    if (!monthData) return null;
    
    // Get all managers data with history
    const managersData = [];
    for (const manager of CONFIG.managers) {
      try {
        const history = await API.fetchManagerHistory(manager.entryId);
        if (history?.current) {
          managersData.push({
            id: manager.entryId,
            player_name: manager.displayName,
            history: history.current
          });
        }
      } catch (error) {
        console.warn(`Failed to fetch history for ${manager.displayName}:`, error);
      }
    }
    
    // Calculate monthly points for all managers
    const monthlyPoints = {};
    const historicalData = {};
    
    // Calculate current month standings
    managersData.forEach(manager => {
      let monthTotal = 0;
      for (let gw = monthData.start; gw <= Math.min(monthData.end, currentGW); gw++) {
        const gwData = manager.history?.find(h => h.event === gw);
        if (gwData) monthTotal += gwData.points;
      }
      monthlyPoints[manager.id] = {
        name: manager.player_name,
        points: monthTotal,
        isCurrentUser: manager.id === currentUser?.entryId
      };
    });
    
    // Sort current month rankings
    const currentRankings = Object.entries(monthlyPoints)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.points - a.points);
    
    // Calculate historical monthly winners for completed months
    Object.keys(monthlyGameweeks).forEach(month => {
      const mData = monthlyGameweeks[month];
      if (mData.end < currentGW) { // Only for completed months
        const monthlyScores = {};
        
        managersData.forEach(manager => {
          let total = 0;
          for (let gw = mData.start; gw <= mData.end; gw++) {
            const gwData = manager.history?.find(h => h.event === gw);
            if (gwData) total += gwData.points;
          }
          monthlyScores[manager.id] = {
            name: manager.player_name,
            points: total,
            isCurrentUser: manager.id === currentUser?.entryId
          };
        });
        
        const monthRankings = Object.entries(monthlyScores)
          .map(([id, data]) => ({ id, ...data }))
          .sort((a, b) => b.points - a.points)
          .slice(0, 3);
          
        historicalData[month] = monthRankings;
      }
    });
    
    // Calculate personal stats for current user
    let personalStats = null;
    if (currentUser) {
      const wins = Object.values(historicalData).filter(month => 
        month[0] && month[0].id === currentUser.entryId
      ).length;
      
      const topThrees = Object.values(historicalData).filter(month => 
        month.some(manager => manager.id === currentUser.entryId)
      ).length;
      
      const nearMisses = Object.values(historicalData).filter(month => {
        const winner = month[0];
        if (!winner || winner.id === currentUser.entryId) return false;
        
        const userInMonth = month.find(m => m.id === currentUser.entryId);
        if (!userInMonth) {
          // Calculate user's points manually for that month
          const monthName = Object.keys(historicalData).find(m => historicalData[m] === month);
          const monthGWs = monthlyGameweeks[monthName];
          const userManager = managersData.find(m => m.id === currentUser.entryId);
          
          if (userManager && monthGWs) {
            let userPoints = 0;
            for (let gw = monthGWs.start; gw <= monthGWs.end; gw++) {
              const gwData = userManager.history?.find(h => h.event === gw);
              if (gwData) userPoints += gwData.points;
            }
            return winner.points - userPoints <= 15;
          }
        }
        
        return winner.points - (userInMonth?.points || 0) <= 15;
      }).length;
      
      const allMonthlyScores = [];
      
      // Add historical monthly scores
      Object.values(historicalData).forEach(month => {
        const userInMonth = month.find(m => m.id === currentUser.entryId);
        if (userInMonth) allMonthlyScores.push(userInMonth.points);
      });
      
      // Add current month score
      const currentUserRanking = currentRankings.find(r => r.id === currentUser.entryId);
      if (currentUserRanking) allMonthlyScores.push(currentUserRanking.points);
      
      const bestMonth = allMonthlyScores.length > 0 ? Math.max(...allMonthlyScores) : 0;
      
      personalStats = { wins, topThrees, nearMisses, bestMonth };
    }
    
    // Calculate catch-up info
    const leader = currentRankings[0];
    const currentUserData = currentRankings.find(r => r.isCurrentUser);
    const pointsToWin = currentUserData && leader.id !== currentUserData.id 
      ? leader.points - currentUserData.points 
      : 0;
    
    const gwsRemaining = Math.max(0, monthData.end - currentGW);
    const daysRemaining = gwsRemaining * 7; // Approximate
    
    return {
      currentMonth,
      currentTop3: currentRankings.slice(0, 3),
      historicalData,
      personalStats,
      catchUp: {
        pointsToWin,
        leaderName: leader?.name || 'Unknown',
        gwsRemaining,
        daysRemaining
      }
    };
  },

  // Display Manager of the Month
    displayManagerOfTheMonth(data, isExpanded = false) {
    if (!data) return '<div class="coming-soon">Loading...</div>';
    
    const { currentMonth, currentTop3, historicalData, personalStats, catchUp } = data;
    
    if (!isExpanded) {
      // Default collapsed view - clean like Grand Champion
      const top3HTML = currentTop3.map((manager, index) => {
        const position = `#${index + 1}`;
        const highlightClass = manager.isCurrentUser ? 'current-user-row' : '';
        return `
          <div class="leaderboard-item ${highlightClass}">
            <span class="leaderboard-rank">${position}</span>
            <span class="leaderboard-name">${manager.name}</span>
            <span class="leaderboard-value">${manager.points} pts</span>
          </div>
        `;
      }).join('');
      
      const catchUpText = catchUp.pointsToWin > 0 
        ? `${catchUp.pointsToWin} points to beat ${catchUp.leaderName} | ${catchUp.gwsRemaining} GWs left`
        : `You're leading ${currentMonth}!`;
      
      return `
        <div class="month-header">${currentMonth}</div>
        <div class="current-standings">
          ${top3HTML}
        </div>
        <div class="catch-up-info">${catchUpText}</div>
        <div class="expand-hint">Click to view historical data</div>
      `;
    } else {
      // Expanded view with historical table
      const hasHistoricalData = Object.keys(historicalData).length > 0;
      
      const historicalHTML = hasHistoricalData ? Object.entries(historicalData).map(([month, rankings]) => {
        const winner = rankings[0] || { name: 'N/A', points: 0, isCurrentUser: false };
        const runnerUp1 = rankings[1] || { name: 'N/A', points: 0, isCurrentUser: false };
        const runnerUp2 = rankings[2] || { name: 'N/A', points: 0, isCurrentUser: false };
        
        const winnerClass = winner.isCurrentUser ? 'highlighted-cell' : '';
        const runner1Class = runnerUp1.isCurrentUser ? 'highlighted-cell' : '';
        const runner2Class = runnerUp2.isCurrentUser ? 'highlighted-cell' : '';
        
        return `
          <tr>
            <td>${month}</td>
            <td class="${winnerClass}">${winner.name} (${winner.points})</td>
            <td class="${runner1Class}">${runnerUp1.name} (${runnerUp1.points})</td>
            <td class="${runner2Class}">${runnerUp2.name} (${runnerUp2.points})</td>
          </tr>
        `;
      }).join('') : '<tr><td colspan="4" class="no-data">No completed months yet</td></tr>';
      
      const personalStatsHTML = personalStats ? `
        <div class="personal-stats">
          <span>Monthly Wins: ${personalStats.wins}</span>
          <span>Top 3 Finishes: ${personalStats.topThrees}</span>
          <span>Best Score: ${personalStats.bestMonth}</span>
        </div>
      ` : '';
      
      return `
        <div class="expanded-header">Historical Data</div>
        ${personalStatsHTML}
        <div class="historical-table-wrapper">
          <table class="monthly-history-table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Winner</th>
                <th>Runner-up</th>
                <th>3rd Place</th>
              </tr>
            </thead>
            <tbody>
              ${historicalHTML}
            </tbody>
          </table>
        </div>
        <div class="collapse-hint">Click to collapse</div>
      `;
    }
  },

  // Populate Manager of the Month
  async populateManagerOfTheMonth(currentGW) {
    const board = document.querySelector('#monthlyWinners .board-live');
    if (!board) return;

    const prizeInfo = CONFIG.PRIZES.managerOfMonth;

    try {
      // Calculate data
      const data = await this.calculateManagerOfTheMonth(currentGW, AppState.currentUser);
      cachedManagerOfTheMonthData = data;

            if (data) {
        board.innerHTML = `
          <div class="manager-of-month-container ${managerOfTheMonthExpanded ? 'expanded' : ''}" onclick="toggleManagerOfTheMonth()">
            ${this.displayManagerOfTheMonth(data, managerOfTheMonthExpanded)}
          </div>
        `;
      } else {
        board.innerHTML = `
          <div class="coming-soon">Manager of the Month tracking starting soon</div>
        `;
      }

    } catch (error) {
      console.error('[Achievements] Failed to calculate Manager of the Month:', error);
      board.innerHTML = `
        <div class="achievement-description">${prizeInfo.description}</div>
        <div class="error">Failed to load monthly standings</div>
      `;
    }
  },
  
    // Populate Streak Specialist
  async populateStreakSpecialist(currentGW) {
    const board = document.querySelector('#streakBoard .board-live');
    if (!board) return;

    const prizeInfo = CONFIG.PRIZES.streakSpecialist;

    try {
      board.innerHTML = `
        <div class="achievement-description">${prizeInfo.description}</div>
        <div class="prize-amount">${Utils.formatCurrency(prizeInfo.amount)}</div>
      `;

      // Calculate streak data
      const data = await this.calculateStreakSpecialist(currentGW);
      
      if (data && data.leaderboard.length > 0) {
        board.innerHTML += `
          <div class="streak-specialist-container ${streakSpecialistExpanded ? 'expanded' : ''}" onclick="toggleStreakSpecialist()">
            ${this.displayStreakSpecialist(data, streakSpecialistExpanded)}
          </div>
        `;
        
        // Cache the data for toggle
        window.cachedStreakData = data;
      } else {
        board.innerHTML += '<div class="coming-soon">Not enough data yet</div>';
      }
    } catch (error) {
      console.error('[Achievements] Failed to calculate Streak Specialist:', error);
      board.innerHTML = `
        <div class="achievement-description">${prizeInfo.description}</div>
        <div class="error">Failed to load streak data</div>
      `;
    }
  },

     // Populate Chip Master
  async populateChipMaster(currentGW) {
    const board = document.querySelector('#chipMasterBoard .board-live');
    if (!board) return;

    const prizeInfo = CONFIG.PRIZES.chipMaster;

    try {
      board.innerHTML = `
        <div class="achievement-description">${prizeInfo.description}</div>
        <div class="prize-amount">${Utils.formatCurrency(prizeInfo.amount)}</div>
      `;

      // Calculate chip data
      const data = await this.calculateChipMaster(currentGW);
      
      if (data && data.leaderboard.length > 0) {
        board.innerHTML += `
          <div class="chip-master-container ${chipMasterExpanded ? 'expanded' : ''}" onclick="toggleChipMaster()">
            ${this.displayChipMaster(data, chipMasterExpanded)}
          </div>
        `;
        
        // Cache the data for toggle
        window.cachedChipData = data;
      } else {
        board.innerHTML += '<div class="coming-soon">Chip data will appear as chips are used</div>';
      }
    } catch (error) {
      console.error('[Achievements] Failed to calculate Chip Master:', error);
      board.innerHTML = `
        <div class="achievement-description">${prizeInfo.description}</div>
        <div class="error">Failed to load chip data</div>
      `;
    }
  },


      // Populate Elite Tactician
  async populateEliteTactician(currentGW) {
    const board = document.querySelector('#captainBoard .board-live');
    if (!board) return;

    const prizeInfo = CONFIG.PRIZES.eliteTactician;

    try {
      board.innerHTML = `
        <div class="achievement-description">${prizeInfo.description}</div>
        <div class="prize-amount">${Utils.formatCurrency(prizeInfo.amount)}</div>
      `;

      // Calculate elite data
      const data = await this.calculateEliteTactician(currentGW);
      
      if (data && data.leaderboard.length > 0) {
        board.innerHTML += `
          <div class="elite-tactician-container ${eliteTacticianExpanded ? 'expanded' : ''}" onclick="toggleEliteTactician()">
            ${this.displayEliteTactician(data, eliteTacticianExpanded)}
          </div>
        `;
        
        // Cache the data
        window.cachedEliteData = data;
      } else {
        board.innerHTML += '<div class="coming-soon">Elite data loading...</div>';
      }
    } catch (error) {
      console.error('[Achievements] Failed to calculate Elite Tactician:', error);
      board.innerHTML = `
        <div class="achievement-description">${prizeInfo.description}</div>
        <div class="error">Failed to load elite data</div>
      `;
    }
  },

  // Populate coming soon achievements
  populateComingSoon() {
        const comingSoonIds = [
      'streakBoard',
      'captainBoard', 
      'gkBoard',
      'chipMasterBoard'
    ];

    comingSoonIds.forEach(id => {
      const board = document.querySelector(`#${id} .board-live`);
      if (board) {
        board.innerHTML = '<div class="coming-soon">Data will be available after more gameweeks</div>';
      }
    });
  },

  // Create leaderboard item element
  createLeaderboardItem(rank, name, value, extra = '') {
    const item = document.createElement('div');
    item.className = 'leaderboard-item';

    // Check if this is current user
    const isCurrentUser = AppState.currentUser && 
      (name === AppState.currentUser.displayName || 
       name.toLowerCase().includes(AppState.currentUser.displayName.toLowerCase()));

    if (isCurrentUser) {
      item.classList.add('current-user-row');
    }

    item.innerHTML = `
      <span class="leaderboard-rank">#${rank}</span>
      <span class="leaderboard-name">${name}</span>
      <span class="leaderboard-value">${value}</span>
      ${extra ? `<span class="leaderboard-extra">${extra}</span>` : ''}
    `;

    return item;
  },

  // Render leaderboard items
  renderLeaderboard(container, items) {
    items.forEach((item, index) => {
      const element = this.createLeaderboardItem(
        index + 1,
        item.name,
        `${item.total} pts`,
        item.gwCount ? `(${item.gwCount} GWs)` : ''
      );
      container.appendChild(element);
    });
  }
};

// ------------ LEAGUE TABLE MANAGEMENT --------------
const LeagueTable = {
  // Populate league table
  async populate() {
    const tbody = document.getElementById('leagueTableBody');
    if (!tbody) return;

    // Show loading state
    tbody.innerHTML = '<tr><td colspan="5" class="text-center loading-row">Loading league table...</td></tr>';

    try {
      // Get additional data for last GW points
      const historyPromises = CONFIG.managers.map(async manager => {
        try {
          const history = await API.fetchManagerHistory(manager.entryId);
          return { entryId: manager.entryId, history };
        } catch {
          return { entryId: manager.entryId, history: null };
        }
      });

      const historyData = await Promise.all(historyPromises);
      const historyMap = new Map(
        historyData.map(item => [item.entryId, item.history])
      );

      // Clear loading state
      tbody.innerHTML = '';

      // Populate table rows
      AppState.leagueStandings.forEach((standing, index) => {
        const manager = CONFIG.managers.find(m => 
          standing.entry === m.entryId ||
          standing.player_name.toLowerCase().includes(m.displayName.toLowerCase())
        );

        const history = manager ? historyMap.get(manager.entryId) : null;
        const lastGW = history?.current?.[history.current.length - 1];
        const isCurrentUser = manager?.entryId === AppState.currentUser?.entryId;

        const row = document.createElement('tr');
        row.setAttribute('role', 'row');

        if (isCurrentUser) {
          row.classList.add('current-user-row');
        }

        // Add trophy icon for top 3
        const trophyIcon = index < 3 ? '<span class="trophy-icon" aria-label="Top 3 position">🏆</span>' : '';

        row.innerHTML = `
          <td class="rank-cell" data-label="Rank">${trophyIcon}#${standing.rank || index + 1}</td>
          <td data-label="Manager">${standing.player_name}</td>
          <td data-label="Team">${standing.entry_name}</td>
          <td data-label="Total Points"><strong>${standing.total.toLocaleString()}</strong></td>
          <td data-label="Last GW">${lastGW ? lastGW.points : '-'} pts</td>
        `;

        tbody.appendChild(row);
      });

    } catch (error) {
      Utils.handleError(error, 'league table');
      tbody.innerHTML = '<tr><td colspan="5" class="text-center error">Failed to load league table. Please refresh the page.</td></tr>';
    }
  }
};

// ------------ NAVIGATION MANAGEMENT --------------
const Navigation = {
  // Initialize navigation
  init() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => this.navigateToSection(btn.dataset.section));
    });
  },

  // Navigate to section
  navigateToSection(sectionId) {
    // Update active nav button
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.remove('active');
      btn.removeAttribute('aria-current');
    });

    const activeBtn = document.querySelector(`[data-section="${sectionId}"]`);
    if (activeBtn) {
      activeBtn.classList.add('active');
      activeBtn.setAttribute('aria-current', 'page');
    }

    // Show target section
    document.querySelectorAll('.main-section').forEach(section => {
      section.classList.remove('active');
    });

    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
      targetSection.classList.add('active');
    }

    // Special handling for league table
    if (sectionId === 'leaguetable') {
      setTimeout(() => LeagueTable.populate(), 100);
    }
  }
};

// ------------ APPLICATION INITIALIZATION --------------
const App = {
  // Initialize the application
  init() {
    console.log('[App] Initializing K-BOYZ FPL App...');

    // Set up event listeners
    this.setupEventListeners();

    // Initialize navigation
    Navigation.init();

    // Initialize authentication
    Auth.init();

    // Set up periodic updates
    this.setupPeriodicUpdates();

    console.log('[App] Initialization complete');
  },

  // Set up all event listeners
  setupEventListeners() {
    // Login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', Auth.handleLogin.bind(Auth));
    }

    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', Auth.handleLogout.bind(Auth));
    }

    // Handle visibility change for performance
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && AppState.currentUser) {
        // Refresh data when tab becomes visible
        this.refreshData();
      }
    });

    // Handle online/offline events
    window.addEventListener('online', () => {
      console.log('[App] Connection restored, refreshing data...');
      this.refreshData();
    });

    window.addEventListener('offline', () => {
      console.log('[App] Connection lost');
      if (window.FPLUtils) {
        window.FPLUtils.showErrorToast('Connection lost. Some features may not work.');
      }
    });
  },

  // Set up periodic updates
  setupPeriodicUpdates() {
    // Update countdown every minute
    setInterval(() => {
      if (AppState.currentUser && AppState.bootstrapData?.events) {
        const nextGW = AppState.bootstrapData.events.find(ev => 
          new Date(ev.deadline_time) > new Date() && !ev.finished
        );

        if (nextGW) {
          Utils.updateElement('nextGWCountdown', Utils.getTimeRemaining(nextGW.deadline_time));
        }
      }
    }, 60000); // Every minute

    // Refresh data every 10 minutes
    setInterval(() => {
      if (AppState.currentUser && !document.hidden) {
        this.refreshData();
      }
    }, 10 * 60 * 1000); // Every 10 minutes
  },

  // Refresh data
  refreshData: Utils.debounce(async function() {
    if (!AppState.currentUser || AppState.isLoading) return;

    console.log('[App] Refreshing data...');

    try {
      // Clear some cache to get fresh data
      AppState.cache.clear();

      await Promise.all([
        Dashboard.populateDashboardTiles(),
        Auth.loadLeagueData()
      ]);

      AppState.lastUpdateTime = new Date();
      Auth.updateTimestamps();

    } catch (error) {
      console.warn('[App] Data refresh failed:', error);
    }
  }, 5000)
};

// ------------ APPLICATION STARTUP --------------
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

// Toggle function for Manager of the Month
function toggleManagerOfTheMonth() {
  managerOfTheMonthExpanded = !managerOfTheMonthExpanded;
  
  // Re-render with cached data
  if (cachedManagerOfTheMonthData) {
    const board = document.querySelector('#monthlyWinners .board-live');
    if (board) {
      const prizeInfo = CONFIG.PRIZES.managerOfMonth;
      board.innerHTML = `
        <div class="manager-of-month-container ${managerOfTheMonthExpanded ? 'expanded' : ''}" onclick="toggleManagerOfTheMonth()">
          ${Achievements.displayManagerOfTheMonth(cachedManagerOfTheMonthData, managerOfTheMonthExpanded)}
        </div>
      `;
    }
  }
}

// Make function globally available
window.toggleManagerOfTheMonth = toggleManagerOfTheMonth;
// Toggle function for Streak Specialist
function toggleStreakSpecialist() {
  streakSpecialistExpanded = !streakSpecialistExpanded;
  
  // Re-render with cached data
  if (window.cachedStreakData) {
    const board = document.querySelector('#streakBoard .board-live');
    if (board) {
      const prizeInfo = CONFIG.PRIZES.streakSpecialist;
      board.innerHTML = `
        <div class="achievement-description">${prizeInfo.description}</div>
        <div class="prize-amount">${Utils.formatCurrency(prizeInfo.amount)}</div>
        <div class="streak-specialist-container ${streakSpecialistExpanded ? 'expanded' : ''}" onclick="toggleStreakSpecialist()">
          ${Achievements.displayStreakSpecialist(window.cachedStreakData, streakSpecialistExpanded)}
        </div>
      `;
    }
  }
}

// Make function globally available
window.toggleStreakSpecialist = toggleStreakSpecialist;

// Toggle function for Chip Master
function toggleChipMaster() {
  chipMasterExpanded = !chipMasterExpanded;
  
  if (window.cachedChipData) {
    const board = document.querySelector('#chipMasterBoard .board-live');
    if (board) {
      const prizeInfo = CONFIG.PRIZES.chipMaster;
      board.innerHTML = `
        <div class="achievement-description">${prizeInfo.description}</div>
        <div class="prize-amount">${Utils.formatCurrency(prizeInfo.amount)}</div>
        <div class="chip-master-container ${chipMasterExpanded ? 'expanded' : ''}" onclick="toggleChipMaster()">
          ${Achievements.displayChipMaster(window.cachedChipData, chipMasterExpanded)}
        </div>
      `;
    }
  }
}

window.toggleChipMaster = toggleChipMaster;
// Toggle function for Bench Warmer
function toggleBenchWarmer() {
  benchWarmerExpanded = !benchWarmerExpanded;
  
  if (window.cachedBenchData) {
    const board = document.querySelector('#benchWarmerBoard .board-live');
    if (board) {
      const prizeInfo = CONFIG.PRIZES.benchWarmer;
      board.innerHTML = `
        <div class="achievement-description">${prizeInfo.description}</div>
        <div class="prize-amount">${Utils.formatCurrency(prizeInfo.amount)}</div>
        <div class="bench-warmer-container ${benchWarmerExpanded ? 'expanded' : ''}" onclick="toggleBenchWarmer()">
          ${Achievements.displayBenchWarmer(window.cachedBenchData, benchWarmerExpanded)}
        </div>
      `;
    }
  }
}

window.toggleBenchWarmer = toggleBenchWarmer;

// Toggle function for Elite Tactician
function toggleEliteTactician() {
  eliteTacticianExpanded = !eliteTacticianExpanded;
  
  if (window.cachedEliteData) {
    const board = document.querySelector('#captainBoard .board-live');
    if (board) {
      const prizeInfo = CONFIG.PRIZES.eliteTactician;
      board.innerHTML = `
        <div class="achievement-description">${prizeInfo.description}</div>
        <div class="prize-amount">${Utils.formatCurrency(prizeInfo.amount)}</div>
        <div class="elite-tactician-container ${eliteTacticianExpanded ? 'expanded' : ''}" onclick="toggleEliteTactician()">
          ${Achievements.displayEliteTactician(window.cachedEliteData, eliteTacticianExpanded)}
        </div>
      `;
    }
  }
}

window.toggleEliteTactician = toggleEliteTactician;

// Export for debugging (development only)
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  window.FPLApp = {
    AppState,
    API,
    Auth,
    Dashboard,
    Achievements,
    LeagueTable,
    CONFIG,
    Utils
  };
}