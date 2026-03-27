/* ============================================
   KODA — app.js (enhanced with animations, resizing, media keys, etc.)
   ============================================ */

'use strict';

// ——— STATE ———
const state = {
  library: [],
  queue: [],
  queueIndex: -1,
  currentTrack: null,
  isPlaying: false,
  shuffle: false,
  repeatMode: 'none',
  volume: 0.8,
  muted: false,
  currentView: 'songs',
  layout: 'list',
  searchQuery: '',
  queueOpen: false,
  settings: {
    showAlbums: true,
    showArtists: true,
    showGenres: true,
    dynamicTheme: true,
  },
  folderPath: null,
  detailContext: null,
  lightTheme: false,
  favourites: new Set(),
  playlists: [],
  selectedTracks: new Set(),
  selectionMode: false,
  lastPosition: null, // { id, time }
};

// ——— AUDIO ———
const audio = document.getElementById('audio-el');

// ——— DOM refs ———
const $ = id => document.getElementById(id);
const bgLayer      = $('bg-layer');
const artImg       = $('art-img');
const artEmpty     = $('art-empty');
const artGlow      = $('art-glow');
const playerTitle  = $('player-title');
const playerArtist = $('player-artist');
const playerAlbum  = $('player-album');
const timeCurrent  = $('time-current');
const timeTotal    = $('time-total');
const seekBar      = $('seek-bar');
const seekFill     = $('seek-fill');
const volBar       = $('volume-bar');
const volFill      = $('vol-fill');
const btnPlay      = $('btn-play');
const iconPlay     = $('icon-play');
const iconPause    = $('icon-pause');
const iconVol      = $('icon-vol');
const iconMute     = $('icon-mute');
const btnShuffle   = $('btn-shuffle');
const btnRepeat    = $('btn-repeat');
const libraryView  = $('library-view');
const detailView   = $('detail-view');
const detailHeader = $('detail-header');
const detailTracks = $('detail-tracks');
const welcomeState = $('welcome-state');
const loadingState = $('loading-state');
const loadingText  = $('loading-text');
const viewTitle    = $('view-title');
const viewCount    = $('view-count');
const searchInput  = $('search-input');
const npCard       = $('now-playing-card');
const npArt        = $('np-art');
const npTitle      = $('np-title');
const npArtist     = $('np-artist');
const queueList    = $('queue-list');
const queueToggle  = $('queue-toggle');
const selectionModeBtn = $('selection-mode-btn');
const contextMenu = $('context-menu');
const playlistModal = $('playlist-modal');
const playlistNameInput = $('playlist-name');
const playlistMoodSelect = $('playlist-mood');
const playlistCoverPicker = $('playlist-cover-picker');
const playlistCoverPreview = $('playlist-cover-preview');
const playlistModalCreate = $('playlist-modal-create');
const playlistModalCancel = $('playlist-modal-cancel');

// ——— Resize variables ———
let isResizingLeft = false;
let isResizingRight = false;
let startX, startSidebarWidth, startPlayerWidth;
const minSidebar = 180;
const minPlayer = 300;

// ——— INIT ———
async function init() {
  const settings = await window.koda.loadSettings();
  if (settings.volume !== undefined) state.volume = settings.volume;
  if (settings.shuffle !== undefined) state.shuffle = settings.shuffle;
  if (settings.repeatMode !== undefined) state.repeatMode = settings.repeatMode;
  if (settings.folderPath) state.folderPath = settings.folderPath;
  if (settings.settings) Object.assign(state.settings, settings.settings);
  if (settings.lightTheme !== undefined) state.lightTheme = settings.lightTheme;
  if (settings.favourites) state.favourites = new Set(settings.favourites);
  if (settings.playlists) state.playlists = settings.playlists;
  if (settings.lastPosition) state.lastPosition = settings.lastPosition;

  if (state.lightTheme) document.body.classList.add('light');
  else document.body.classList.remove('light');

  audio.volume = state.volume;
  volBar.value = state.volume;
  updateVolFill();
  applySettings();

  if (state.folderPath) {
    await loadFolder(state.folderPath);
  }

  bindEvents();
  updateShuffleBtn();
  updateRepeatBtn();
  updateHeartButton();
  addHeartButton();
  initResize();
  initMediaSession();
}

function showConfirm(message) {
  return new Promise((resolve) => {
    const modal = document.getElementById('confirm-modal');
    const msg = document.getElementById('confirm-message');
    const yes = document.getElementById('confirm-yes');
    const no = document.getElementById('confirm-no');
    msg.textContent = message;
    modal.classList.remove('hidden');
    const handlerYes = () => {
      modal.classList.add('hidden');
      resolve(true);
      cleanup();
    };
    const handlerNo = () => {
      modal.classList.add('hidden');
      resolve(false);
      cleanup();
    };
    const cleanup = () => {
      yes.removeEventListener('click', handlerYes);
      no.removeEventListener('click', handlerNo);
    };
    yes.addEventListener('click', handlerYes);
    no.addEventListener('click', handlerNo);
  });
}

// ——— RESIZE ———
function initResize() {
  const resizerLeft = document.getElementById('resizer-left');
  const resizerRight = document.getElementById('resizer-right');
  
  resizerLeft.addEventListener('mousedown', (e) => {
    isResizingLeft = true;
    startX = e.clientX;
    startSidebarWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-w'));
    document.body.style.cursor = 'col-resize';
    e.preventDefault();
  });
  
  resizerRight.addEventListener('mousedown', (e) => {
    isResizingRight = true;
    startX = e.clientX;
    startPlayerWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--player-w'));
    document.body.style.cursor = 'col-resize';
    e.preventDefault();
  });
  
  document.addEventListener('mousemove', (e) => {
    if (isResizingLeft) {
      const delta = e.clientX - startX;
      let newWidth = startSidebarWidth + delta;
      newWidth = Math.max(minSidebar, Math.min(window.innerWidth - 400, newWidth));
      document.documentElement.style.setProperty('--sidebar-w', `${newWidth}px`);
      document.getElementById('resizer-left').style.left = `${newWidth}px`;
    }
    if (isResizingRight) {
      const delta = e.clientX - startX;
      let newWidth = startPlayerWidth - delta;
      newWidth = Math.max(minPlayer, Math.min(window.innerWidth - 300, newWidth));
      document.documentElement.style.setProperty('--player-w', `${newWidth}px`);
      document.getElementById('resizer-right').style.right = `${newWidth}px`;
    }
  });
  
  document.addEventListener('mouseup', () => {
    isResizingLeft = false;
    isResizingRight = false;
    document.body.style.cursor = '';
  });
}

// ——— MEDIA KEYS ———
function initMediaSession() {
  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', () => togglePlay());
    navigator.mediaSession.setActionHandler('pause', () => togglePlay());
    navigator.mediaSession.setActionHandler('previoustrack', () => prevTrack());
    navigator.mediaSession.setActionHandler('nexttrack', () => nextTrack());
  }
}
function updateMediaMetadata() {
  if ('mediaSession' in navigator && state.currentTrack) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: state.currentTrack.title,
      artist: state.currentTrack.artist,
      album: state.currentTrack.album,
      artwork: state.currentTrack.art ? [{ src: state.currentTrack.art, sizes: '512x512', type: 'image/jpeg' }] : []
    });
  }
}

// ——— FOLDER LOADING (unchanged) ———
async function pickFolder() {
  const folder = await window.koda.selectFolder();
  if (!folder) return;
  state.folderPath = folder;
  await loadFolder(folder);
}

async function loadFolder(folderPath) {
  showState('loading');
  loadingText.textContent = 'Scanning your library…';

  try {
    const files = await window.koda.scanFolder(folderPath);
    if (!files.length) {
      showState('welcome');
      return;
    }

    state.library = [];
    let processed = 0;
    const batchSize = 20;
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      const results = await Promise.all(batch.map(f => window.koda.getMetadata(f)));
      state.library.push(...results.map((m, idx) => ({ ...m, id: `track-${i+idx}` })));
      processed += batch.length;
      loadingText.textContent = `Loading… ${processed} / ${files.length}`;
    }

    state.library.sort((a, b) => a.title.localeCompare(b.title));
    state.queue = [...state.library];
    state.queueIndex = -1;

    // Restore last played track (but don't auto-play)
    if (state.lastPosition) {
      const lastIdx = state.queue.findIndex(t => t.id === state.lastPosition.id);
      if (lastIdx !== -1) {
        state.queueIndex = lastIdx;
        loadTrack(state.queue[lastIdx], true);
      }
    }

    await saveSettings();
    showState('library');
    renderCurrentView();
  } catch (e) {
    console.error(e);
    showState('welcome');
  }
}

