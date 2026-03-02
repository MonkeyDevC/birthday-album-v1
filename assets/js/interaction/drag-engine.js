/**
 * Motor de drag usando translate3d + rAF.
 */
(function () {
  "use strict";

  function DragEngine(options) {
    this.selection = options.selection;
    this.stateMap = options.stateMap;
    this.isBlocked = options.isBlocked;
    this.onCommit = options.onCommit;
    this.pointerId = null;
    this.activeEl = null;
    this.pending = false;
    this.dragging = false;
    this.hasMoved = false;
    this.startX = 0;
    this.startY = 0;
    this.originX = 0;
    this.originY = 0;
    this.nextX = 0;
    this.nextY = 0;
    this.dragThreshold = 4;
    this.bounds = null;
    this.rafId = 0;
  }

  DragEngine.prototype.ensureState = function (el) {
    var s = this.stateMap.get(el);
    if (!s) {
      s = { x: 0, y: 0, sx: 1, sy: 1, baseW: el.offsetWidth || 1, baseH: el.offsetHeight || 1 };
      this.stateMap.set(el, s);
    }
    return s;
  };

  DragEngine.prototype.applyTransform = function (el, s) {
    el.style.transform = "translate3d(" + s.x + "px," + s.y + "px,0) scale(" + s.sx + "," + s.sy + ")";
  };

  DragEngine.prototype.schedule = function () {
    var self = this;
    if (this.rafId) return;
    this.rafId = requestAnimationFrame(function () {
      self.rafId = 0;
      if (!self.dragging || !self.activeEl) return;
      var s = self.ensureState(self.activeEl);
      s.x = self.nextX;
      s.y = self.nextY;
      self.applyTransform(self.activeEl, s);
    });
  };

  DragEngine.prototype.start = function (e) {
    if (this.isBlocked()) return false;
    if (e.pointerType === "mouse" && e.button !== 0) return false;
    if (!e.isPrimary) return false;
    if (this.selection.isHandleTarget(e.target)) return false;

    var selected = this.selection.getSelected();
    if (!selected || !selected.contains(e.target)) return false;

    var s = this.ensureState(selected);
    var box = selected.closest(".page-left, .page-right");
    if (!box) return false;
    var elRect = selected.getBoundingClientRect();
    var boxRect = box.getBoundingClientRect();

    this.pending = true;
    this.dragging = false;
    this.hasMoved = false;
    this.pointerId = e.pointerId;
    this.activeEl = selected;
    this.startX = e.clientX;
    this.startY = e.clientY;
    this.originX = s.x;
    this.originY = s.y;
    this.nextX = s.x;
    this.nextY = s.y;
    this.bounds = {
      minX: s.x + (boxRect.left - elRect.left),
      maxX: s.x + (boxRect.right - elRect.right),
      minY: s.y + (boxRect.top - elRect.top),
      maxY: s.y + (boxRect.bottom - elRect.bottom)
    };

    e.stopPropagation();
    return true;
  };

  DragEngine.prototype.move = function (e) {
    if ((!this.dragging && !this.pending) || this.pointerId !== e.pointerId || !this.activeEl) return;
    if (this.isBlocked()) return;

    var dx = e.clientX - this.startX;
    var dy = e.clientY - this.startY;
    if (!this.dragging) {
      var dist2 = dx * dx + dy * dy;
      if (dist2 < this.dragThreshold * this.dragThreshold) return;
      this.dragging = true;
      this.pending = false;
      this.hasMoved = true;
      this.activeEl.setPointerCapture(this.pointerId);
      this.activeEl.style.cursor = "grabbing";
    }

    this.nextX = this.originX + dx;
    this.nextY = this.originY + dy;
    if (this.bounds) {
      this.nextX = Math.max(this.bounds.minX, Math.min(this.bounds.maxX, this.nextX));
      this.nextY = Math.max(this.bounds.minY, Math.min(this.bounds.maxY, this.nextY));
    }
    this.schedule();
    e.preventDefault();
  };

  DragEngine.prototype.end = function (e) {
    if ((!this.dragging && !this.pending) || this.pointerId !== e.pointerId) return;
    var el = this.activeEl;
    var didCommit = this.dragging && this.hasMoved && !!el;
    var snapshot = null;
    if (didCommit) {
      var s = this.ensureState(el);
      snapshot = { x: s.x, y: s.y, scaleX: s.sx, scaleY: s.sy };
    }
    this.pending = false;
    this.dragging = false;
    this.hasMoved = false;
    this.pointerId = null;
    this.activeEl = null;
    this.bounds = null;
    if (el) {
      try { el.releasePointerCapture(e.pointerId); } catch (_err) {}
      el.style.cursor = "move";
    }
    if (didCommit && this.onCommit) this.onCommit(el, snapshot);
  };

  DragEngine.prototype.cancel = function () {
    var el = this.activeEl;
    var pid = this.pointerId;
    this.pending = false;
    this.dragging = false;
    this.hasMoved = false;
    this.pointerId = null;
    this.bounds = null;
    if (el && pid != null) {
      try { el.releasePointerCapture(pid); } catch (_err) {}
      el.style.cursor = "move";
    }
    this.activeEl = null;
  };

  window.BookDragEngine = DragEngine;
})();
