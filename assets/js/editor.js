/**
 * Editor del álbum: modo edición, persistencia en localStorage,
 * export/import JSON. Compatible con GitHub Pages (sin backend).
 */
(function () {
  "use strict";

  var STORAGE_KEY = "album-editor-data";
  var MUSIC_STORAGE_KEY = "album-music-config";
  var IDB_NAME = "AlbumEditorDB";
  var IDB_STORE = "config";
  var IDB_MUSIC_KEY = "musicData";
  var MAX_PAGES = 100;
  /** Tamaño máximo del archivo de música en bytes (10 MB). IndexedDB permite mucho más que localStorage. */
  var MAX_MUSIC_SIZE_BYTES = 10 * 1024 * 1024;

  /**
   * Convierte las páginas del config por defecto al formato { id, title, image, content }.
   */
  function getDefaultPages() {
    var config = window.BOOK_CONFIG;
    if (!config || !Array.isArray(config.pages)) return [];
    return config.pages.map(function (p, i) {
      return {
        id: p.id != null ? p.id : i + 1,
        title: p.title != null ? p.title : (p.heading || "Página " + (i + 1)),
        image: p.image || "",
        content: p.content != null ? p.content : (p.message || "")
      };
    });
  }

  /**
   * Valida y devuelve el array de páginas desde localStorage, o null.
   */
  function loadFromStorage() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || !Array.isArray(data.pages)) return null;
      var pages = data.pages.slice(0, MAX_PAGES);
      for (var i = 0; i < pages.length; i++) {
        var p = pages[i];
        if (p.id == null) p.id = i + 1;
        if (p.title == null) p.title = "Página " + (i + 1);
        if (p.image == null) p.image = "";
        if (p.content == null) p.content = "";
      }
      return pages;
    } catch (e) {
      console.warn("AlbumEditor: error al cargar localStorage", e);
      return null;
    }
  }

  /**
   * Guarda las páginas en localStorage. Valida límite antes.
   */
  function saveToStorage(pages) {
    if (!Array.isArray(pages) || pages.length > MAX_PAGES) return false;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ pages: pages }));
      return true;
    } catch (e) {
      console.warn("AlbumEditor: error al guardar en localStorage", e);
      return false;
    }
  }

  /**
   * Aplica el array de páginas al BOOK_CONFIG (para que el libro las use).
   */
  function applyPagesToConfig(pages) {
    if (!window.BOOK_CONFIG) return;
    window.BOOK_CONFIG.pages = pages;
  }

  /**
   * Carga datos al iniciar: localStorage o por defecto. Debe llamarse antes de crear el libro.
   */
  function loadData() {
    var pages = loadFromStorage();
    if (pages == null) pages = getDefaultPages();
    applyPagesToConfig(pages);
  }

  /**
   * Siguiente id único (máximo actual + 1).
   */
  function nextId(pages) {
    var max = 0;
    for (var i = 0; i < pages.length; i++) {
      if (pages[i].id > max) max = pages[i].id;
    }
    return max + 1;
  }

  var panelOpen = false;
  var bookInstance = null;
  var selectEl, titleInput, contentInput, imagePreview, fileInput;
  var counterEl, btnSave, btnDelete, btnAddLeft, btnAddRight, btnExport, btnImport, importInput;
  var musicCheckbox, musicFileInput, volumeRange, volumeLabel, musicFileNameEl, audioEl;

  function getPages() {
    return window.BOOK_CONFIG && window.BOOK_CONFIG.pages ? window.BOOK_CONFIG.pages.slice() : [];
  }

  function refreshBook() {
    if (bookInstance && bookInstance.setConfig) {
      bookInstance.setConfig(window.BOOK_CONFIG);
    }
  }

  function updateCounter() {
    var pages = getPages();
    if (counterEl) counterEl.textContent = pages.length + " / " + MAX_PAGES;
  }

  function fillForm(page) {
    if (!page) return;
    if (titleInput) titleInput.value = page.title || "";
    if (contentInput) contentInput.value = page.content || "";
    if (imagePreview) {
      imagePreview.style.backgroundImage = page.image ? "url(" + page.image + ")" : "none";
      imagePreview.dataset.hasImage = page.image ? "1" : "0";
    }
    if (fileInput) fileInput.value = "";
  }

  function getSelectedPageIndex() {
    if (!selectEl || selectEl.selectedIndex < 0) return 0;
    return selectEl.selectedIndex;
  }

  function getSelectedPage() {
    var pages = getPages();
    var idx = getSelectedPageIndex();
    return pages[idx] || null;
  }

  function rebuildSelect() {
    if (!selectEl) return;
    var pages = getPages();
    selectEl.innerHTML = "";
    for (var i = 0; i < pages.length; i++) {
      var opt = document.createElement("option");
      opt.value = pages[i].id;
      opt.textContent = (i + 1) + ". " + (pages[i].title || "Sin título");
      selectEl.appendChild(opt);
    }
    if (pages.length > 0) {
      selectEl.selectedIndex = Math.min(getSelectedPageIndex(), pages.length - 1);
      fillForm(pages[selectEl.selectedIndex]);
    }
    updateCounter();
  }

  function onSave() {
    var pages = window.BOOK_CONFIG && window.BOOK_CONFIG.pages;
    if (!pages) return;
    var idx = getSelectedPageIndex();
    if (idx < 0 || idx >= pages.length) return;
    var page = pages[idx];

    page.title = titleInput ? titleInput.value.trim() : page.title;
    page.content = contentInput ? contentInput.value : page.content;

    if (!saveToStorage(pages)) return;
    applyPagesToConfig(pages);
    refreshBook();
    rebuildSelect();
    updateCounter();
  }

  function onDelete() {
    var pages = getPages();
    if (pages.length <= 0) return;
    if (!confirm("¿Está seguro de eliminar esta página?")) return;
    var idx = getSelectedPageIndex();
    pages.splice(idx, 1);
    if (!saveToStorage(pages)) return;
    applyPagesToConfig(pages);
    refreshBook();
    rebuildSelect();
    if (pages.length > 0) fillForm(pages[Math.min(idx, pages.length - 1)]);
    updateCounter();
  }

  /** Recalcula ids consecutivos (1, 2, 3, ...) en el array de páginas. */
  function recalcPageIds(pages) {
    for (var i = 0; i < pages.length; i++) pages[i].id = i + 1;
  }

  /**
   * Inserta una nueva página en la posición indicada.
   * @param {Array} pages - Copia del array de páginas
   * @param {number} atIndex - Índice donde insertar
   * @param {number} spreadIndexToShow - Índice de spread (libro) a dejar visible tras reconstruir (content idx + 1)
   */
  function insertPageAt(pages, atIndex, spreadIndexToShow) {
    if (pages.length >= MAX_PAGES) {
      alert("Máximo " + MAX_PAGES + " páginas.");
      return;
    }
    var newPage = {
      id: nextId(pages),
      title: "Nueva página",
      image: "",
      content: ""
    };
    pages.splice(atIndex, 0, newPage);
    recalcPageIds(pages);
    if (!saveToStorage(pages)) return;
    applyPagesToConfig(pages);
    refreshBook();
    rebuildSelect();
    selectEl.selectedIndex = atIndex;
    fillForm(pages[atIndex]);
    updateCounter();
    if (bookInstance && bookInstance.goToPage && spreadIndexToShow >= 0) {
      bookInstance.goToPage(spreadIndexToShow);
    }
  }

  function onAddLeft() {
    var pages = getPages();
    var idx = getSelectedPageIndex();
    insertPageAt(pages, idx, idx + 1);
  }

  function onAddRight() {
    var pages = getPages();
    var idx = getSelectedPageIndex();
    insertPageAt(pages, idx + 1, idx + 1);
  }

  function onImageChange(e) {
    var file = e.target && e.target.files && e.target.files[0];
    if (!file || !imagePreview) return;
    var reader = new FileReader();
    reader.onload = function (ev) {
      var dataUrl = ev.target && ev.target.result;
      if (dataUrl) {
        imagePreview.style.backgroundImage = "url(" + dataUrl + ")";
        imagePreview.dataset.hasImage = "1";
        var pages = window.BOOK_CONFIG && window.BOOK_CONFIG.pages;
        var idx = getSelectedPageIndex();
        if (pages && pages[idx]) pages[idx].image = dataUrl;
      }
    };
    reader.onerror = function () {
      console.warn("AlbumEditor: error al leer la imagen");
    };
    reader.readAsDataURL(file);
  }

  function onExport() {
    var pages = getPages();
    try {
      var json = JSON.stringify({ pages: pages }, null, 2);
      var blob = new Blob([json], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "album-paginas.json";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      console.warn("AlbumEditor: error al exportar", err);
      alert("Error al exportar JSON.");
    }
  }

  /**
   * Carga solo la parte pequeña de la config de música desde localStorage (musicEnabled, volume).
   * El archivo base64 se guarda en IndexedDB para no llenar localStorage.
   */
  function loadMusicConfig() {
    try {
      var raw = localStorage.getItem(MUSIC_STORAGE_KEY);
      if (!raw) return { musicEnabled: false, volume: 0.5, musicFileName: "" };
      var data = JSON.parse(raw);
      return {
        musicEnabled: data.musicEnabled === true,
        volume: typeof data.volume === "number" ? Math.max(0, Math.min(1, data.volume)) : 0.5,
        musicFileName: typeof data.musicFileName === "string" ? data.musicFileName : ""
      };
    } catch (e) {
      return { musicEnabled: false, volume: 0.5, musicFileName: "" };
    }
  }

  /** Guarda musicEnabled, volume y musicFileName en localStorage. El base64 se guarda en IndexedDB. */
  function saveMusicConfigSmall(cfg) {
    try {
      var payload = JSON.stringify({
        musicEnabled: cfg.musicEnabled === true,
        volume: typeof cfg.volume === "number" ? Math.max(0, Math.min(1, cfg.volume)) : 0.5,
        musicFileName: typeof cfg.musicFileName === "string" ? cfg.musicFileName : ""
      });
      localStorage.setItem(MUSIC_STORAGE_KEY, payload);
      return true;
    } catch (e) {
      console.warn("AlbumEditor: error al guardar config música", e);
      return false;
    }
  }

  /**
   * Guarda el base64 del audio en IndexedDB (mucho más espacio que localStorage).
   * callback(boolean success)
   */
  function saveMusicDataToIDB(dataUrl, callback) {
    var request = indexedDB.open(IDB_NAME, 1);
    request.onerror = function () { if (callback) callback(false); };
    request.onsuccess = function () {
      var db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) { if (callback) callback(false); return; }
      var tx = db.transaction(IDB_STORE, "readwrite");
      var store = tx.objectStore(IDB_STORE);
      store.put(dataUrl || "", IDB_MUSIC_KEY);
      tx.oncomplete = function () { if (callback) callback(true); };
      tx.onerror = function () { if (callback) callback(false); };
    };
    request.onupgradeneeded = function (e) {
      var db = e.target.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
    };
  }

  /**
   * Carga el base64 del audio desde IndexedDB. Si no hay, intenta migrar desde localStorage (datos antiguos).
   * callback(string musicData o "")
   */
  function loadMusicDataFromStorage(callback) {
    var request = indexedDB.open(IDB_NAME, 1);
    request.onerror = function () { tryLegacyAndCallback(""); };
    request.onsuccess = function () {
      var db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        tryLegacyAndCallback("");
        return;
      }
      var tx = db.transaction(IDB_STORE, "readonly");
      var getReq = tx.objectStore(IDB_STORE).get(IDB_MUSIC_KEY);
      getReq.onsuccess = function () {
        var data = getReq.result;
        if (typeof data === "string" && data.length > 0) {
          if (callback) callback(data);
          return;
        }
        tryLegacyAndCallback("");
      };
      getReq.onerror = function () { tryLegacyAndCallback(""); };
    };
    request.onupgradeneeded = function (e) {
      var db = e.target.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
    };

    function tryLegacyAndCallback(ifNoLegacy) {
      try {
        var raw = localStorage.getItem(MUSIC_STORAGE_KEY);
        if (!raw) { if (callback) callback(ifNoLegacy); return; }
        var data = JSON.parse(raw);
        var legacy = typeof data.musicData === "string" ? data.musicData : (typeof data.musicFile === "string" ? data.musicFile : "");
        if (legacy) {
          saveMusicDataToIDB(legacy, function () { if (callback) callback(legacy); });
          saveMusicConfigSmall({ musicEnabled: data.musicEnabled, volume: data.volume });
          return;
        }
      } catch (err) {}
      if (callback) callback(ifNoLegacy);
    }
  }

  /**
   * Guarda config de música: musicEnabled/volume en localStorage; musicData (base64) en IndexedDB.
   * cfg: { musicEnabled, volume, musicData (opcional) }
   */
  function saveMusicConfig(cfg) {
    if (!saveMusicConfigSmall(cfg)) return false;
    if (cfg && typeof cfg.musicData === "string") {
      saveMusicDataToIDB(cfg.musicData, function (ok) {
        if (!ok) console.warn("AlbumEditor: no se pudo guardar música en IndexedDB");
      });
    }
    return true;
  }

  /**
   * Aplica la configuración de música al elemento audio.
   * Si se pasa musicData (base64), se usa; si no, se carga desde IndexedDB/legacy y luego se aplica.
   */
  function applyMusicToAudio(musicDataOptional) {
    if (!audioEl) return;
    var cfg = loadMusicConfig();
    audioEl.volume = cfg.volume;

    function setSrcAndPlay(dataUrl) {
      if (dataUrl) audioEl.src = dataUrl; else audioEl.removeAttribute("src");
      if (cfg.musicEnabled && dataUrl) audioEl.play().catch(function () {}); else audioEl.pause();
    }

    if (musicDataOptional !== undefined) {
      setSrcAndPlay(musicDataOptional);
      return;
    }
    loadMusicDataFromStorage(setSrcAndPlay);
  }

  /** Rellena los controles de música con el estado guardado. */
  function fillMusicForm() {
    var cfg = loadMusicConfig();
    if (musicCheckbox) musicCheckbox.checked = cfg.musicEnabled;
    if (volumeRange) {
      volumeRange.value = String(cfg.volume);
      updateVolumeLabel(cfg.volume);
    }
    if (musicFileNameEl) musicFileNameEl.textContent = cfg.musicFileName || "Ningún archivo seleccionado";
  }

  function updateVolumeLabel(value) {
    if (volumeLabel) volumeLabel.textContent = Math.round(Number(value) * 100);
  }

  function onMusicEnabledChange() {
    var cfg = loadMusicConfig();
    cfg.musicEnabled = musicCheckbox ? musicCheckbox.checked : false;
    saveMusicConfig(cfg);
    applyMusicToAudio();
  }

  function onMusicFileChange(e) {
    var file = e.target && e.target.files && e.target.files[0];
    if (!file) return;

    var type = (file.type || "").toLowerCase();
    var isAudio = type === "audio/mp3" || type === "audio/mpeg" || type === "audio/mp4" || file.name.toLowerCase().endsWith(".mp3");
    if (!isAudio) {
      alert("Por favor elige un archivo de audio válido (MP3).");
      if (musicFileInput) musicFileInput.value = "";
      return;
    }

    var maxMB = MAX_MUSIC_SIZE_BYTES / 1024 / 1024;
    if (file.size > MAX_MUSIC_SIZE_BYTES) {
      alert("El archivo supera el límite. Tamaño máximo: " + maxMB + " MB. Tu archivo: " + (Math.round(file.size / 1024) + " KB."));
      if (musicFileInput) musicFileInput.value = "";
      return;
    }

    var reader = new FileReader();
    reader.onload = function (ev) {
      var dataUrl = ev.target && ev.target.result;
      if (typeof dataUrl !== "string" || dataUrl.length === 0) {
        alert("No se pudo leer el archivo.");
        if (musicFileInput) musicFileInput.value = "";
        return;
      }
      var cfg = loadMusicConfig();
      cfg.musicData = dataUrl;
      cfg.musicFileName = file.name;
      saveMusicConfig(cfg);
      saveMusicDataToIDB(dataUrl, function (ok) {
        if (!ok) alert("Error al guardar la música en el navegador. Prueba de nuevo.");
        applyMusicToAudio(dataUrl);
      });
      if (musicFileNameEl) musicFileNameEl.textContent = file.name;
      if (musicFileInput) musicFileInput.value = "";
    };
    reader.onerror = function () {
      alert("Error al leer el archivo. Comprueba que sea un MP3 válido.");
      if (musicFileInput) musicFileInput.value = "";
    };
    reader.readAsDataURL(file);
  }

  function onVolumeChange() {
    var val = volumeRange ? Number(volumeRange.value) : 0.5;
    updateVolumeLabel(val);
    var cfg = loadMusicConfig();
    cfg.volume = val;
    saveMusicConfig(cfg);
    if (audioEl) audioEl.volume = val;
  }

  function onImport(e) {
    var file = e.target && e.target.files && e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (ev) {
      try {
        var data = JSON.parse(ev.target.result);
        var list = data && data.pages && Array.isArray(data.pages) ? data.pages : [];
        if (list.length > MAX_PAGES) list = list.slice(0, MAX_PAGES);
        for (var i = 0; i < list.length; i++) {
          var p = list[i];
          if (p.id == null) p.id = i + 1;
          if (p.title == null) p.title = "Página " + (i + 1);
          if (p.image == null) p.image = "";
          if (p.content == null) p.content = "";
        }
        if (!saveToStorage(list)) return;
        applyPagesToConfig(list);
        refreshBook();
        rebuildSelect();
        updateCounter();
      } catch (err) {
        console.warn("AlbumEditor: error al importar", err);
        alert("El archivo JSON no es válido.");
      }
      importInput.value = "";
    };
    reader.readAsText(file);
  }

  function togglePanel() {
    panelOpen = !panelOpen;
    var panel = document.getElementById("editorPanel");
    var overlay = document.getElementById("editorOverlay");
    if (panel) panel.classList.toggle("editor-panel--open", panelOpen);
    if (overlay) overlay.classList.toggle("editor-overlay--visible", panelOpen);
    if (panelOpen) {
      rebuildSelect();
      fillMusicForm();
      if (bookInstance && bookInstance.goToPage) {
        var cur = bookInstance.currentIndex;
        var total = bookInstance.total;
        if (total > 2 && (cur === 0 || cur === total - 1)) {
          bookInstance.goToPage(getSelectedPageIndex() + 1);
        }
      }
    }
  }

  function createPanel() {
    var existing = document.getElementById("editorPanel");
    if (existing) return existing;

    var overlay = document.createElement("div");
    overlay.id = "editorOverlay";
    overlay.className = "editor-overlay";
    overlay.setAttribute("aria-hidden", "true");
    overlay.addEventListener("click", togglePanel);

    var panel = document.createElement("div");
    panel.id = "editorPanel";
    panel.className = "editor-panel";
    panel.setAttribute("aria-label", "Panel de edición del álbum");

    panel.innerHTML =
      '<div class="editor-panel__header">' +
        '<h2 class="editor-panel__title">Editar álbum</h2>' +
        '<button type="button" class="editor-panel__close" id="editorCloseBtn" aria-label="Cerrar">×</button>' +
      '</div>' +
      '<div class="editor-panel__body">' +
        '<p class="editor-counter" id="editorCounter">0 / ' + MAX_PAGES + '</p>' +
        '<label class="editor-label">Página actual</label>' +
        '<select id="editorPageSelect" class="editor-select"></select>' +
        '<label class="editor-label">Título</label>' +
        '<input type="text" id="editorTitle" class="editor-input" placeholder="Título de la página">' +
        '<label class="editor-label">Contenido</label>' +
        '<textarea id="editorContent" class="editor-textarea" placeholder="Texto de la página" rows="6"></textarea>' +
        '<label class="editor-label">Imagen</label>' +
        '<div class="editor-image-area">' +
          '<div class="editor-image-preview" id="editorImagePreview"></div>' +
          '<input type="file" id="editorImageInput" class="editor-file" accept="image/*">' +
        '</div>' +
        '<div class="editor-actions">' +
          '<button type="button" class="editor-btn editor-btn--primary" id="editorBtnSave">Guardar</button>' +
          '<button type="button" class="editor-btn editor-btn--danger" id="editorBtnDelete">Eliminar página</button>' +
          '<button type="button" class="editor-btn editor-btn--secondary" id="editorBtnAddLeft">Agregar página a la izquierda</button>' +
          '<button type="button" class="editor-btn editor-btn--secondary" id="editorBtnAddRight">Agregar página a la derecha</button>' +
        '</div>' +
        '<div class="editor-music-section">' +
          '<label class="editor-label">Música</label>' +
          '<label class="editor-checkbox-label"><input type="checkbox" id="editorMusicEnabled" class="editor-checkbox"> Activar música</label>' +
          '<label class="editor-label editor-label--inline">Archivo MP3</label>' +
          '<div class="editor-file-wrap">' +
            '<input type="file" id="editorMusicFile" class="editor-file" accept="audio/mp3,audio/mpeg,.mp3" aria-label="Seleccionar archivo MP3">' +
            '<span class="editor-file-btn">Seleccionar archivo</span>' +
          '</div>' +
          '<span class="editor-music-filename" id="editorMusicFileName" aria-live="polite">Ningún archivo seleccionado</span>' +
          '<label class="editor-label editor-label--inline">Volumen <span id="editorVolumePct">50</span>%</label>' +
          '<input type="range" id="editorVolume" class="editor-range" min="0" max="1" step="0.01" value="0.5">' +
        '</div>' +
        '<div class="editor-import-export">' +
          '<button type="button" class="editor-btn editor-btn--outline" id="editorBtnExport">Exportar JSON</button>' +
          '<label class="editor-btn editor-btn--outline editor-import-label">' +
            'Importar JSON <input type="file" id="editorImportInput" accept=".json,application/json" hidden></label>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);
    document.body.appendChild(panel);

    selectEl = document.getElementById("editorPageSelect");
    titleInput = document.getElementById("editorTitle");
    contentInput = document.getElementById("editorContent");
    imagePreview = document.getElementById("editorImagePreview");
    fileInput = document.getElementById("editorImageInput");
    counterEl = document.getElementById("editorCounter");
    btnSave = document.getElementById("editorBtnSave");
    btnDelete = document.getElementById("editorBtnDelete");
    btnAddLeft = document.getElementById("editorBtnAddLeft");
    btnAddRight = document.getElementById("editorBtnAddRight");
    btnExport = document.getElementById("editorBtnExport");
    importInput = document.getElementById("editorImportInput");
    musicCheckbox = document.getElementById("editorMusicEnabled");
    musicFileInput = document.getElementById("editorMusicFile");
    musicFileNameEl = document.getElementById("editorMusicFileName");
    volumeRange = document.getElementById("editorVolume");
    volumeLabel = document.getElementById("editorVolumePct");
    audioEl = document.getElementById("albumAudio");

    document.getElementById("editorCloseBtn").addEventListener("click", togglePanel);
    if (selectEl) selectEl.addEventListener("change", function () {
      fillForm(getSelectedPage());
      var idx = getSelectedPageIndex();
      if (bookInstance && bookInstance.goToPage) bookInstance.goToPage(idx + 1);
    });
    if (btnSave) btnSave.addEventListener("click", onSave);
    if (btnDelete) btnDelete.addEventListener("click", onDelete);
    if (btnAddLeft) btnAddLeft.addEventListener("click", onAddLeft);
    if (btnAddRight) btnAddRight.addEventListener("click", onAddRight);
    if (musicCheckbox) musicCheckbox.addEventListener("change", onMusicEnabledChange);
    if (musicFileInput) musicFileInput.addEventListener("change", onMusicFileChange);
    if (volumeRange) volumeRange.addEventListener("input", onVolumeChange);
    if (fileInput) fileInput.addEventListener("change", onImageChange);
    if (btnExport) btnExport.addEventListener("click", onExport);
    if (importInput) importInput.addEventListener("change", onImport);

    return panel;
  }

  /**
   * Inicializa el editor y enlaza con la instancia del libro.
   * @param {Object} book - Instancia de Book (window.bookInstance).
   */
  function init(book) {
    bookInstance = book;
    createPanel();
    updateCounter();
    fillMusicForm();

    var btnMode = document.getElementById("editorModeBtn");
    if (btnMode) btnMode.addEventListener("click", togglePanel);
  }

  /** Aplica la configuración de música guardada al audio. Llamar al cargar la página. */
  function initMusic() {
    audioEl = document.getElementById("albumAudio");
    applyMusicToAudio();
  }

  window.AlbumEditor = {
    loadData: loadData,
    init: init,
    initMusic: initMusic,
    MAX_PAGES: MAX_PAGES
  };
})();