function showState(s) {
  welcomeState.classList.toggle('hidden', s !== 'welcome');
  loadingState.classList.toggle('hidden', s !== 'loading');
  libraryView.classList.toggle('hidden', s !== 'library');
  detailView.classList.toggle('hidden', true);
}

// ——— VIEWS ———
function renderCurrentView() {
  const view = state.currentView;
  const query = state.searchQuery.toLowerCase();

  let tracks = state.library.filter(t => {
    if (!query) return true;
    return t.title.toLowerCase().includes(query) ||
           t.artist.toLowerCase().includes(query) ||
           t.album.toLowerCase().includes(query) ||
           t.genre.toLowerCase().includes(query);
  });

  if (view === 'favourites') {
    tracks = tracks.filter(t => state.favourites.has(t.id));
    viewTitle.textContent = 'Favourites';
    viewCount.textContent = `${tracks.length} songs`;
    renderSongList(tracks, libraryView);
    return;
  }

  if (view === 'playlists') {
    detailView.classList.add('hidden');
    libraryView.classList.remove('hidden');
    viewTitle.textContent = 'Playlists';
    viewCount.textContent = `${state.playlists.length} playlists`;
    renderPlaylists();
    return;
  }

  detailView.classList.add('hidden');
  libraryView.classList.remove('hidden');

  if (view === 'songs') {
    viewTitle.textContent = 'Songs';
    viewCount.textContent = `${tracks.length} songs`;
    renderSongList(tracks, libraryView);
  } else if (view === 'albums') {
    const albums = groupBy(tracks, 'album');
    viewTitle.textContent = 'Albums';
    viewCount.textContent = `${Object.keys(albums).length} albums`;
    renderGrid(albums, 'album', libraryView);
  } else if (view === 'artists') {
    const artists = groupBy(tracks, 'artist');
    viewTitle.textContent = 'Artists';
    viewCount.textContent = `${Object.keys(artists).length} artists`;
    renderGrid(artists, 'artist', libraryView);
  } else if (view === 'genres') {
    const genres = groupBy(tracks, 'genre');
    viewTitle.textContent = 'Genres';
    viewCount.textContent = `${Object.keys(genres).length} genres`;
    renderGrid(genres, 'genre', libraryView);
  }

  // Fade animation
  libraryView.classList.add('view-fade');
  setTimeout(() => libraryView.classList.remove('view-fade'), 200);
}

function groupBy(arr, key) {
  return arr.reduce((acc, item) => {
    const k = item[key] || 'Unknown';
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {});
}

function renderSongList(tracks, container) {
    if (state.layout === 'grid' && state.currentView === 'songs') {
    renderSongGrid(tracks, container);
    return;
  }
  const table = document.createElement('table');
  table.className = 'songs-table';
  let theadHTML = `<thead class="songs-thead">`;
  if (state.selectionMode) {
    theadHTML += `<th class="song-check"><input type="checkbox" id="select-all-checkbox"></th>`;
  }
  theadHTML += `
      <th>#</th>
      <th>Title</th>
      <th>Artist</th>
      <th>Album</th>
      <th class="col-dur">Duration</th>
    </thead>`;
  table.innerHTML = theadHTML;
  const tbody = document.createElement('tbody');
  tracks.forEach((track, idx) => {
    const tr = document.createElement('tr');
    tr.className = 'song-row';
    tr.dataset.trackId = track.id;
    if (state.currentTrack?.id === track.id) {
      tr.classList.add('active');
      if (state.isPlaying) tr.classList.add('is-playing');
    }
    let rowHTML = '';
    if (state.selectionMode) {
      rowHTML += `<td class="song-check"><input type="checkbox" class="song-checkbox" data-id="${track.id}" ${state.selectedTracks.has(track.id) ? 'checked' : ''}>`;
    }
    rowHTML += `
      <td class="song-num">
        <div class="playing-bars">
          <div class="playing-bar"></div>
          <div class="playing-bar"></div>
          <div class="playing-bar"></div>
        </div>
        <span class="song-num-text">${idx + 1}</span>
        </td>
      <td class="song-title">${esc(track.title)}</td>
      <td class="song-artist">${esc(track.artist)}</td>
      <td class="song-album">${esc(track.album)}</td>
      <td class="song-dur">${formatDuration(track.duration)}</td>
    `;
    tr.innerHTML = rowHTML;
    tr.addEventListener('click', (e) => {
      if (state.selectionMode && e.target.type !== 'checkbox') {
        const cb = tr.querySelector('.song-checkbox');
        if (cb) {
          cb.checked = !cb.checked;
          if (cb.checked) state.selectedTracks.add(track.id);
          else state.selectedTracks.delete(track.id);
        }
        return;
      }
      playFromList(tracks, idx);
    });
    tr.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const isMultiple = state.selectionMode && state.selectedTracks.size > 0;
      showContextMenu(e, track, isMultiple);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  container.innerHTML = '';
  container.appendChild(table);

  const selectAll = document.getElementById('select-all-checkbox');
  if (selectAll) {
    selectAll.addEventListener('change', (e) => {
      const checkboxes = document.querySelectorAll('.song-checkbox');
      checkboxes.forEach(cb => {
        cb.checked = e.target.checked;
        const id = cb.dataset.id;
        if (e.target.checked) state.selectedTracks.add(id);
        else state.selectedTracks.delete(id);
      });
    });
  }
}

function renderSongGrid(tracks, container) {
  const grid = document.createElement('div');
  grid.className = 'grid-view';
  tracks.forEach(track => {
    const card = document.createElement('div');
    card.className = 'grid-card song-grid-card';
    const artDiv = document.createElement('div');
    artDiv.className = 'grid-art';
    if (track.art) {
      const img = document.createElement('img');
      img.src = track.art;
      artDiv.appendChild(img);
    } else {
      // use placeholder icon with randomized color
      const color = stringToHue(track.id);
      artDiv.style.backgroundColor = `hsl(${color}, 70%, 70%)`;
      artDiv.style.display = 'flex';
      artDiv.style.alignItems = 'center';
      artDiv.style.justifyContent = 'center';
      artDiv.style.fontSize = '36px';
      artDiv.textContent = '♪';
    }
    card.appendChild(artDiv);
    const nameDiv = document.createElement('div');
    nameDiv.className = 'grid-name';
    nameDiv.textContent = track.title;
    card.appendChild(nameDiv);
    const subDiv = document.createElement('div');
    subDiv.className = 'grid-sub';
    subDiv.textContent = track.artist;
    card.appendChild(subDiv);
    card.addEventListener('click', () => {
      // play this track and set queue to all songs (or just this track)
      const idx = tracks.findIndex(t => t.id === track.id);
      playFromList(tracks, idx);
    });
    card.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showContextMenu(e, track, false);
    });
    grid.appendChild(card);
  });
  container.innerHTML = '';
  container.appendChild(grid);
}

function stringToHue(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash % 360);
}

