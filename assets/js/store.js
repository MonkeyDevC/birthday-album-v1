/**
 * Store central del libro (fuente de verdad de estado, no de render).
 * Mantiene estado inmutable, persistencia y suscripciones.
 */
(function () {
  "use strict";

  var STORAGE_KEY = "album-book-state-v1";
  var DEFAULT_MUSIC_STORAGE_KEY = "album-music-config";

  var initialized = false;
  var state = null;
  var listeners = [];

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function deepFreeze(obj) {
    if (!obj || typeof obj !== "object" || Object.isFrozen(obj)) return obj;
    Object.freeze(obj);
    var keys = Object.keys(obj);
    for (var i = 0; i < keys.length; i++) {
      deepFreeze(obj[keys[i]]);
    }
    return obj;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function safeParse(raw) {
    try {
      return JSON.parse(raw);
    } catch (_e) {
      return null;
    }
  }

  function readMusicMeta(musicStorageKey) {
    var raw = localStorage.getItem(musicStorageKey || DEFAULT_MUSIC_STORAGE_KEY);
    var data = raw ? safeParse(raw) : null;
    if (!data) {
      return { enabled: false, volume: 0.5 };
    }
    return {
      enabled: data.musicEnabled === true,
      volume: typeof data.volume === "number" ? clamp(data.volume, 0, 1) : 0.5
    };
  }

  function buildBasePages(configPages) {
    var pages = [{ id: "cover", locked: true, elements: [] }];
    var source = Array.isArray(configPages) ? configPages : [];

    for (var i = 0; i < source.length; i++) {
      var src = source[i] || {};
      var pid = src.id != null ? String(src.id) : "page-" + (i + 1);
      pages.push({ id: pid, locked: false, elements: [] });
    }

    pages.push({ id: "back-cover", locked: true, elements: [] });
    return pages;
  }

  function buildBaseState(config, musicStorageKey) {
    var now = new Date().toISOString();
    var cfg = config || {};
    return {
      bookId: "book-" + Date.now(),
      metadata: {
        title: typeof cfg.title === "string" && cfg.title ? cfg.title : "Libro sin título",
        createdAt: now,
        music: readMusicMeta(musicStorageKey)
      },
      pages: buildBasePages(cfg.pages)
    };
  }

  function normalizeState(candidate, fallbackConfig, musicStorageKey) {
    var base = buildBaseState(fallbackConfig, musicStorageKey);
    if (!candidate || typeof candidate !== "object") return base;

    var normalizedPages = Array.isArray(candidate.pages) && candidate.pages.length
      ? candidate.pages.map(function (p, idx) {
          var page = p || {};
          var pageId = page.id != null ? String(page.id) : "page-" + idx;
          var normalizedElements = Array.isArray(page.elements) ? page.elements.map(function (el) {
            var item = el || {};
            var t = item.transform || {};
            return {
              id: item.id != null ? String(item.id) : "",
              transform: {
                x: typeof t.x === "number" ? t.x : 0,
                y: typeof t.y === "number" ? t.y : 0,
                scaleX: typeof t.scaleX === "number" ? t.scaleX : 1,
                scaleY: typeof t.scaleY === "number" ? t.scaleY : 1
              }
            };
          }).filter(function (el) { return !!el.id; }) : [];
          return {
            id: pageId,
            locked: page.locked === true,
            elements: normalizedElements
          };
        })
      : base.pages;

    var metadata = candidate.metadata || {};
    var music = metadata.music || {};

    return {
      bookId: typeof candidate.bookId === "string" && candidate.bookId ? candidate.bookId : base.bookId,
      metadata: {
        title: typeof metadata.title === "string" && metadata.title ? metadata.title : base.metadata.title,
        createdAt: typeof metadata.createdAt === "string" && metadata.createdAt ? metadata.createdAt : base.metadata.createdAt,
        music: {
          enabled: music.enabled === true,
          volume: typeof music.volume === "number" ? clamp(music.volume, 0, 1) : base.metadata.music.volume
        }
      },
      pages: normalizedPages
    };
  }

  function persistCurrentState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function notify() {
    var snapshot = deepClone(state);
    for (var i = 0; i < listeners.length; i++) {
      try {
        listeners[i](snapshot);
      } catch (e) {
        console.warn("BookStore: listener error", e);
      }
    }
  }

  function setInternal(nextState) {
    state = deepFreeze(deepClone(nextState));
  }

  function bootstrap(options) {
    if (initialized && state) return deepClone(state);

    var opts = options || {};
    var config = opts.config || window.BOOK_CONFIG || {};
    var musicStorageKey = opts.musicStorageKey || DEFAULT_MUSIC_STORAGE_KEY;

    var raw = localStorage.getItem(STORAGE_KEY);
    var parsed = raw ? safeParse(raw) : null;
    var initial = parsed
      ? normalizeState(parsed, config, musicStorageKey)
      : buildBaseState(config, musicStorageKey);

    setInternal(initial);
    persistCurrentState();
    initialized = true;
    return deepClone(state);
  }

  function getState() {
    return state ? deepClone(state) : null;
  }

  function setState(updater) {
    if (!initialized || !state) {
      bootstrap({ config: window.BOOK_CONFIG || {} });
    }

    var prev = deepClone(state);
    var nextCandidate = typeof updater === "function" ? updater(prev) : updater;
    if (!nextCandidate || typeof nextCandidate !== "object") {
      return deepClone(state);
    }

    var next = normalizeState(nextCandidate, window.BOOK_CONFIG || {}, DEFAULT_MUSIC_STORAGE_KEY);
    setInternal(next);
    persistCurrentState();
    notify();
    return deepClone(state);
  }

  function subscribe(listener) {
    if (typeof listener !== "function") {
      return function () {};
    }
    listeners.push(listener);
    return function unsubscribe() {
      listeners = listeners.filter(function (l) { return l !== listener; });
    };
  }

  /**
   * Upsert inmutable de transformaciones por elemento dentro de una página.
   * Solo persiste al finalizar interacción (no por frame).
   */
  function syncElementTransform(pageId, elementId, transform) {
    if (!pageId || !elementId || !transform) return getState();
    var current = getState();
    if (!current || !Array.isArray(current.pages)) return getState();
    var pId = String(pageId);
    var eId = String(elementId);
    var currentPage = null;
    for (var i = 0; i < current.pages.length; i++) {
      if (String(current.pages[i].id) === pId) {
        currentPage = current.pages[i];
        break;
      }
    }
    if (!currentPage || currentPage.locked) return current;

    var tx = typeof transform.x === "number" ? transform.x : 0;
    var ty = typeof transform.y === "number" ? transform.y : 0;
    var tsx = typeof transform.scaleX === "number" ? transform.scaleX : 1;
    var tsy = typeof transform.scaleY === "number" ? transform.scaleY : 1;

    var currentEl = null;
    for (var c = 0; c < (currentPage.elements || []).length; c++) {
      if (String(currentPage.elements[c].id) === eId) {
        currentEl = currentPage.elements[c];
        break;
      }
    }
    if (currentEl && currentEl.transform &&
      currentEl.transform.x === tx &&
      currentEl.transform.y === ty &&
      currentEl.transform.scaleX === tsx &&
      currentEl.transform.scaleY === tsy) {
      return current;
    }

    return setState(function (prev) {
      var next = deepClone(prev);
      var page = null;
      for (var j = 0; j < next.pages.length; j++) {
        if (String(next.pages[j].id) === pId) {
          page = next.pages[j];
          break;
        }
      }
      if (!page || page.locked) return prev;

      if (!Array.isArray(page.elements)) page.elements = [];
      var idx = -1;
      for (var k = 0; k < page.elements.length; k++) {
        if (String(page.elements[k].id) === eId) {
          idx = k;
          break;
        }
      }

      var payload = {
        id: eId,
        transform: {
          x: tx,
          y: ty,
          scaleX: tsx,
          scaleY: tsy
        }
      };

      if (idx >= 0) page.elements[idx] = payload;
      else page.elements.push(payload);

      return next;
    });
  }

  window.BookStore = {
    STORAGE_KEY: STORAGE_KEY,
    bootstrap: bootstrap,
    getState: getState,
    setState: setState,
    subscribe: subscribe,
    syncElementTransform: syncElementTransform
  };
})();
