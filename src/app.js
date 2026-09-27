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
  layout: 'grid',
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
const searchClear  = $('search-clear');
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
  if (settings.layout === 'list' || settings.layout === 'grid') state.layout = settings.layout;
  if (settings.favourites) state.favourites = new Set(settings.favourites);
  if (settings.playlists) state.playlists = settings.playlists;

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
      artwork: getTrackArt(state.currentTrack) ? [{ src: getTrackArt(state.currentTrack), sizes: '512x512', type: 'image/jpeg' }] : []
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
function renderEmptyState(container, { icon = '♪', title = 'Nothing here yet', message = '', actionLabel = '', action = null } = {}) {
  container.innerHTML = '';
  const empty = document.createElement('div');
  empty.className = 'koda-empty-state';
  empty.innerHTML = `
    <div class="koda-empty-icon" aria-hidden="true">${icon}</div>
    <h2>${esc(title)}</h2>
    <p>${esc(message)}</p>
    ${actionLabel ? '<button type="button" class="koda-empty-action">' + esc(actionLabel) + '</button>' : ''}
  `;
  if (action && actionLabel) {
    empty.querySelector('.koda-empty-action').addEventListener('click', action);
  }
  container.appendChild(empty);
}

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
    if (!tracks.length) {
      const searching = Boolean(query);
      renderEmptyState(libraryView, {
        icon: '★',
        title: searching ? 'No favourites found' : 'No favourites yet',
        message: searching
          ? 'Try a different search term.'
          : 'Songs you favourite will appear here.',
        actionLabel: searching ? 'Clear search' : '',
        action: searching ? () => {
          searchInput.value = '';
          state.searchQuery = '';
          searchClear.classList.add('hidden');
          renderCurrentView();
        } : null
      });
    } else {
      renderSongList(tracks, libraryView);
    }
    return;
  }

  if (view === 'playlists') {
    detailView.classList.add('hidden');
    libraryView.classList.remove('hidden');
    viewTitle.textContent = 'Playlists';
    viewCount.textContent = `${state.playlists.length} playlists`;
    if (!state.playlists.length) {
      renderEmptyState(libraryView, {
        icon: '▤',
        title: 'No playlists yet',
        message: 'Create a playlist to keep your favourite songs together.',
        actionLabel: 'Create playlist',
        action: () => showPlaylistModal()
      });
    } else {
      renderPlaylists();
    }
    return;
  }

  detailView.classList.add('hidden');
  libraryView.classList.remove('hidden');

  if (view === 'songs') {
    viewTitle.textContent = 'Songs';
    viewCount.textContent = `${tracks.length} songs`;
    if (!tracks.length) {
      renderEmptyState(libraryView, {
        icon: query ? '⌕' : '♪',
        title: query ? 'No songs found' : 'Your library is empty',
        message: query ? 'Try searching by title, artist, album or genre.' : 'Choose a music folder to start building your library.',
        actionLabel: query ? 'Clear search' : 'Open Music Folder',
        action: query ? () => {
          searchInput.value = '';
          state.searchQuery = '';
          searchClear.classList.add('hidden');
          renderCurrentView();
        } : () => folderBtn.click()
      });
    } else {
      renderSongList(tracks, libraryView);
    }
  } else if (view === 'albums') {
    const albums = groupBy(tracks, 'album');
    viewTitle.textContent = 'Albums';
    viewCount.textContent = `${Object.keys(albums).length} albums`;
    if (!Object.keys(albums).length) {
      renderEmptyState(libraryView, {
        icon: '◉',
        title: query ? 'No albums found' : 'No albums yet',
        message: query ? 'Try a different search term.' : 'Albums will appear here once your library has music.',
        actionLabel: query ? 'Clear search' : '',
        action: query ? () => {
          searchInput.value = '';
          state.searchQuery = '';
          searchClear.classList.add('hidden');
          renderCurrentView();
        } : null
      });
    } else {
      renderGrid(albums, 'album', libraryView);
    }
  } else if (view === 'artists') {
    const artists = groupBy(tracks, 'artist');
    viewTitle.textContent = 'Artists';
    viewCount.textContent = `${Object.keys(artists).length} artists`;
    if (!Object.keys(artists).length) {
      renderEmptyState(libraryView, {
        icon: '●',
        title: query ? 'No artists found' : 'No artists yet',
        message: query ? 'Try a different search term.' : 'Artists will appear here once your library has music.',
        actionLabel: query ? 'Clear search' : '',
        action: query ? () => {
          searchInput.value = '';
          state.searchQuery = '';
          searchClear.classList.add('hidden');
          renderCurrentView();
        } : null
      });
    } else {
      renderGrid(artists, 'artist', libraryView);
    }
  } else if (view === 'genres') {
    const genres = groupBy(tracks, 'genre');
    viewTitle.textContent = 'Genres';
    viewCount.textContent = `${Object.keys(genres).length} genres`;
    if (!Object.keys(genres).length) {
      renderEmptyState(libraryView, {
        icon: '≡',
        title: query ? 'No genres found' : 'No genres yet',
        message: query ? 'Try a different search term.' : 'Genres will appear here once your library has music.',
        actionLabel: query ? 'Clear search' : '',
        action: query ? () => {
          searchInput.value = '';
          state.searchQuery = '';
          searchClear.classList.add('hidden');
          renderCurrentView();
        } : null
      });
    } else {
      renderGrid(genres, 'genre', libraryView);
    }
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
      ${state.detailContext?.type === 'playlist' ? '<th class="playlist-row-actions"></th>' : ''}
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
      ${state.detailContext?.type === 'playlist' ? '<td class="playlist-row-actions"><button type="button" class="playlist-remove-song" aria-label="Remove from playlist" title="Remove from playlist">×</button></td>' : ''}
    `;
    tr.innerHTML = rowHTML;

    const removeFromPlaylist = tr.querySelector('.playlist-remove-song');
    if (removeFromPlaylist) {
      removeFromPlaylist.addEventListener('click', (e) => {
        e.stopPropagation();
        const playlist = state.playlists.find(p => p.id === state.detailContext?.id);
        if (!playlist) return;
        playlist.tracks = playlist.tracks.filter(id => id !== track.id);
        saveSettings();
        openPlaylist(playlist.id);
      });
    }
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

function getTrackArt(track) {
  if (track?.art) return track.art;

  const album = track?.album;
  if (album) {
    const albumArt = state.library.find(t => t.album === album && t.art)?.art;
    if (albumArt) return albumArt;
  }

  const artist = track?.artist;
  if (artist) {
    return state.library.find(t => t.artist === artist && t.art)?.art || null;
  }

  return null;
}

function renderSongGrid(tracks, container) {
  const grid = document.createElement('div');
  grid.className = 'grid-view';
  tracks.forEach(track => {
    const card = document.createElement('div');
    card.className = 'grid-card song-grid-card';
    const artDiv = document.createElement('div');
    artDiv.className = 'grid-art';
    const displayArt = getTrackArt(track);
    if (displayArt) {
      const img = document.createElement('img');
      img.src = displayArt;
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
    card.addEventListener('click', (e) => {
      if (state.selectionMode) {
        if (e.target.closest('.grid-selection')) return;
        toggleTrackSelection(track.id);
        return;
      }
      const idx = tracks.findIndex(t => t.id === track.id);
      playFromList(tracks, idx);
    });

    if (state.selectionMode) {
      const select = document.createElement('button');
      select.type = 'button';
      select.className = 'grid-selection';
      select.title = state.selectedTracks.has(track.id) ? 'Deselect song' : 'Select song';
      select.setAttribute('aria-label', select.title);
      select.textContent = state.selectedTracks.has(track.id) ? '✓' : '';
      if (state.selectedTracks.has(track.id)) card.classList.add('selected');
      select.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleTrackSelection(track.id);
      });
      card.appendChild(select);
    }
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
    const artTrack = tracks.find(t => getTrackArt(t));
    const displayArt = artTrack ? getTrackArt(artTrack) : null;
    if (displayArt) {
      const img = document.createElement('img');
      img.src = displayArt;
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
function renderPlaylists(playlists = state.playlists) {
  libraryView.innerHTML = '';
  const container = document.createElement('div');
  container.className = 'grid-view';
  for (const pl of playlists) {
    const card = document.createElement('div');
    card.className = 'playlist-card';
    card.dataset.id = pl.id;
    const coverDiv = document.createElement('div');
    coverDiv.className = 'playlist-cover';
    if (pl.cover) {
      const img = document.createElement('img');
      img.src = pl.cover;
      coverDiv.appendChild(img);
    } else {
      coverDiv.textContent = '📀';
    }
    card.appendChild(coverDiv);
    const nameDiv = document.createElement('div');
    nameDiv.className = 'playlist-name';
    nameDiv.textContent = pl.name;
    card.appendChild(nameDiv);
    const metaDiv = document.createElement('div');
    metaDiv.className = 'playlist-meta';
    metaDiv.textContent = `${pl.tracks?.length || 0} songs`;
    if (pl.mood) metaDiv.textContent += ` · ${pl.mood}`;
    card.appendChild(metaDiv);

    // Delete button
    const delBtn = document.createElement('button');
    delBtn.innerHTML = '🗑️';
    delBtn.style.position = 'absolute';
    delBtn.style.top = '8px';
    delBtn.style.right = '8px';
    delBtn.style.background = 'none';
    delBtn.style.border = 'none';
    delBtn.style.cursor = 'pointer';
    delBtn.style.color = 'var(--text-muted)';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deletePlaylist(pl.id);
    });
    card.style.position = 'relative';
    card.appendChild(delBtn);

    card.addEventListener('click', () => openPlaylist(pl.id));
    container.appendChild(card);
  }
  const addCard = document.createElement('div');
  addCard.className = 'playlist-card';
  addCard.style.justifyContent = 'center';
  addCard.style.alignItems = 'center';
  addCard.innerHTML = '<div style="font-size:32px;">+</div><div>Create Playlist</div>';
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

  // Playlist actions
  const actions = document.createElement('div');
  actions.className = 'playlist-detail-actions';
  actions.style.marginLeft = 'auto';
  actions.style.display = 'flex';
  actions.style.alignItems = 'center';
  actions.style.gap = '6px';

  const makeAction = (label, onClick, primary = false) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.style.padding = '7px 12px';
    button.style.borderRadius = '18px';
    button.style.border = primary ? '0' : '1px solid var(--border)';
    button.style.background = primary ? 'var(--accent)' : 'var(--surface)';
    button.style.color = primary ? '#111' : 'var(--text-primary)';
    button.style.cursor = 'pointer';
    button.style.fontFamily = 'var(--font-ui)';
    button.style.fontSize = '11px';
    button.style.fontWeight = primary ? '600' : '500';
    button.addEventListener('click', onClick);
    return button;
  };

  const playButton = makeAction('Play All', () => {
    if (tracks.length) playFromList(tracks, 0);
  }, true);
  if (!tracks.length) { playButton.disabled = true; playButton.style.opacity = '.45'; }
  actions.appendChild(playButton);

  const shuffleButton = makeAction('Shuffle', () => {
    if (!tracks.length) return;
    playFromList(tracks, Math.floor(Math.random() * tracks.length));
  });
  if (!tracks.length) { shuffleButton.disabled = true; shuffleButton.style.opacity = '.45'; }
  actions.appendChild(shuffleButton);

  actions.appendChild(makeAction('+ Add Songs', () => showAddSongsModal(playlistId)));
  actions.appendChild(makeAction('Rename', () => showRenamePlaylistModal(playlistId)));
  actions.appendChild(makeAction('Delete', () => deletePlaylist(playlistId)));
  detailHeader.appendChild(actions);

  renderSongList(tracks, detailTracks);
  detailView.classList.add('view-fade');
  setTimeout(() => detailView.classList.remove('view-fade'), 200);
}

function showRenamePlaylistModal(playlistId) {
  const playlist = state.playlists.find(p => p.id === playlistId);
  if (!playlist) return;

  document.querySelectorAll('#rename-playlist-modal').forEach(el => el.remove());

  const modal = document.createElement('div');
  modal.id = 'rename-playlist-modal';
  modal.innerHTML = `
    <div class="rename-playlist-card" role="dialog" aria-modal="true" aria-labelledby="rename-playlist-title">
      <h3 id="rename-playlist-title">Rename Playlist</h3>
      <input class="rename-playlist-input" type="text" value="${esc(playlist.name)}" maxlength="120" autocomplete="off">
      <div class="rename-playlist-actions">
        <button type="button" class="rename-playlist-cancel">Cancel</button>
        <button type="button" class="rename-playlist-save">Save</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  const input = modal.querySelector('.rename-playlist-input');
  const close = () => modal.remove();

  const save = () => {
    const nextName = input.value.trim();
    if (!nextName) {
      input.focus();
      return;
    }
    playlist.name = nextName;
    saveSettings();
    close();
    openPlaylist(playlistId);
  };

  modal.querySelector('.rename-playlist-cancel').addEventListener('click', close);
  modal.querySelector('.rename-playlist-save').addEventListener('click', save);
  modal.addEventListener('click', e => {
    if (e.target === modal) close();
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') save();
    if (e.key === 'Escape') close();
  });

  requestAnimationFrame(() => {
    input.focus();
    input.select();
  });
}