function renderGrid(groups, type, container) {
  container.innerHTML = '';
  if (state.layout === 'list') {
    for (const [name, tracks] of Object.entries(groups)) {
      const wrap = document.createElement('div');
      wrap.style.marginBottom = '24px';
      const heading = document.createElement('div');
      heading.style.cssText = 'font-size:15px;font-weight:600;color:var(--text-primary);margin-bottom:8px;padding:0 8px;cursor:pointer;';
      heading.textContent = name;
      heading.addEventListener('click', () => openDetail(type, name, tracks));
      wrap.appendChild(heading);
      const mini = document.createElement('table');
      mini.className = 'songs-table';
      const tbody = document.createElement('tbody');
      tracks.slice(0, 5).forEach((track, idx) => {
        const tr = document.createElement('tr');
        tr.className = 'song-row';
        tr.dataset.trackId = track.id;
        if (state.currentTrack?.id === track.id) {
          tr.classList.add('active');
          if (state.isPlaying) tr.classList.add('is-playing');
        }
        tr.innerHTML = `
          <td class="song-num">
            <div class="playing-bars"><div class="playing-bar"></div><div class="playing-bar"></div><div class="playing-bar"></div></div>
            <span class="song-num-text">${idx + 1}</span>
            </td>
          <td class="song-title">${esc(track.title)}</td>
          <td class="song-artist">${esc(track.artist)}</td>
          <td class="song-dur">${formatDuration(track.duration)}</td>
        `;
        tr.addEventListener('click', () => playFromList(tracks, idx));
        tbody.appendChild(tr);
      });
      mini.appendChild(tbody);
      wrap.appendChild(mini);
      if (tracks.length > 5) {
        const more = document.createElement('button');
        more.style.cssText = 'margin:6px 8px;background:none;border:none;color:var(--accent);cursor:pointer;font-size:12px;';
        more.textContent = `See all ${tracks.length} →`;
        more.addEventListener('click', () => openDetail(type, name, tracks));
        wrap.appendChild(more);
      }
      container.appendChild(wrap);
    }
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'grid-view';
  for (const [name, tracks] of Object.entries(groups)) {
    const card = document.createElement('div');
    card.className = 'grid-card';
    const artDiv = document.createElement('div');
    artDiv.className = 'grid-art';
    const artTrack = tracks.find(t => t.art);
    if (artTrack) {
      const img = document.createElement('img');
      img.src = artTrack.art;
      img.alt = name;
      artDiv.appendChild(img);
    } else {
      artDiv.textContent = type === 'album' ? '💿' : type === 'artist' ? '🎤' : '🎵';
    }
    card.appendChild(artDiv);
    const nameDiv = document.createElement('div');
    nameDiv.className = 'grid-name';
    nameDiv.textContent = name;
    card.appendChild(nameDiv);
    const subDiv = document.createElement('div');
    subDiv.className = 'grid-sub';
    subDiv.textContent = `${tracks.length} ${tracks.length === 1 ? 'song' : 'songs'}`;
    card.appendChild(subDiv);
    card.addEventListener('click', () => openDetail(type, name, tracks));
    grid.appendChild(card);
  }
  container.appendChild(grid);
}

function openDetail(type, name, tracks) {
  state.detailContext = { type, name, tracks };
  libraryView.classList.add('hidden');
  detailView.classList.remove('hidden');

  const artTrack = tracks.find(t => t.art);
  const icon = type === 'album' ? '💿' : type === 'artist' ? '🎤' : '🎵';
  detailHeader.innerHTML = `
    <div class="detail-art">
      ${artTrack ? `<img src="${artTrack.art}" alt="${esc(name)}">` : icon}
    </div>
    <div>
      <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">${type}</div>
      <div class="detail-meta-name">${esc(name)}</div>
      <div class="detail-meta-sub">${tracks.length} songs · ${formatDuration(tracks.reduce((s,t) => s + (t.duration||0), 0))}</div>
    </div>
  `;

  renderSongList(tracks, detailTracks);
  detailView.classList.add('view-fade');
  setTimeout(() => detailView.classList.remove('view-fade'), 200);
}

// ——— PLAYLISTS ———
let playlistSortMode = 'date'; // 'date' | 'name' | 'mood' | 'count'

function renderPlaylists() {
  libraryView.innerHTML = '';

  // Sort bar
  const sortBar = document.createElement('div');
  sortBar.className = 'playlist-sort-bar';
  sortBar.innerHTML = `
    <span class="sort-label">Sort by:</span>
    ${['date','name','mood','count'].map(s => `
      <button class="sort-btn${playlistSortMode === s ? ' active' : ''}" data-sort="${s}">
        ${s === 'date' ? 'Date Added' : s === 'name' ? 'Name' : s === 'mood' ? 'Mood' : 'Songs'}
      </button>
    `).join('')}
  `;
  sortBar.querySelectorAll('.sort-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      playlistSortMode = btn.dataset.sort;
      renderPlaylists();
    });
  });
  libraryView.appendChild(sortBar);

  // Sort playlists
  const sorted = [...state.playlists].sort((a, b) => {
    if (playlistSortMode === 'date') return (b.dateAdded || 0) - (a.dateAdded || 0);
    if (playlistSortMode === 'name') return a.name.localeCompare(b.name);
    if (playlistSortMode === 'mood') return (a.mood || 'zzz').localeCompare(b.mood || 'zzz');
    if (playlistSortMode === 'count') return (b.tracks?.length || 0) - (a.tracks?.length || 0);
    return 0;
  });

  const container = document.createElement('div');
  container.className = 'grid-view';

  for (const pl of sorted) {
    const card = document.createElement('div');
    card.className = 'playlist-card';
    card.dataset.id = pl.id;
    card.style.position = 'relative';

    // Cover
    const coverDiv = document.createElement('div');
    coverDiv.className = 'playlist-cover';
    if (pl.cover) {
      const img = document.createElement('img');
      img.src = pl.cover;
      coverDiv.appendChild(img);
    } else {
      // Random-hue placeholder based on playlist id
      const hue = stringToHue(pl.id);
      coverDiv.style.background = `linear-gradient(135deg, hsl(${hue},55%,40%), hsl(${(hue+40)%360},60%,55%))`;
      coverDiv.style.color = 'rgba(255,255,255,0.8)';
      coverDiv.style.fontSize = '28px';
      coverDiv.textContent = pl.name.charAt(0).toUpperCase();
    }
    card.appendChild(coverDiv);

    // Mood badge
    if (pl.mood) {
      const badge = document.createElement('div');
      badge.className = 'playlist-mood-badge';
      badge.textContent = pl.mood;
      card.appendChild(badge);
    }

    const nameDiv = document.createElement('div');
    nameDiv.className = 'playlist-name';
    nameDiv.textContent = pl.name;
    card.appendChild(nameDiv);

    const metaDiv = document.createElement('div');
    metaDiv.className = 'playlist-meta';
    metaDiv.textContent = `${pl.tracks?.length || 0} songs`;
    card.appendChild(metaDiv);

    // Delete button — styled properly
    const delBtn = document.createElement('button');
    delBtn.className = 'playlist-del-btn';
    delBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
    delBtn.title = 'Delete playlist';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deletePlaylist(pl.id);
    });
    card.appendChild(delBtn);

    card.addEventListener('click', () => openPlaylist(pl.id));
    container.appendChild(card);
  }

  // Create playlist card
  const addCard = document.createElement('div');
  addCard.className = 'playlist-card playlist-create-card';
  addCard.innerHTML = `
    <div class="playlist-create-icon">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
    </div>
    <div class="playlist-name" style="text-align:center;">New Playlist</div>
  `;
  addCard.addEventListener('click', () => showPlaylistModal());
  container.appendChild(addCard);
  libraryView.appendChild(container);
}

