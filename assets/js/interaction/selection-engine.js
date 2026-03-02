/**
 * Motor de selección: un solo elemento editable activo a la vez.
 */
(function () {
  "use strict";

  function buildSelectionFrame() {
    var frame = document.createElement("div");
    frame.className = "editable-selection-frame";
    var dirs = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
    for (var i = 0; i < dirs.length; i++) {
      var h = document.createElement("button");
      h.type = "button";
      h.className = "editable-resize-handle editable-resize-handle--" + dirs[i];
      h.setAttribute("data-resize-handle", dirs[i]);
      h.setAttribute("aria-label", "Redimensionar " + dirs[i]);
      frame.appendChild(h);
    }
    return frame;
  }

  function SelectionEngine(root) {
    this.root = root;
    this.selectedEl = null;
    this.frameEl = null;
  }

  SelectionEngine.prototype.getSelected = function () {
    return this.selectedEl;
  };

  SelectionEngine.prototype.isHandleTarget = function (target) {
    return !!(target && target.closest && target.closest("[data-resize-handle]"));
  };

  SelectionEngine.prototype.getHandleDirection = function (target) {
    var node = target && target.closest ? target.closest("[data-resize-handle]") : null;
    return node ? node.getAttribute("data-resize-handle") : null;
  };

  SelectionEngine.prototype.clear = function () {
    if (!this.selectedEl) return;
    this.selectedEl.classList.remove("is-selected-editable");
    if (this.frameEl && this.frameEl.parentNode) {
      this.frameEl.parentNode.removeChild(this.frameEl);
    }
    this.selectedEl = null;
    this.frameEl = null;
  };

  SelectionEngine.prototype.select = function (element) {
    if (!element || this.selectedEl === element) return;
    this.clear();
    this.selectedEl = element;
    this.selectedEl.classList.add("is-selected-editable");
    this.frameEl = buildSelectionFrame();
    this.selectedEl.appendChild(this.frameEl);
  };

  SelectionEngine.prototype.findEditableFromTarget = function (target) {
    if (!target || !target.closest) return null;
    var editable = target.closest("[data-editable='true']");
    if (!editable || !this.root.contains(editable)) return null;
    return editable;
  };

  window.BookSelectionEngine = SelectionEngine;
})();