function deletePlaylist(playlistId) {
  if (confirm('Delete this playlist? This action cannot be undone.')) {
    state.playlists = state.playlists.filter(p => p.id !== playlistId);
    saveSettings();
    if (state.currentView === 'playlists') renderCurrentView();
    if (state.detailContext?.type === 'playlist' && state.detailContext.id === playlistId) {
      detailView.classList.add('hidden');
      libraryView.classList.remove('hidden');
    }
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
  listContainer.innerHTML = '';
  state.library.forEach(track => {
    const row = document.createElement('div');
    row.className = 'song-row';
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '12px';
    row.style.padding = '8px';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'song-checkbox';
    cb.value = track.id;
    const titleSpan = document.createElement('span');
    titleSpan.textContent = track.title;
    titleSpan.style.flex = '1';
    const artistSpan = document.createElement('span');
    artistSpan.textContent = track.artist;
    artistSpan.style.color = 'var(--text-secondary)';
    row.appendChild(cb);
    row.appendChild(titleSpan);
    row.appendChild(artistSpan);
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
  const selected = Array.from(document.querySelectorAll('#add-songs-list .song-checkbox:checked')).map(cb => cb.value);
  const playlist = state.playlists.find(p => p.id === currentPlaylistForAdd);
  if (playlist) {
    const newTracks = selected.filter(id => !playlist.tracks.includes(id));
    playlist.tracks.push(...newTracks);
    saveSettings();
    if (state.detailContext?.type === 'playlist' && state.detailContext.id === currentPlaylistForAdd) {
      openPlaylist(currentPlaylistForAdd);
    }
  }
  document.getElementById('add-songs-modal').classList.add('hidden');
});

// ——— PLAYBACK ———
function playFromList(tracks, idx) {
  const selected = tracks[idx];
  if (state.shuffle) {
    const remaining = tracks.filter((_, i) => i !== idx);
    for (let i = remaining.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
    }
    state.queue = [selected, ...remaining];
    state.queueIndex = 0;
  } else {
    state.queue = [...tracks];
    state.queueIndex = idx;
  }
  playCurrentQueueItem();
}

function playCurrentQueueItem() {
  if (state.queueIndex < 0 || state.queueIndex >= state.queue.length) return;
  const track = state.queue[state.queueIndex];
  loadTrack(track);
  audio.play().catch(console.error);
}

function loadTrack(track) {
  state.currentTrack = track;
  audio.src = `file://${track.path.replace(/\\/g, '/')}`;

  playerTitle.textContent = track.title || '—';
  playerTitle.classList.remove('marquee-title');
  playerTitle.style.removeProperty('--marquee-distance');
  requestAnimationFrame(() => {
    const overflow = playerTitle.scrollWidth - playerTitle.clientWidth;
    if (overflow > 8) {
      playerTitle.style.setProperty('--marquee-distance', `${overflow}px`);
      playerTitle.classList.add('marquee-title');
    }
  });
  playerArtist.textContent = track.artist || '—';
  playerAlbum.textContent = track.album || '';

  const displayArt = getTrackArt(track);
  if (displayArt) {
    artImg.src = displayArt;
    artImg.classList.remove('hidden');
    artEmpty.classList.add('hidden');
    if (state.settings.dynamicTheme) {
      extractAndApplyTheme(displayArt);
    }
    npArt.src = displayArt;
    npArt.classList.remove('hidden');
  } else {
    artImg.classList.add('hidden');
    artEmpty.classList.remove('hidden');
    resetTheme();
    npArt.classList.add('hidden');
  }

  npTitle.textContent = track.title || '—';
  npArtist.textContent = track.artist || '—';
  npCard.classList.remove('hidden');

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
  updateExpandedNowPlaying();
});

audio.addEventListener('pause', () => {
  state.isPlaying = false;
  iconPlay.classList.remove('hidden');
  iconPause.classList.add('hidden');
  artGlow.style.opacity = '0';
  updateActiveRows();
  updateExpandedNowPlaying();
});

audio.addEventListener('ended', () => {
  handleTrackEnd();
});

audio.addEventListener('timeupdate', () => {
  updateExpandedNowPlaying();
  const cur = audio.currentTime;
  const dur = audio.duration || 0;
  timeCurrent.textContent = formatDuration(cur);
  if (dur) {
    const pct = (cur / dur) * 100;
    seekFill.style.width = `${pct}%`;
    seekBar.value = pct;
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

  const nextIdx = state.queueIndex + 1;

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
  if (!state.queue.length) return;
  let idx = state.queueIndex + 1;
  if (idx >= state.queue.length) idx = 0;
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
  if (state.currentTrack && state.queue.length && state.shuffle) {
    const remaining = state.queue.filter(t => t.id !== state.currentTrack.id);
    for (let i = remaining.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
    }
    state.queue = [state.currentTrack, ...remaining];
    state.queueIndex = 0;
    renderQueueList();
  }
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
  const expandedShuffle = document.getElementById('expanded-shuffle');
  if (expandedShuffle) expandedShuffle.classList.toggle('active', state.shuffle);
}

function updateRepeatBtn() {
  btnRepeat.classList.toggle('active', state.repeatMode !== 'none');
  const expandedRepeat = document.getElementById('expanded-repeat');
  if (expandedRepeat) {
    expandedRepeat.classList.toggle('active', state.repeatMode !== 'none');
    expandedRepeat.title = state.repeatMode === 'one'
      ? 'Repeat: One'
      : state.repeatMode === 'all'
        ? 'Repeat: All'
        : 'Repeat: Off';
  }
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
    layout: state.layout,
    favourites: Array.from(state.favourites),
    playlists: state.playlists,
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
    saveSettings();
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
  const msg = `Delete ${tracksToDelete.length} songs? This cannot be undone.`;
  if (!confirm(msg)) return;
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

function showPlaylistPicker(track, anchor) {
  document.querySelectorAll('.playlist-picker').forEach(el => el.remove());

  const picker = document.createElement('div');
  picker.className = 'playlist-picker';
  picker.innerHTML = '<div class="playlist-picker-title">Add to playlist</div>';

  if (!state.playlists.length) {
    const empty = document.createElement('div');
    empty.className = 'playlist-picker-empty';
    empty.textContent = 'No playlists yet';
    picker.appendChild(empty);
  }

  for (const pl of state.playlists) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'playlist-picker-item';
    btn.textContent = pl.name;
    btn.addEventListener('click', () => {
      if (!pl.tracks.includes(track.id)) pl.tracks.push(track.id);
      saveSettings();
      picker.remove();
    });
    picker.appendChild(btn);
  }

  const newBtn = document.createElement('button');
  newBtn.type = 'button';
  newBtn.className = 'playlist-picker-create';
  newBtn.textContent = '+ Create new playlist';
  newBtn.addEventListener('click', () => {
    picker.remove();
    showPlaylistModal();
  });
  picker.appendChild(newBtn);

  document.body.appendChild(picker);

  requestAnimationFrame(() => {
    const rect = anchor?.getBoundingClientRect?.();
    const pickerRect = picker.getBoundingClientRect();
    const margin = 8;
    if (rect) {
      let left = rect.left + (rect.width - pickerRect.width) / 2;
      let top = rect.top - pickerRect.height - margin;
      if (top < margin) top = rect.bottom + margin;
      left = Math.max(margin, Math.min(left, window.innerWidth - pickerRect.width - margin));
      top = Math.max(margin, Math.min(top, window.innerHeight - pickerRect.height - margin));
      picker.style.left = `${left}px`;
      picker.style.top = `${top}px`;
    }
  });

  const closePicker = (e) => {
    if (!picker.contains(e.target) && e.target !== anchor) {
      picker.remove();
      document.removeEventListener('click', closePicker);
    }
  };
  setTimeout(() => document.addEventListener('click', closePicker), 0);
}

function showTrackDetails(track) {
  document.querySelectorAll('.track-details-overlay').forEach(el => el.remove());

  const overlay = document.createElement('div');
  overlay.className = 'track-details-overlay';
  const inPlaylists = state.playlists.filter(pl => pl.tracks.includes(track.id));

  const row = (label, value) => `
    <div class="track-details-row">
      <span class="track-details-label">${esc(label)}</span>
      <span class="track-details-value">${esc(value || 'Not available')}</span>
    </div>`;

  overlay.innerHTML = `
    <div class="track-details-card" role="dialog" aria-modal="true" aria-labelledby="track-details-title">
      <div class="track-details-header">
        <div>
          <div class="track-details-kicker">SONG DETAILS</div>
          <h2 id="track-details-title">${esc(track.title || 'Unknown song')}</h2>
        </div>
        <button type="button" class="track-details-close" aria-label="Close details">✕</button>
      </div>
      <div class="track-details-body">
        ${row('Artist', track.artist)}
        ${track.album ? row('Album', track.album) : ''}
        ${row('In your playlists', inPlaylists.length ? inPlaylists.map(pl => pl.name).join(', ') : 'No')}
      </div>
    </div>`;

  document.body.appendChild(overlay);
  const close = () => {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  overlay.querySelector('.track-details-close').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', onKey);
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

function toggleTrackSelection(trackId) {
  if (state.selectedTracks.has(trackId)) state.selectedTracks.delete(trackId);
  else state.selectedTracks.add(trackId);
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
  if (isFav) {
    heartBtn.style.color = 'var(--accent)';
  } else {
    heartBtn.style.color = 'var(--text-secondary)';
  }
}

function addHeartButton() {
  const playerInfo = $('player-info');
  if (!playerInfo.querySelector('#fav-heart')) {
    const heart = document.createElement('button');
    heart.id = 'fav-heart';
    heart.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.07 5.82 22 7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
    heart.style.background = 'none';
    heart.style.border = 'none';
    heart.style.cursor = 'pointer';
    heart.style.marginLeft = '8px';
    heart.style.verticalAlign = 'middle';
    heart.addEventListener('click', () => {
      if (state.currentTrack) toggleFavourite(state.currentTrack.id);
    });
    playerInfo.appendChild(heart);
  }
}

function showNowPlayingMenu(e, track) {
  // Capture the clicked button's geometry before the event object loses currentTarget.
  const anchor = e.currentTarget || e.target;
  const anchorRect = anchor?.getBoundingClientRect?.() || npCard.getBoundingClientRect();

  // Reuse the existing context-menu actions.
  showContextMenu(e, track, false);
  const existing = Array.from(contextMenu.querySelectorAll('button'));
  existing.forEach(btn => btn.remove());
  const addOption = (text, handler, danger = false) => {
    const btn = document.createElement('button');
    btn.textContent = text;
    if (danger) btn.classList.add('danger');
    btn.addEventListener('click', () => {
      contextMenu.classList.add('hidden');
      handler();
    });
    contextMenu.appendChild(btn);
  };

  addOption('Add to playlist', () => showPlaylistPicker(track));
  addOption('View details', () => {
    const tracks = state.library.filter(t => t.album === track.album);
    openDetail('album', track.album, tracks);
  });
  addOption('Open album', () => {
    const tracks = state.library.filter(t => t.album === track.album);
    openDetail('album', track.album, tracks);
  });
  addOption('Open artist', () => {
    const tracks = state.library.filter(t => t.artist === track.artist);
    openDetail('artist', track.artist, tracks);
  });
  addOption('Delete from disk', () => deleteTrack(track), true);

  requestAnimationFrame(() => {
    const menuRect = contextMenu.getBoundingClientRect();
    const margin = 8;

    // Prefer opening upward from the anchor (especially the sidebar mini-card),
    // then use below, and finally clamp within the viewport.
    const spaceAbove = anchorRect.top - margin;
    const spaceBelow = window.innerHeight - anchorRect.bottom - margin;
    const fitsAbove = menuRect.height <= spaceAbove;
    const fitsBelow = menuRect.height <= spaceBelow;

    let left = anchorRect.left + (anchorRect.width - menuRect.width) / 2;
    let top;

    if (fitsAbove || !fitsBelow) {
      top = anchorRect.top - menuRect.height - margin;
    } else {
      top = anchorRect.bottom + margin;
    }

    left = Math.max(margin, Math.min(left, window.innerWidth - menuRect.width - margin));
    top = Math.max(margin, Math.min(top, window.innerHeight - menuRect.height - margin));

    contextMenu.style.maxHeight = 'calc(100vh - 16px)';
    contextMenu.style.overflowY = menuRect.height > window.innerHeight - 16 ? 'auto' : '';
    contextMenu.style.left = `${left}px`;
    contextMenu.style.top = `${top}px`;
  });
}

// ——— NOW PLAYING EXPANDED ———
function showNowPlayingExpanded() {
  let expanded = document.getElementById('now-playing-expanded');
  if (!expanded) {
    expanded = document.createElement('div');
    expanded.id = 'now-playing-expanded';
    expanded.className = 'hidden';
    expanded.innerHTML = '<div class="np-expanded-backdrop" id="expanded-backdrop"></div><button id="close-expanded" aria-label="Close now playing">✕</button><div class="np-expanded-content"><section class="np-expanded-main"><div class="np-expanded-art-wrap"><img id="expanded-art" class="np-expanded-art" src="" alt=""></div><div class="np-expanded-meta"><div class="np-expanded-kicker">NOW PLAYING</div><div class="np-expanded-title" id="expanded-title"></div><div class="np-expanded-artist" id="expanded-artist"></div><div class="np-expanded-album" id="expanded-album"></div></div><div class="np-expanded-progress"><span id="expanded-current">0:00</span><input id="expanded-seek" type="range" min="0" max="100" value="0" step="0.1"><span id="expanded-total">0:00</span></div><div class="np-expanded-controls"><button id="expanded-shuffle" class="ctrl-btn" aria-label="Shuffle" title="Shuffle"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h3c4 0 6 10 10 10h5"/><path d="m18 14 3 3-3 3"/><path d="M3 17h3c1.7 0 2.9-1.1 4-2.5M14 9.5C15.1 7.9 16.3 7 18 7h3"/><path d="m18 4 3 3-3 3"/></svg></button><button id="expanded-prev" class="ctrl-btn" aria-label="Previous" title="Previous"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5v14"/><path d="m18 6-8 6 8 6z"/></svg></button><button id="expanded-play" class="expanded-play-btn" aria-label="Play" title="Play"></button><button id="expanded-next" class="ctrl-btn" aria-label="Next" title="Next"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 8 6-8 6z"/><path d="M18 5v14"/></svg></button><button id="expanded-repeat" class="ctrl-btn" aria-label="Repeat" title="Repeat: Off"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 3l4 4-4 4"/><path d="M3 7h14a4 4 0 0 1 4 4v0"/><path d="m7 21-4-4 4-4"/><path d="M21 17H7a4 4 0 0 1-4-4v0"/></svg></button></div><div class="np-expanded-actions" id="expanded-actions"></div></section><section class="np-expanded-column"><div class="np-expanded-section-title">UP NEXT</div><div id="expanded-queue" class="np-expanded-list"></div></section><section class="np-expanded-column"><div class="np-expanded-section-title">FROM THIS ALBUM</div><div id="expanded-related" class="np-expanded-list"></div></section></div>';
    document.body.appendChild(expanded);
    const closeExpanded = () => expanded.classList.add('hidden');
    document.getElementById('close-expanded').addEventListener('click', closeExpanded);
    document.getElementById('expanded-backdrop').addEventListener('click', closeExpanded);
    expanded.addEventListener('click', (e) => {
      // Clicking the overlay itself/backdrop closes NPV; clicks inside the
      // actual content are left alone.
      if (e.target === expanded) closeExpanded();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !expanded.classList.contains('hidden')) closeExpanded();
    });
    document.getElementById('expanded-prev').addEventListener('click', (e) => {
      e.stopPropagation();
      prevTrack();
    });
    document.getElementById('expanded-next').addEventListener('click', (e) => {
      e.stopPropagation();
      nextTrack();
    });
    document.getElementById('expanded-play').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!state.currentTrack) return;
      if (audio.paused) {
        try {
          await audio.play();
        } catch (err) {
          console.error('Expanded play failed:', err);
        }
      } else {
        audio.pause();
      }
      updateExpandedNowPlaying();
    });
    document.getElementById('expanded-shuffle').addEventListener('click', (e) => {
      e.stopPropagation();
      btnShuffle.click();
      updateExpandedNowPlaying();
    });
    document.getElementById('expanded-repeat').addEventListener('click', (e) => {
      e.stopPropagation();
      btnRepeat.click();
      updateExpandedNowPlaying();
    });
    const expandedActions = document.getElementById('expanded-actions');
    const expandedAction = (label, icon, handler, danger = false) => {
      const btn = document.createElement('button');
      btn.className = 'expanded-action' + (danger ? ' danger' : '');
      btn.type = 'button';
      btn.setAttribute('aria-label', label);
      btn.dataset.tooltip = label;
      btn.innerHTML = icon;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (state.currentTrack) handler(state.currentTrack, btn, e);
      });
      expandedActions.appendChild(btn);
    };
    expandedAction('Favourite', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/></svg>', (track) => { toggleFavourite(track.id); updateExpandedNowPlaying(); });
    expandedAction('Add to playlist', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-2"/><path d="M8 11h7M8 15h5M19 11v8M15 15h8"/></svg>', (track, btn) => showPlaylistPicker(track, btn));
    expandedAction('Details', '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 10v6M12 7h.01"/></svg>', (track) => showTrackDetails(track));
    expandedAction('Delete', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3"/></svg>', (track) => deleteTrack(track), true);
    document.getElementById('expanded-seek').addEventListener('input', (e) => { if (audio.duration) audio.currentTime = (Number(e.target.value) / 100) * audio.duration; });
  }
  updateExpandedNowPlaying();
  expanded.classList.remove('hidden');
}

function updateExpandedNowPlaying() {
  const expanded = document.getElementById('now-playing-expanded');
  if (!expanded || !state.currentTrack) return;
  const track = state.currentTrack;
  const displayArt = getTrackArt(track);
  const expandedArt = document.getElementById('expanded-art');
  const expandedArtWrap = expandedArt.closest('.np-expanded-art-wrap');

  if (displayArt) {
    expandedArt.src = displayArt;
    expandedArt.style.display = 'block';
    expandedArtWrap.classList.remove('no-art');
    document.getElementById('expanded-backdrop').style.backgroundImage = 'url("' + displayArt + '")';
  } else {
    expandedArt.removeAttribute('src');
    expandedArt.style.display = 'none';
    expandedArtWrap.classList.add('no-art');
    document.getElementById('expanded-backdrop').style.backgroundImage = '';
  }
  const expandedTitle = document.getElementById('expanded-title');
  const expandedTitleText = track.title || '—';
  if (expandedTitle.dataset.marqueeText !== expandedTitleText) {
    expandedTitle.dataset.marqueeText = expandedTitleText;
    expandedTitle.textContent = expandedTitleText;
    expandedTitle.classList.remove('marquee-title');
    expandedTitle.style.removeProperty('--marquee-distance');
    requestAnimationFrame(() => {
      if (!expandedTitle.isConnected || expandedTitle.dataset.marqueeText !== expandedTitleText) return;
      const overflow = expandedTitle.scrollWidth - expandedTitle.clientWidth;
      if (overflow > 8) {
        expandedTitle.style.setProperty('--marquee-distance', `${overflow}px`);
        expandedTitle.classList.add('marquee-title');
      }
    });
  }
  document.getElementById('expanded-artist').textContent = track.artist || '—';
  document.getElementById('expanded-album').textContent = track.album || '';
  document.getElementById('expanded-current').textContent = formatDuration(audio.currentTime || 0);
  document.getElementById('expanded-total').textContent = formatDuration(audio.duration || track.duration || 0);
  document.getElementById('expanded-seek').value = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
  const expandedPlay = document.getElementById('expanded-play');
  if (expandedPlay) {
    expandedPlay.innerHTML = state.isPlaying
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5v14M17 5v14"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7z"/></svg>';
    expandedPlay.setAttribute('aria-label', state.isPlaying ? 'Pause' : 'Play');
    expandedPlay.title = state.isPlaying ? 'Pause' : 'Play';
    expandedPlay.classList.toggle('is-playing', state.isPlaying);
  }
  document.getElementById('expanded-shuffle').classList.toggle('active', state.shuffle);
  document.getElementById('expanded-repeat').classList.toggle('active', state.repeatMode !== 'none');
  const heart = document.querySelector('.expanded-action[aria-label="Favourite"]');
  const fav = state.favourites.has(track.id);
  if (heart) heart.classList.toggle('active', fav);
  const queue = document.getElementById('expanded-queue'); queue.innerHTML = '';
  state.queue.slice(state.queueIndex + 1).forEach((t, i) => {
    const row = document.createElement('button'); row.className = 'np-expanded-list-item';
    row.innerHTML = '<span class="np-list-index">' + (i + 1) + '</span><span class="np-list-text"><strong>' + esc(t.title) + '</strong><small>' + esc(t.artist) + '</small></span>';
    row.addEventListener('click', () => { const idx = state.queue.findIndex(q => q.id === t.id); if (idx >= 0) { state.queueIndex = idx; playCurrentQueueItem(); updateExpandedNowPlaying(); } });
    queue.appendChild(row);
  });
  if (!queue.children.length) queue.innerHTML = '<div class="np-empty">Nothing queued</div>';
  const related = document.getElementById('expanded-related'); related.innerHTML = '';
  state.library.filter(t => t.album === track.album && t.id !== track.id).slice(0, 12).forEach(t => {
    const row = document.createElement('button'); row.className = 'np-expanded-list-item';
    const relatedArt = getTrackArt(t);
    row.innerHTML = '<span class="np-list-art">' + (relatedArt ? '<img src="' + relatedArt + '" alt="">' : '♪') + '</span><span class="np-list-text"><strong>' + esc(t.title) + '</strong><small>' + esc(t.artist) + '</small></span>';
    row.addEventListener('click', () => { const tracks = state.library.filter(x => x.album === t.album); playFromList(tracks, tracks.findIndex(x => x.id === t.id)); updateExpandedNowPlaying(); });
    related.appendChild(row);
  });
  if (!related.children.length) related.innerHTML = '<div class="np-empty">No other songs from this album</div>';
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
    state.searchQuery = searchInput.value.trim();
    searchClear.classList.toggle('hidden', !state.searchQuery);
    renderCurrentView();
  });

  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    state.searchQuery = '';
    searchClear.classList.add('hidden');
    searchInput.focus();
    renderCurrentView();
  });

  // Type anywhere to start searching, unless the user is interacting with another control.
  // Use capture so the shortcut still works when focus is on a nested/non-editable UI element.
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;

    const target = e.target;
    const isEditable = target instanceof Element && (
      target.matches('input, textarea, select, [contenteditable="true"]')
    );
    if (isEditable) return;

    if (e.key === 'Escape') {
      searchInput.value = '';
      state.searchQuery = '';
      searchClear.classList.add('hidden');
      if (document.activeElement === searchInput) searchInput.blur();
      renderCurrentView();
      return;
    }

    // Space remains the global play/pause shortcut; every other printable
    // character starts a search immediately.
    if (e.key.length !== 1 || e.key === ' ') return;

    searchInput.focus({ preventScroll: true });
    const start = searchInput.value.length;
    searchInput.setSelectionRange(start, start);
    searchInput.value += e.key;
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    e.preventDefault();
  }, true);

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

  const aboutOverlay = $('about-overlay');
  const closeAbout = () => aboutOverlay.classList.add('hidden');
  $('about-btn').addEventListener('click', () => aboutOverlay.classList.remove('hidden'));
  $('about-close').addEventListener('click', closeAbout);
  aboutOverlay.addEventListener('click', (e) => {
    if (e.target === aboutOverlay) closeAbout();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !aboutOverlay.classList.contains('hidden')) closeAbout();
  });

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
    document.body.classList.toggle('light', state.lightTheme);
    saveSettings();
  });

  selectionModeBtn.addEventListener('click', toggleSelectionMode);

  npCard.addEventListener('click', (e) => {
    if (e.target.closest('.np-action-btn')) return;
    if (state.currentTrack) showNowPlayingExpanded();
  });

  const npMenuBtn = document.createElement('button');
  npMenuBtn.className = 'np-menu-btn';
  npMenuBtn.type = 'button';
  npMenuBtn.title = 'More options';
  npMenuBtn.setAttribute('aria-label', 'More options');
  npMenuBtn.textContent = '⋯';
  npCard.appendChild(npMenuBtn);
  npMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (state.currentTrack) showNowPlayingMenu(e, state.currentTrack);
  });

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
  expandBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    showNowPlayingExpanded();
  });
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