function openPlaylist(playlistId) {
  const playlist = state.playlists.find(p => p.id === playlistId);
  if (!playlist) return;
  const tracks = playlist.tracks.map(id => state.library.find(t => t.id === id)).filter(t => t);
  state.detailContext = { type: 'playlist', id: playlistId, name: playlist.name, tracks };
  libraryView.classList.add('hidden');
  detailView.classList.remove('hidden');
  const icon = playlist.cover ? `<img src="${playlist.cover}">` : '📀';
  detailHeader.innerHTML = `
    <div class="detail-art">${icon}</div>
    <div>
      <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;">Playlist</div>
      <div class="detail-meta-name">${esc(playlist.name)}</div>
      <div class="detail-meta-sub">${tracks.length} songs · ${playlist.mood ? playlist.mood : ''}</div>
    </div>
  `;

  // Add Songs button
  const addButton = document.createElement('button');
  addButton.textContent = '+ Add Songs';
  addButton.className = 'add-songs-btn';
  addButton.style.marginLeft = 'auto';
  addButton.style.padding = '6px 12px';
  addButton.style.background = 'var(--accent)';
  addButton.style.border = 'none';
  addButton.style.borderRadius = '20px';
  addButton.style.cursor = 'pointer';
  addButton.style.color = '#111';
  addButton.style.fontWeight = '600';
  addButton.addEventListener('click', () => showAddSongsModal(playlistId));
  detailHeader.appendChild(addButton);

  // Delete playlist button
  const delPlaylistBtn = document.createElement('button');
  delPlaylistBtn.innerHTML = '🗑️ Delete Playlist';
  delPlaylistBtn.className = 'delete-playlist-btn';
  delPlaylistBtn.style.marginLeft = '12px';
  delPlaylistBtn.style.padding = '6px 12px';
  delPlaylistBtn.style.background = 'var(--surface)';
  delPlaylistBtn.style.border = '1px solid var(--border)';
  delPlaylistBtn.style.borderRadius = '20px';
  delPlaylistBtn.style.cursor = 'pointer';
  delPlaylistBtn.style.color = 'var(--text-secondary)';
  delPlaylistBtn.addEventListener('click', () => deletePlaylist(playlistId));
  detailHeader.appendChild(delPlaylistBtn);

  renderSongList(tracks, detailTracks);
  detailView.classList.add('view-fade');
  setTimeout(() => detailView.classList.remove('view-fade'), 200);
}

async function deletePlaylist(playlistId) {
  if (!await showConfirm('Delete this playlist? This action cannot be undone.')) return;
  state.playlists = state.playlists.filter(p => p.id !== playlistId);
  saveSettings();
  if (state.currentView === 'playlists') renderCurrentView();
  if (state.detailContext?.type === 'playlist' && state.detailContext.id === playlistId) {
    detailView.classList.add('hidden');
    libraryView.classList.remove('hidden');
  }
}

let newPlaylistCover = null;
function showPlaylistModal() {
  playlistNameInput.value = '';
  playlistMoodSelect.value = '';
  newPlaylistCover = null;
  playlistCoverPreview.innerHTML = '';
  playlistModal.classList.remove('hidden');
}

playlistCoverPicker.addEventListener('click', async () => {
  const coverData = await window.koda.pickImage();
  if (coverData) {
    newPlaylistCover = coverData;
    playlistCoverPreview.innerHTML = `<img src="${coverData}" style="max-width:100px; max-height:100px; margin-top:8px;">`;
  }
});

playlistModalCreate.addEventListener('click', async () => {
  const name = playlistNameInput.value.trim();
  if (!name) return;
  const mood = playlistMoodSelect.value;
  const newId = Date.now().toString();
  state.playlists.push({
    id: newId,
    name,
    mood: mood || null,
    cover: newPlaylistCover,
    tracks: [],
    dateAdded: Date.now(),
  });
  await saveSettings();
  playlistModal.classList.add('hidden');
  if (state.currentView === 'playlists') renderCurrentView();
});

playlistModalCancel.addEventListener('click', () => {
  playlistModal.classList.add('hidden');
});

// ——— ADD SONGS TO PLAYLIST ———
let currentPlaylistForAdd = null;

function showAddSongsModal(playlistId) {
  currentPlaylistForAdd = playlistId;
  const modal = document.getElementById('add-songs-modal');
  const listContainer = document.getElementById('add-songs-list');
  const playlist = state.playlists.find(p => p.id === playlistId);
  listContainer.innerHTML = '';
  state.library.forEach(track => {
    const row = document.createElement('div');
    row.className = 'add-song-row';
    const alreadyIn = playlist?.tracks.includes(track.id);
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '12px';
    row.style.padding = '8px 12px';
    row.style.borderRadius = 'var(--radius-sm)';
    row.style.transition = 'background var(--transition)';
    row.style.cursor = alreadyIn ? 'default' : 'pointer';
    row.style.opacity = alreadyIn ? '0.5' : '1';

    const artDiv = document.createElement('div');
    artDiv.style.cssText = 'width:32px;height:32px;border-radius:4px;overflow:hidden;background:var(--bg-3);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:14px;color:var(--text-muted);';
    if (track.art) {
      const img = document.createElement('img');
      img.src = track.art;
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
      artDiv.appendChild(img);
    } else {
      artDiv.textContent = '♪';
    }

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'song-checkbox';
    cb.value = track.id;
    cb.disabled = alreadyIn;
    cb.checked = alreadyIn;
    cb.style.accentColor = 'var(--accent)';

    const info = document.createElement('div');
    info.style.flex = '1';
    info.style.minWidth = '0';
    const titleSpan = document.createElement('div');
    titleSpan.textContent = track.title;
    titleSpan.style.cssText = 'font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
    const artistSpan = document.createElement('div');
    artistSpan.textContent = track.artist;
    artistSpan.style.cssText = 'font-size:11px;color:var(--text-secondary);margin-top:2px;';
    info.appendChild(titleSpan);
    info.appendChild(artistSpan);

    if (alreadyIn) {
      const badge = document.createElement('span');
      badge.textContent = 'Added';
      badge.style.cssText = 'font-size:10px;color:var(--accent);font-weight:600;flex-shrink:0;';
      row.appendChild(artDiv);
      row.appendChild(cb);
      row.appendChild(info);
      row.appendChild(badge);
    } else {
      row.appendChild(artDiv);
      row.appendChild(cb);
      row.appendChild(info);
      row.addEventListener('mouseenter', () => row.style.background = 'var(--surface)');
      row.addEventListener('mouseleave', () => row.style.background = '');
      row.addEventListener('click', (e) => {
        if (e.target !== cb) cb.checked = !cb.checked;
      });
    }
    listContainer.appendChild(row);
  });
  modal.classList.remove('hidden');
}

document.getElementById('close-add-songs').addEventListener('click', () => {
  document.getElementById('add-songs-modal').classList.add('hidden');
});
document.getElementById('cancel-add-songs').addEventListener('click', () => {
  document.getElementById('add-songs-modal').classList.add('hidden');
});
document.getElementById('confirm-add-songs').addEventListener('click', () => {
  const selected = Array.from(document.querySelectorAll('#add-songs-list .song-checkbox:checked:not(:disabled)')).map(cb => cb.value);
  const playlist = state.playlists.find(p => p.id === currentPlaylistForAdd);
  if (playlist && selected.length > 0) {
    const newTracks = selected.filter(id => !playlist.tracks.includes(id));
    playlist.tracks.push(...newTracks);
    saveSettings();
    if (state.detailContext?.type === 'playlist' && state.detailContext.id === currentPlaylistForAdd) {
      openPlaylist(currentPlaylistForAdd);
    }
  }
  document.getElementById('add-songs-modal').classList.add('hidden');
  // Auto turn off selection mode
  if (state.selectionMode) {
    state.selectionMode = false;
    selectionModeBtn.classList.remove('active');
    state.selectedTracks.clear();
    renderCurrentView();
  }
});

// ——— PLAYBACK ———
function playFromList(tracks, idx) {
  state.queue = [...tracks];
  state.queueIndex = idx;
  playCurrentQueueItem();
}

function playCurrentQueueItem() {
  if (state.queueIndex < 0 || state.queueIndex >= state.queue.length) return;
  const track = state.queue[state.queueIndex];
  loadTrack(track);
  audio.play().catch(console.error);
}

