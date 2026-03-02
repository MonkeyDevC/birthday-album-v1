/**
 * Orquestador de interacción (selección + drag + resize).
 * No altera la lógica de flip; se apoya en pointer events.
 */
(function () {
  "use strict";

  function EditorInteractions() {
    this.root = null;
    this.selection = null;
    this.drag = null;
    this.resize = null;
    this.stateMap = new WeakMap();
    this.observer = null;
    this.bound = false;
    this.onPointerDown = null;
    this.onPointerMove = null;
    this.onPointerUp = null;
    this.onPointerCancel = null;
  }

  EditorInteractions.prototype.isPageTurning = function () {
    return !!(window.bookInstance && window.bookInstance.animating);
  };

  EditorInteractions.prototype.isEditorModeActive = function () {
    var panel = document.getElementById("editorPanel");
    return !!(panel && panel.classList.contains("editor-panel--open"));
  };

  EditorInteractions.prototype.persistTransform = function (el, transform) {
    if (!el || !transform || !window.BookStore || typeof window.BookStore.syncElementTransform !== "function") return;
    var elementId = el.getAttribute("data-element-id");
    var pageId = el.getAttribute("data-page-id");
    if (!pageId && el.closest) {
      var p = el.closest("[data-page-id]");
      pageId = p ? p.getAttribute("data-page-id") : null;
    }
    if (!pageId || !elementId) return;
    window.BookStore.syncElementTransform(pageId, elementId, transform);
  };

  EditorInteractions.prototype.bind = function () {
    var self = this;
    if (!this.root || this.bound) return;

    this.onPointerDown = function (e) {
      if (!self.isEditorModeActive()) return;
      if (self.isPageTurning()) return;
      if (e.target.closest && e.target.closest(".hud-progress, .controls, .btn")) return;

      var resizeStarted = self.resize.start(e);
      if (resizeStarted) return;

      var editable = self.selection.findEditableFromTarget(e.target);
      if (editable) {
        self.selection.select(editable);
        self.drag.start(e);
        return;
      }

      self.selection.clear();
    };
    this.root.addEventListener("pointerdown", this.onPointerDown, { passive: false });

    this.onPointerMove = function (e) {
      if (!self.isEditorModeActive()) return;
      self.resize.move(e);
      self.drag.move(e);
    };
    window.addEventListener("pointermove", this.onPointerMove, { passive: false });

    this.onPointerUp = function (e) {
      self.resize.end(e);
      self.drag.end(e);
    };
    window.addEventListener("pointerup", this.onPointerUp);

    this.onPointerCancel = function (e) {
      self.resize.end(e);
      self.drag.end(e);
    };
    window.addEventListener("pointercancel", this.onPointerCancel);
    this.bound = true;
  };

  EditorInteractions.prototype.observeDom = function () {
    var self = this;
    if (!this.root || !window.MutationObserver) return;
    this.observer = new MutationObserver(function () {
      var selected = self.selection.getSelected();
      if (!selected) return;
      if (!self.root.contains(selected)) self.selection.clear();
    });
    this.observer.observe(this.root, { childList: true, subtree: true });
  };

  EditorInteractions.prototype.init = function (root) {
    if (this.bound) return;
    this.root = root;
    if (!this.root || !window.BookSelectionEngine || !window.BookDragEngine || !window.BookResizeEngine) return;

    this.selection = new window.BookSelectionEngine(this.root);
    this.drag = new window.BookDragEngine({
      selection: this.selection,
      stateMap: this.stateMap,
      isBlocked: this.isPageTurning.bind(this),
      onCommit: this.persistTransform.bind(this)
    });
    this.resize = new window.BookResizeEngine({
      selection: this.selection,
      stateMap: this.stateMap,
      isBlocked: this.isPageTurning.bind(this),
      onCommit: this.persistTransform.bind(this)
    });

    this.bind();
    this.observeDom();
  };

  EditorInteractions.prototype.destroy = function () {
    if (!this.bound) return;
    if (this.root && this.onPointerDown) this.root.removeEventListener("pointerdown", this.onPointerDown, false);
    if (this.onPointerMove) window.removeEventListener("pointermove", this.onPointerMove, false);
    if (this.onPointerUp) window.removeEventListener("pointerup", this.onPointerUp);
    if (this.onPointerCancel) window.removeEventListener("pointercancel", this.onPointerCancel);
    if (this.observer) this.observer.disconnect();
    if (this.drag && this.drag.cancel) this.drag.cancel();
    if (this.resize && this.resize.cancel) this.resize.cancel();
    if (this.selection) this.selection.clear();

    this.onPointerDown = null;
    this.onPointerMove = null;
    this.onPointerUp = null;
    this.onPointerCancel = null;
    this.observer = null;
    this.selection = null;
    this.drag = null;
    this.resize = null;
    this.root = null;
    this.bound = false;
  };

  window.BookInteractions = new EditorInteractions();
})();
