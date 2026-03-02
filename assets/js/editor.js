/**
 * Editor del álbum: modo edición, persistencia en localStorage,
 * export/import JSON. Compatible con GitHub Pages (sin backend).
 */
(function () {
  "use strict";

  var STORAGE_KEY = "album-editor-data";
  var MAX_PAGES = 100;

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
  var counterEl, btnSave, btnDelete, btnAdd, btnExport, btnImport, importInput;

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
    var idx = getSelectedPageIndex();
    pages.splice(idx, 1);
    if (!saveToStorage(pages)) return;
    applyPagesToConfig(pages);
    refreshBook();
    rebuildSelect();
    if (pages.length > 0) fillForm(pages[Math.min(idx, pages.length - 1)]);
    updateCounter();
  }

  function onAdd() {
    var pages = getPages();
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
    pages.push(newPage);
    if (!saveToStorage(pages)) return;
    applyPagesToConfig(pages);
    refreshBook();
    rebuildSelect();
    selectEl.selectedIndex = pages.length - 1;
    fillForm(newPage);
    updateCounter();
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
    if (panelOpen) rebuildSelect();
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
          '<button type="button" class="editor-btn editor-btn--secondary" id="editorBtnAdd">Agregar nueva página</button>' +
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
    btnAdd = document.getElementById("editorBtnAdd");
    btnExport = document.getElementById("editorBtnExport");
    importInput = document.getElementById("editorImportInput");

    document.getElementById("editorCloseBtn").addEventListener("click", togglePanel);
    if (selectEl) selectEl.addEventListener("change", function () { fillForm(getSelectedPage()); });
    if (btnSave) btnSave.addEventListener("click", onSave);
    if (btnDelete) btnDelete.addEventListener("click", onDelete);
    if (btnAdd) btnAdd.addEventListener("click", onAdd);
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

    var btnMode = document.getElementById("editorModeBtn");
    if (btnMode) btnMode.addEventListener("click", togglePanel);
  }

  window.AlbumEditor = {
    loadData: loadData,
    init: init,
    MAX_PAGES: MAX_PAGES
  };
})();