function loadTrack(track, restorePosition = false) {
  state.currentTrack = track;
  audio.src = `file://${track.path.replace(/\\/g, '/')}`;

  playerTitle.textContent = track.title || '—';
  playerArtist.textContent = track.artist || '—';
  playerAlbum.textContent = track.album || '';

  if (track.art) {
    artImg.src = track.art;
    artImg.classList.remove('hidden');
    artEmpty.classList.add('hidden');
    if (state.settings.dynamicTheme) {
      extractAndApplyTheme(track.art);
    }
    npArt.src = track.art;
    npArt.classList.remove('hidden');
  } else {
    artImg.classList.add('hidden');
    artEmpty.classList.remove('hidden');
    // Apply a random-hue accent based on track id for no-art tracks
    const hue = stringToHue(track.id);
    const hex = hslToHex(hue / 360, 0.55, 0.65);
    applyAccentColor(hex);
    // Color the art-empty placeholder
    artEmpty.style.color = hex;
    npArt.classList.add('hidden');
  }

  npTitle.textContent = track.title || '—';
  npArtist.textContent = track.artist || '—';
  npCard.classList.remove('hidden');

  // Restore last position if applicable
  if (restorePosition && state.lastPosition && state.lastPosition.id === track.id && state.lastPosition.time > 0) {
    audio.addEventListener('loadedmetadata', function onMeta() {
      audio.currentTime = state.lastPosition.time;
      audio.removeEventListener('loadedmetadata', onMeta);
    });
  }

  updateActiveRows();
  renderQueueList();

  document.title = `${track.title} — Koda`;
  updateHeartButton();
  updateMediaMetadata();
}

function updateActiveRows() {
  document.querySelectorAll('.song-row').forEach(row => {
    const isActive = row.dataset.trackId === state.currentTrack?.id;
    row.classList.toggle('active', isActive);
    row.classList.toggle('is-playing', isActive && state.isPlaying);
  });
  document.querySelectorAll('.queue-item').forEach(item => {
    item.classList.toggle('active', item.dataset.trackId === state.currentTrack?.id);
  });
}

function togglePlay() {
  if (!state.currentTrack) {
    if (state.library.length) {
      state.queue = [...state.library];
      state.queueIndex = 0;
      playCurrentQueueItem();
    }
    return;
  }
  if (audio.paused) {
    audio.play().catch(console.error);
  } else {
    audio.pause();
  }
}

audio.addEventListener('play', () => {
  state.isPlaying = true;
  iconPlay.classList.add('hidden');
  iconPause.classList.remove('hidden');
  artGlow.style.opacity = '0.4';
  updateActiveRows();
});

audio.addEventListener('pause', () => {
  state.isPlaying = false;
  iconPlay.classList.remove('hidden');
  iconPause.classList.add('hidden');
  artGlow.style.opacity = '0';
  updateActiveRows();
});

audio.addEventListener('ended', () => {
  handleTrackEnd();
});

audio.addEventListener('timeupdate', () => {
  const cur = audio.currentTime;
  const dur = audio.duration || 0;
  timeCurrent.textContent = formatDuration(cur);
  if (dur) {
    const pct = (cur / dur) * 100;
    seekFill.style.width = `${pct}%`;
    seekBar.value = pct;
  }
  // Save position every 5 seconds
  if (state.currentTrack && Math.floor(cur) % 5 === 0 && cur > 0) {
    state.lastPosition = { id: state.currentTrack.id, time: cur };
  }
});

audio.addEventListener('loadedmetadata', () => {
  timeTotal.textContent = formatDuration(audio.duration);
});

audio.addEventListener('error', (e) => {
  console.error('Audio error:', e);
});

function handleTrackEnd() {
  if (state.repeatMode === 'one') {
    audio.currentTime = 0;
    audio.play();
    return;
  }

  let nextIdx;
  if (state.shuffle) {
    nextIdx = Math.floor(Math.random() * state.queue.length);
  } else {
    nextIdx = state.queueIndex + 1;
  }

  if (nextIdx >= state.queue.length) {
    if (state.repeatMode === 'all') {
      nextIdx = 0;
    } else {
      state.isPlaying = false;
      iconPlay.classList.remove('hidden');
      iconPause.classList.add('hidden');
      return;
    }
  }

  state.queueIndex = nextIdx;
  playCurrentQueueItem();
}

function prevTrack() {
  if (audio.currentTime > 3) {
    audio.currentTime = 0;
    return;
  }
  let idx = state.queueIndex - 1;
  if (idx < 0) idx = state.queue.length - 1;
  state.queueIndex = idx;
  playCurrentQueueItem();
}

function nextTrack() {
  let idx;
  if (state.shuffle) {
    idx = Math.floor(Math.random() * state.queue.length);
  } else {
    idx = state.queueIndex + 1;
    if (idx >= state.queue.length) idx = 0;
  }
  state.queueIndex = idx;
  playCurrentQueueItem();
}

seekBar.addEventListener('input', () => {
  const pct = seekBar.value / 100;
  if (audio.duration) {
    audio.currentTime = pct * audio.duration;
    seekFill.style.width = `${seekBar.value}%`;
  }
});

volBar.addEventListener('input', () => {
  state.volume = parseFloat(volBar.value);
  audio.volume = state.volume;
  state.muted = false;
  audio.muted = false;
  updateVolFill();
  updateVolIcon();
});

function updateVolFill() {
  volFill.style.width = `${state.muted ? 0 : state.volume * 100}%`;
}

function updateVolIcon() {
  iconVol.classList.toggle('hidden', state.muted || state.volume === 0);
  iconMute.classList.toggle('hidden', !state.muted && state.volume > 0);
}

$('btn-mute').addEventListener('click', () => {
  state.muted = !state.muted;
  audio.muted = state.muted;
  updateVolFill();
  updateVolIcon();
});

btnShuffle.addEventListener('click', () => {
  state.shuffle = !state.shuffle;
  updateShuffleBtn();
  saveSettings();
});

btnRepeat.addEventListener('click', () => {
  const modes = ['none', 'all', 'one'];
  const cur = modes.indexOf(state.repeatMode);
  state.repeatMode = modes[(cur + 1) % modes.length];
  updateRepeatBtn();
  saveSettings();
});

function updateShuffleBtn() {
  btnShuffle.classList.toggle('active', state.shuffle);
}

function updateRepeatBtn() {
  btnRepeat.classList.toggle('active', state.repeatMode !== 'none');
  if (state.repeatMode === 'one') {
    btnRepeat.title = 'Repeat: One';
    btnRepeat.style.position = 'relative';
  } else if (state.repeatMode === 'all') {
    btnRepeat.title = 'Repeat: All';
  } else {
    btnRepeat.title = 'Repeat: Off';
  }
}

queueToggle.addEventListener('click', () => {
  state.queueOpen = !state.queueOpen;
  queueList.classList.toggle('hidden', !state.queueOpen);
});

function renderQueueList() {
  queueList.innerHTML = '';
  state.queue.forEach((track, idx) => {
    const item = document.createElement('div');
    item.className = 'queue-item';
    item.dataset.trackId = track.id;
    if (track.id === state.currentTrack?.id) item.classList.add('active');

    const artDiv = document.createElement('div');
    artDiv.className = 'q-art';
    if (track.art) {
      const img = document.createElement('img');
      img.src = track.art;
      artDiv.appendChild(img);
    } else {
      artDiv.textContent = '♪';
    }

    const info = document.createElement('div');
    info.className = 'q-info';
    info.innerHTML = `<div class="q-title">${esc(track.title)}</div><div class="q-artist">${esc(track.artist)}</div>`;

    item.appendChild(artDiv);
    item.appendChild(info);
    item.addEventListener('click', () => {
      state.queueIndex = idx;
      playCurrentQueueItem();
    });
    queueList.appendChild(item);
  });

  const active = queueList.querySelector('.queue-item.active');
  if (active) active.scrollIntoView({ block: 'nearest' });
}

// ——— DYNAMIC THEMING (unchanged) ———
const colorCache = new Map();

function extractAndApplyTheme(artSrc) {
  if (colorCache.has(artSrc)) {
    applyAccentColor(colorCache.get(artSrc));
    return;
  }
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 50; canvas.height = 50;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, 50, 50);
    const data = ctx.getImageData(0, 0, 50, 50).data;

    let bestColor = null;
    let bestScore = -1;
    const step = 8;
    for (let i = 0; i < data.length; i += 4 * step) {
      const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
      if (a < 128) continue;
      const [h, s, l] = rgbToHsl(r, g, b);
      const score = s * (1 - Math.abs(l - 0.5) * 1.5);
      if (score > bestScore) {
        bestScore = score;
        bestColor = { r, g, b, h, s, l };
      }
    }

    if (bestColor) {
      let { h, s, l } = bestColor;
      s = Math.max(s, 0.4);
      l = Math.max(0.55, Math.min(0.75, l + (0.65 - l) * 0.5));
      const hex = hslToHex(h, s, l);
      colorCache.set(artSrc, hex);
      applyAccentColor(hex);
    } else {
      resetTheme();
    }
  };
  img.onerror = () => resetTheme();
  img.src = artSrc;
}

function applyAccentColor(hex) {
  const root = document.documentElement;
  root.style.setProperty('--accent', hex);
  const [r, g, b] = hexToRgb(hex);
  root.style.setProperty('--accent-dim', `rgba(${r},${g},${b},0.15)`);
  root.style.setProperty('--accent-glow', `rgba(${r},${g},${b},0.22)`);
  artGlow.style.background = hex;
  
  // Enhanced background tint
  bgLayer.style.background = `
    radial-gradient(ellipse 70% 60% at 80% 15%, rgba(${r},${g},${b},0.15), transparent 70%),
    radial-gradient(ellipse at 20% 40%, rgba(${r},${g},${b},0.08), transparent 80%)
  `;
}

function showConfirm(message) {
  return new Promise((resolve) => {
    const modal = document.getElementById('confirm-modal');
    const msg = document.getElementById('confirm-message');
    const yes = document.getElementById('confirm-yes');
    const no = document.getElementById('confirm-no');
    msg.textContent = message;
    modal.classList.remove('hidden');
    const handlerYes = () => {
      modal.classList.add('hidden');
      resolve(true);
      cleanup();
    };
    const handlerNo = () => {
      modal.classList.add('hidden');
      resolve(false);
      cleanup();
    };
    const cleanup = () => {
      yes.removeEventListener('click', handlerYes);
      no.removeEventListener('click', handlerNo);
    };
    yes.addEventListener('click', handlerYes);
    no.addEventListener('click', handlerNo);
  });
}

function resetTheme() {
  const root = document.documentElement;
  root.style.setProperty('--accent', '#d4a85a');
  root.style.setProperty('--accent-dim', 'rgba(212,168,90,0.15)');
  root.style.setProperty('--accent-glow', 'rgba(212,168,90,0.22)');
  bgLayer.style.background = '';
  artGlow.style.background = '#d4a85a';
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [h, s, l];
}

function hslToHex(h, s, l) {
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = Math.round(hue2rgb(p, q, h + 1/3) * 255);
  const g = Math.round(hue2rgb(p, q, h) * 255);
  const b = Math.round(hue2rgb(p, q, h - 1/3) * 255);
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return [r, g, b];
}

// ——— SETTINGS ———
function applySettings() {
  const s = state.settings;
  $('nav-albums').classList.toggle('hidden', !s.showAlbums);
  $('nav-artists').classList.toggle('hidden', !s.showArtists);
  $('nav-genres').classList.toggle('hidden', !s.showGenres);

  $('toggle-albums').checked = s.showAlbums;
  $('toggle-artists').checked = s.showArtists;
  $('toggle-genres').checked = s.showGenres;
  $('toggle-theme').checked = s.dynamicTheme;

  if ((state.currentView === 'albums' && !s.showAlbums) ||
      (state.currentView === 'artists' && !s.showArtists) ||
      (state.currentView === 'genres' && !s.showGenres)) {
    switchView('songs');
  }
}

async function saveSettings() {
  await window.koda.saveSettings({
    volume: state.volume,
    shuffle: state.shuffle,
    repeatMode: state.repeatMode,
    folderPath: state.folderPath,
    settings: state.settings,
    lightTheme: state.lightTheme,
    favourites: Array.from(state.favourites),
    playlists: state.playlists,
    lastPosition: state.lastPosition,
  });
}

function switchView(view) {
  state.currentView = view;
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });
  if (state.library.length) {
    showState('library');
    renderCurrentView();
  }
}

document.querySelectorAll('.view-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    state.layout = btn.dataset.layout;
    document.querySelectorAll('.view-toggle').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderCurrentView();
  });
});

// ——— CONTEXT MENU (unchanged) ———
let currentRightClickTrack = null;

function showContextMenu(e, track, isMultiple = false) {
  e.preventDefault();
  contextMenu.innerHTML = '';
  contextMenu.classList.remove('hidden');
  contextMenu.style.left = `${e.clientX}px`;
  contextMenu.style.top = `${e.clientY}px`;

  function addOption(text, handler, danger = false) {
    const btn = document.createElement('button');
    btn.textContent = text;
    if (danger) btn.classList.add('danger');
    btn.addEventListener('click', () => {
      contextMenu.classList.add('hidden');
      handler();
    });
    contextMenu.appendChild(btn);
  }

  if (isMultiple) {
    const selectedCount = state.selectedTracks.size;
    addOption(`Add ${selectedCount} songs to playlist`, () => addSelectedToPlaylist());
    addOption(`Add ${selectedCount} songs to queue`, () => addSelectedToQueue());
    addOption(`Delete ${selectedCount} songs from disk`, () => deleteSelected(), true);
  } else {
    addOption('Add to queue', () => addToQueue(track));
    addOption('Add to playlist', () => showPlaylistPicker(track));
    addOption('Delete from disk', () => deleteTrack(track), true);
  }

  const closeHandler = () => {
    contextMenu.classList.add('hidden');
    document.removeEventListener('click', closeHandler);
  };
  setTimeout(() => document.addEventListener('click', closeHandler), 0);
}

function addToQueue(track) {
  state.queue.push(track);
  renderQueueList();
}

function addSelectedToQueue() {
  const toAdd = Array.from(state.selectedTracks)
    .map(id => state.library.find(t => t.id === id))
    .filter(t => t);
  state.queue.push(...toAdd);
  renderQueueList();
  clearSelection();
}

async function deleteTrack(track) {
  if (!await showConfirm(`Delete "${track.title}" from disk? This cannot be undone.`)) return;
  const success = await window.koda.deleteFile(track.path);
  if (success) {
    const idx = state.library.findIndex(t => t.id === track.id);
    if (idx !== -1) state.library.splice(idx, 1);
    state.favourites.delete(track.id);
    for (const pl of state.playlists) {
      const pos = pl.tracks.indexOf(track.id);
      if (pos !== -1) pl.tracks.splice(pos, 1);
    }
    const qidx = state.queue.findIndex(t => t.id === track.id);
    if (qidx !== -1) state.queue.splice(qidx, 1);
    if (state.currentTrack?.id === track.id) handleTrackEnd();
    saveSettings();
    renderCurrentView();
    renderQueueList();
  } else {
    await showConfirm('Could not delete file.'); // optional – could be a simple alert replacement
  }
}

async function deleteSelected() {
  const tracksToDelete = Array.from(state.selectedTracks)
    .map(id => state.library.find(t => t.id === id))
    .filter(t => t);
  const msg = `Delete ${tracksToDelete.length} songs from disk? This cannot be undone.`;
  if (!await showConfirm(msg)) return;
  for (const track of tracksToDelete) {
    await window.koda.deleteFile(track.path);
    const idx = state.library.findIndex(t => t.id === track.id);
    if (idx !== -1) state.library.splice(idx, 1);
    state.favourites.delete(track.id);
    for (const pl of state.playlists) {
      const pos = pl.tracks.indexOf(track.id);
      if (pos !== -1) pl.tracks.splice(pos, 1);
    }
    const qidx = state.queue.findIndex(t => t.id === track.id);
    if (qidx !== -1) state.queue.splice(qidx, 1);
    if (state.currentTrack?.id === track.id) handleTrackEnd();
  }
  clearSelection();
  saveSettings();
  renderCurrentView();
  renderQueueList();
}

function showPlaylistPicker(track) {
  const picker = document.createElement('div');
  picker.style.position = 'fixed';
  picker.style.background = 'var(--bg-2)';
  picker.style.border = '1px solid var(--border)';
  picker.style.borderRadius = 'var(--radius-sm)';
  picker.style.padding = '12px';
  picker.style.zIndex = '10001';
  picker.style.minWidth = '180px';
  picker.style.left = `${window.event.clientX}px`;
  picker.style.top = `${window.event.clientY}px`;

  const header = document.createElement('div');
  header.textContent = 'Add to playlist';
  header.style.marginBottom = '8px';
  header.style.fontWeight = 'bold';
  picker.appendChild(header);

  for (const pl of state.playlists) {
    const btn = document.createElement('button');
    btn.textContent = pl.name;
    btn.style.display = 'block';
    btn.style.width = '100%';
    btn.style.background = 'none';
    btn.style.border = 'none';
    btn.style.padding = '6px';
    btn.style.cursor = 'pointer';
    btn.addEventListener('click', () => {
      if (!pl.tracks.includes(track.id)) pl.tracks.push(track.id);
      saveSettings();
      picker.remove();
    });
    picker.appendChild(btn);
  }
  const newBtn = document.createElement('button');
  newBtn.textContent = '+ Create new playlist';
  newBtn.style.marginTop = '8px';
  newBtn.style.color = 'var(--accent)';
  newBtn.addEventListener('click', () => {
    picker.remove();
    showPlaylistModal();
  });
  picker.appendChild(newBtn);
  document.body.appendChild(picker);

  const closePicker = (e) => {
    if (!picker.contains(e.target)) picker.remove();
  };
  setTimeout(() => document.addEventListener('click', closePicker), 0);
}

function addSelectedToPlaylist() {
  showPlaylistPickerForMultiple();
}

function showPlaylistPickerForMultiple() {
  const picker = document.createElement('div');
  picker.style.cssText = 'position:fixed; background:var(--bg-2); border:1px solid var(--border); border-radius:var(--radius-sm); padding:12px; z-index:10001; min-width:180px;';
  picker.style.left = `${window.event.clientX}px`;
  picker.style.top = `${window.event.clientY}px`;

  const header = document.createElement('div');
  header.textContent = `Add ${state.selectedTracks.size} songs to playlist`;
  header.style.marginBottom = '8px';
  header.style.fontWeight = 'bold';
  picker.appendChild(header);

  for (const pl of state.playlists) {
    const btn = document.createElement('button');
    btn.textContent = pl.name;
    btn.style.cssText = 'display:block; width:100%; background:none; border:none; padding:6px; cursor:pointer;';
    btn.addEventListener('click', () => {
      const newTracks = Array.from(state.selectedTracks).filter(id => !pl.tracks.includes(id));
      pl.tracks.push(...newTracks);
      saveSettings();
      picker.remove();
    });
    picker.appendChild(btn);
  }
  const newBtn = document.createElement('button');
  newBtn.textContent = '+ Create new playlist';
  newBtn.style.marginTop = '8px';
  newBtn.style.color = 'var(--accent)';
  newBtn.addEventListener('click', () => {
    picker.remove();
    showPlaylistModal();
  });
  picker.appendChild(newBtn);
  document.body.appendChild(picker);
  const close = (e) => { if (!picker.contains(e.target)) picker.remove(); };
  setTimeout(() => document.addEventListener('click', close), 0);
}

// ——— SELECTION MODE ———
function toggleSelectionMode() {
  state.selectionMode = !state.selectionMode;
  selectionModeBtn.classList.toggle('active', state.selectionMode);
  if (!state.selectionMode) clearSelection();
  renderCurrentView();
}

function clearSelection() {
  state.selectedTracks.clear();
  document.querySelectorAll('.song-checkbox').forEach(cb => cb.checked = false);
}

// ——— FAVOURITES ———
function toggleFavourite(trackId) {
  if (state.favourites.has(trackId)) {
    state.favourites.delete(trackId);
  } else {
    state.favourites.add(trackId);
  }
  saveSettings();
  updateHeartButton();
  if (state.currentView === 'favourites') renderCurrentView();
}

function updateHeartButton() {
  const heartBtn = $('fav-heart');
  if (!heartBtn) return;
  const isFav = state.currentTrack && state.favourites.has(state.currentTrack.id);
  heartBtn.classList.toggle('active', isFav);
  const svg = heartBtn.querySelector('svg');
  if (svg) {
    svg.setAttribute('fill', isFav ? 'var(--accent)' : 'none');
    svg.setAttribute('stroke', isFav ? 'var(--accent)' : 'currentColor');
  }
  heartBtn.style.color = isFav ? 'var(--accent)' : 'var(--text-secondary)';
}

function addHeartButton() {
  const playerInfo = $('player-info');
  if (!playerInfo.querySelector('#fav-heart')) {
    const heart = document.createElement('button');
    heart.id = 'fav-heart';
    heart.title = 'Add to Favourites';
    heart.className = 'ctrl-btn small';
    heart.style.marginTop = '6px';
    heart.innerHTML = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
    heart.addEventListener('click', () => {
      if (state.currentTrack) toggleFavourite(state.currentTrack.id);
    });
    playerInfo.appendChild(heart);
  }
}

function showNowPlayingExpanded() {
  let expanded = document.getElementById('now-playing-expanded');
  if (expanded) expanded.remove(); // always rebuild so state is fresh

  expanded = document.createElement('div');
  expanded.id = 'now-playing-expanded';
  expanded.innerHTML = `
    <div id="exp-bg"></div>
    <button id="close-expanded" title="Close">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
      Minimise
    </button>
    <div class="np-expanded-content">
      <div id="exp-art-wrap">
        <div id="exp-art-glow"></div>
        <img id="expanded-art" class="np-expanded-art" src="" alt="">
        <div id="expanded-art-empty">
          <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
        </div>
      </div>
      <div class="np-expanded-info">
        <div class="np-expanded-title" id="expanded-title">—</div>
        <div class="np-expanded-artist" id="expanded-artist">—</div>
        <div class="np-expanded-album" id="expanded-album"></div>
      </div>
      <div class="exp-seek-container">
        <span class="time-label" id="exp-time-cur">0:00</span>
        <div class="exp-seek-track">
          <div class="exp-seek-fill" id="exp-seek-fill"></div>
          <input type="range" class="exp-seek-bar" id="exp-seek-bar" min="0" max="100" value="0" step="0.1">
        </div>
        <span class="time-label" id="exp-time-tot">0:00</span>
      </div>
      <div class="exp-controls">
        <button class="exp-ctrl" id="exp-shuffle" title="Shuffle">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/></svg>
        </button>
        <button class="exp-ctrl" id="exp-prev" title="Previous">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5"/></svg>
        </button>
        <button class="exp-play-btn" id="exp-play" title="Play/Pause">
          <svg id="exp-icon-play" width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          <svg id="exp-icon-pause" width="28" height="28" viewBox="0 0 24 24" fill="currentColor" class="hidden"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
        </button>
        <button class="exp-ctrl" id="exp-next" title="Next">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>
        </button>
        <button class="exp-ctrl" id="exp-repeat" title="Repeat">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
        </button>
      </div>
      <div class="exp-vol-row">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.5"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/></svg>
        <div class="exp-vol-track">
          <div class="exp-vol-fill" id="exp-vol-fill"></div>
          <input type="range" class="exp-vol-bar" id="exp-vol-bar" min="0" max="1" step="0.01">
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.5"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
      </div>
    </div>
  `;
  document.body.appendChild(expanded);

  // Populate
  function syncExpanded() {
    const t = state.currentTrack;
    const expandedArt = document.getElementById('expanded-art');
    const expandedArtEmpty = document.getElementById('expanded-art-empty');
    const expBg = document.getElementById('exp-bg');
    const expGlow = document.getElementById('exp-art-glow');
    if (t) {
      document.getElementById('expanded-title').textContent = t.title || '—';
      document.getElementById('expanded-artist').textContent = t.artist || '—';
      document.getElementById('expanded-album').textContent = t.album || '';
      if (t.art) {
        expandedArt.src = t.art;
        expandedArt.classList.remove('hidden');
        expandedArtEmpty.classList.add('hidden');
        expBg.style.backgroundImage = `url(${t.art})`;
        expBg.style.opacity = '1';
        expGlow.style.background = getComputedStyle(document.documentElement).getPropertyValue('--accent');
        expGlow.style.opacity = '0.5';
      } else {
        expandedArt.classList.add('hidden');
        expandedArtEmpty.classList.remove('hidden');
        expBg.style.opacity = '0';
      }
    }
    // sync play/pause
    const ep = document.getElementById('exp-icon-play');
    const epp = document.getElementById('exp-icon-pause');
    if (ep && epp) {
      ep.classList.toggle('hidden', state.isPlaying);
      epp.classList.toggle('hidden', !state.isPlaying);
    }
    // sync shuffle/repeat
    const es = document.getElementById('exp-shuffle');
    const er = document.getElementById('exp-repeat');
    if (es) es.classList.toggle('active', state.shuffle);
    if (er) er.classList.toggle('active', state.repeatMode !== 'none');
    // sync volume
    const evb = document.getElementById('exp-vol-bar');
    const evf = document.getElementById('exp-vol-fill');
    if (evb) { evb.value = state.volume; evf.style.width = `${state.volume * 100}%`; }
    // sync seek
    if (audio.duration) {
      const pct = (audio.currentTime / audio.duration) * 100;
      const esf = document.getElementById('exp-seek-fill');
      const esb = document.getElementById('exp-seek-bar');
      if (esf) esf.style.width = `${pct}%`;
      if (esb) esb.value = pct;
      document.getElementById('exp-time-cur').textContent = formatDuration(audio.currentTime);
      document.getElementById('exp-time-tot').textContent = formatDuration(audio.duration);
    }
  }
  syncExpanded();

  // Controls
  document.getElementById('close-expanded').addEventListener('click', () => expanded.remove());
  document.getElementById('exp-prev').addEventListener('click', prevTrack);
  document.getElementById('exp-next').addEventListener('click', nextTrack);
  document.getElementById('exp-play').addEventListener('click', togglePlay);
  document.getElementById('exp-shuffle').addEventListener('click', () => { state.shuffle = !state.shuffle; updateShuffleBtn(); saveSettings(); syncExpanded(); });
  document.getElementById('exp-repeat').addEventListener('click', () => {
    const modes = ['none', 'all', 'one'];
    state.repeatMode = modes[(modes.indexOf(state.repeatMode) + 1) % modes.length];
    updateRepeatBtn(); saveSettings(); syncExpanded();
  });
  document.getElementById('exp-seek-bar').addEventListener('input', (e) => {
    if (audio.duration) {
      audio.currentTime = (e.target.value / 100) * audio.duration;
      document.getElementById('exp-seek-fill').style.width = `${e.target.value}%`;
    }
  });
  document.getElementById('exp-vol-bar').addEventListener('input', (e) => {
    state.volume = parseFloat(e.target.value);
    audio.volume = state.volume;
    document.getElementById('exp-vol-fill').style.width = `${state.volume * 100}%`;
    updateVolFill(); updateVolIcon();
  });

  // Live seek sync
  const seekSync = setInterval(() => {
    if (!document.getElementById('now-playing-expanded')) { clearInterval(seekSync); return; }
    if (audio.duration) {
      const pct = (audio.currentTime / audio.duration) * 100;
      const esf = document.getElementById('exp-seek-fill');
      const esb = document.getElementById('exp-seek-bar');
      if (esf) esf.style.width = `${pct}%`;
      if (esb) esb.value = pct;
      const ec = document.getElementById('exp-time-cur');
      if (ec) ec.textContent = formatDuration(audio.currentTime);
    }
    // sync play/pause
    const ep = document.getElementById('exp-icon-play');
    const epp = document.getElementById('exp-icon-pause');
    if (ep && epp) {
      ep.classList.toggle('hidden', state.isPlaying);
      epp.classList.toggle('hidden', !state.isPlaying);
    }
  }, 500);
}

function toggleLightTheme() {
  state.lightTheme = !state.lightTheme;
  if (state.lightTheme) document.body.classList.add('light');
  else document.body.classList.remove('light');
  saveSettings();
}

// ——— EVENTS ———
function bindEvents() {
  $('btn-min').addEventListener('click', () => window.koda.windowMinimize());
  $('btn-max').addEventListener('click', () => window.koda.windowMaximize());
  $('btn-close').addEventListener('click', () => window.koda.windowClose());

  btnPlay.addEventListener('click', togglePlay);
  $('btn-prev').addEventListener('click', prevTrack);
  $('btn-next').addEventListener('click', nextTrack);

  $('folder-btn').addEventListener('click', pickFolder);
  $('welcome-folder-btn').addEventListener('click', pickFolder);

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  searchInput.addEventListener('input', () => {
    state.searchQuery = searchInput.value;
    renderCurrentView();
  });

  $('detail-back').addEventListener('click', () => {
    detailView.classList.add('hidden');
    libraryView.classList.remove('hidden');
  });

  const settingsOverlay = $('settings-overlay');
  const settingsBtn = document.createElement('button');
  settingsBtn.id = 'settings-trigger';
  settingsBtn.title = 'Settings';
  settingsBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
  $('window-controls').insertBefore(settingsBtn, $('btn-min'));
  settingsBtn.addEventListener('click', () => settingsOverlay.classList.remove('hidden'));

  $('settings-close').addEventListener('click', () => settingsOverlay.classList.add('hidden'));
  settingsOverlay.addEventListener('click', (e) => {
    if (e.target === settingsOverlay) settingsOverlay.classList.add('hidden');
  });

  $('toggle-albums').addEventListener('change', (e) => {
    state.settings.showAlbums = e.target.checked;
    applySettings(); saveSettings();
  });
  $('toggle-artists').addEventListener('change', (e) => {
    state.settings.showArtists = e.target.checked;
    applySettings(); saveSettings();
  });
  $('toggle-genres').addEventListener('change', (e) => {
    state.settings.showGenres = e.target.checked;
    applySettings(); saveSettings();
  });
  $('toggle-theme').addEventListener('change', (e) => {
    state.settings.dynamicTheme = e.target.checked;
    if (!e.target.checked) resetTheme();
    else if (state.currentTrack?.art) extractAndApplyTheme(state.currentTrack.art);
    saveSettings();
  });

  const lightThemeRow = document.createElement('div');
  lightThemeRow.className = 'settings-section';
  lightThemeRow.innerHTML = `
    <h3>Appearance</h3>
    <label class="toggle-row">
      <span>Light theme</span>
      <input type="checkbox" id="toggle-light" ${state.lightTheme ? 'checked' : ''}>
      <span class="toggle-slider"></span>
    </label>
  `;
  const settingsModal = $('settings-modal');
  settingsModal.appendChild(lightThemeRow);
  document.getElementById('toggle-light').addEventListener('change', (e) => {
    state.lightTheme = e.target.checked;
    toggleLightTheme();
  });

  selectionModeBtn.addEventListener('click', toggleSelectionMode);

  // Expanded now-playing button
  const expandBtn = document.createElement('button');
  expandBtn.id = 'expand-nowplaying';
  expandBtn.title = 'Now Playing View';
  expandBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>`;
  expandBtn.style.background = 'none';
  expandBtn.style.border = 'none';
  expandBtn.style.cursor = 'pointer';
  expandBtn.style.marginLeft = '8px';
  expandBtn.style.color = 'var(--text-secondary)';
  expandBtn.addEventListener('click', showNowPlayingExpanded);
  $('player-info').appendChild(expandBtn);

  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    switch (e.code) {
      case 'Space': e.preventDefault(); togglePlay(); break;
      case 'ArrowRight': if (e.metaKey || e.ctrlKey) nextTrack(); else audio.currentTime += 5; break;
      case 'ArrowLeft': if (e.metaKey || e.ctrlKey) prevTrack(); else audio.currentTime -= 5; break;
      case 'ArrowUp': state.volume = Math.min(1, state.volume + 0.05); audio.volume = state.volume; volBar.value = state.volume; updateVolFill(); break;
      case 'ArrowDown': state.volume = Math.max(0, state.volume - 0.05); audio.volume = state.volume; volBar.value = state.volume; updateVolFill(); break;
    }
  });
}

// ——— UTILS ———
function formatDuration(secs) {
  if (!secs || isNaN(secs)) return '—';
  const s = Math.floor(secs);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}:${String(m % 60).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;
  return `${m}:${String(s % 60).padStart(2,'0')}`;
}

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ——— START ———
init();