/**
 * Motor de resize visual usando escala + translate3d.
 */
(function () {
  "use strict";

  function clamp(value, min) {
    return value < min ? min : value;
  }

  function ResizeEngine(options) {
    this.selection = options.selection;
    this.stateMap = options.stateMap;
    this.isBlocked = options.isBlocked;
    this.onCommit = options.onCommit;
    this.pointerId = null;
    this.activeEl = null;
    this.resizing = false;
    this.dir = "";
    this.startX = 0;
    this.startY = 0;
    this.snapshot = null;
    this.next = null;
    this.rafId = 0;
    this.minSize = 24;
    this.limits = null;
  }

  ResizeEngine.prototype.ensureState = function (el) {
    var s = this.stateMap.get(el);
    if (!s) {
      s = { x: 0, y: 0, sx: 1, sy: 1, baseW: el.offsetWidth || 1, baseH: el.offsetHeight || 1 };
      this.stateMap.set(el, s);
    }
    return s;
  };

  ResizeEngine.prototype.applyTransform = function (el, s) {
    el.style.transform = "translate3d(" + s.x + "px," + s.y + "px,0) scale(" + s.sx + "," + s.sy + ")";
  };

  ResizeEngine.prototype.schedule = function () {
    var self = this;
    if (this.rafId) return;
    this.rafId = requestAnimationFrame(function () {
      self.rafId = 0;
      if (!self.resizing || !self.activeEl || !self.next) return;
      var s = self.ensureState(self.activeEl);
      s.x = self.next.x;
      s.y = self.next.y;
      s.sx = self.next.sx;
      s.sy = self.next.sy;
      self.applyTransform(self.activeEl, s);
    });
  };

  ResizeEngine.prototype.start = function (e) {
    if (this.isBlocked()) return false;
    if (e.pointerType === "mouse" && e.button !== 0) return false;
    if (!e.isPrimary) return false;

    var dir = this.selection.getHandleDirection(e.target);
    if (!dir) return false;

    var selected = this.selection.getSelected();
    if (!selected) return false;
    var box = selected.closest(".page-left, .page-right");
    if (!box) return false;

    var s = this.ensureState(selected);
    var width0 = s.baseW * s.sx;
    var height0 = s.baseH * s.sy;
    var elRect = selected.getBoundingClientRect();
    var boxRect = box.getBoundingClientRect();

    this.resizing = true;
    this.pointerId = e.pointerId;
    this.activeEl = selected;
    this.dir = dir;
    this.startX = e.clientX;
    this.startY = e.clientY;
    this.snapshot = {
      x: s.x,
      y: s.y,
      sx: s.sx,
      sy: s.sy,
      width: width0,
      height: height0,
      baseW: s.baseW,
      baseH: s.baseH,
      ratio: width0 / (height0 || 1)
    };
    this.limits = {
      maxEast: width0 + (boxRect.right - elRect.right),
      maxSouth: height0 + (boxRect.bottom - elRect.bottom),
      maxWest: width0 + (elRect.left - boxRect.left),
      maxNorth: height0 + (elRect.top - boxRect.top),
      minDxWest: boxRect.left - elRect.left,
      minDyNorth: boxRect.top - elRect.top
    };
    this.next = { x: s.x, y: s.y, sx: s.sx, sy: s.sy };

    this.activeEl.setPointerCapture(this.pointerId);
    e.preventDefault();
    e.stopPropagation();
    return true;
  };

  ResizeEngine.prototype.move = function (e) {
    if (!this.resizing || this.pointerId !== e.pointerId || !this.activeEl || !this.snapshot) return;
    if (this.isBlocked()) return;

    var dx = e.clientX - this.startX;
    var dy = e.clientY - this.startY;
    var snap = this.snapshot;
    var newX = snap.x;
    var newY = snap.y;
    var newW = snap.width;
    var newH = snap.height;

    if (this.dir.indexOf("e") !== -1) newW = snap.width + dx;
    if (this.dir.indexOf("s") !== -1) newH = snap.height + dy;
    if (this.dir.indexOf("w") !== -1) {
      newW = snap.width - dx;
      newX = snap.x + dx;
    }
    if (this.dir.indexOf("n") !== -1) {
      newH = snap.height - dy;
      newY = snap.y + dy;
    }

    var keepRatio = !!e.shiftKey; // preparado para uso futuro
    if (keepRatio) {
      var ratio = snap.ratio;
      if (this.dir.length === 2) {
        if (Math.abs(dx) >= Math.abs(dy)) newH = newW / ratio;
        else newW = newH * ratio;
      }
    }

    if (this.limits) {
      if (this.dir.indexOf("e") !== -1) newW = Math.min(newW, this.limits.maxEast);
      if (this.dir.indexOf("s") !== -1) newH = Math.min(newH, this.limits.maxSouth);
      if (this.dir.indexOf("w") !== -1) {
        newW = Math.min(newW, this.limits.maxWest);
        newX = Math.max(snap.x + this.limits.minDxWest, newX);
      }
      if (this.dir.indexOf("n") !== -1) {
        newH = Math.min(newH, this.limits.maxNorth);
        newY = Math.max(snap.y + this.limits.minDyNorth, newY);
      }
    }

    newW = clamp(newW, this.minSize);
    newH = clamp(newH, this.minSize);

    this.next.x = newX;
    this.next.y = newY;
    this.next.sx = newW / snap.baseW;
    this.next.sy = newH / snap.baseH;
    this.schedule();
    e.preventDefault();
  };

  ResizeEngine.prototype.end = function (e) {
    if (!this.resizing || this.pointerId !== e.pointerId) return;
    var el = this.activeEl;
    var snapshot = null;
    if (el) {
      var s = this.ensureState(el);
      snapshot = { x: s.x, y: s.y, scaleX: s.sx, scaleY: s.sy };
    }
    this.resizing = false;
    this.pointerId = null;
    this.activeEl = null;
    this.snapshot = null;
    this.next = null;
    this.limits = null;
    if (el) {
      try { el.releasePointerCapture(e.pointerId); } catch (_err) {}
    }
    if (el && snapshot && this.onCommit) this.onCommit(el, snapshot);
  };

  ResizeEngine.prototype.cancel = function () {
    var el = this.activeEl;
    var pid = this.pointerId;
    this.resizing = false;
    this.pointerId = null;
    this.activeEl = null;
    this.snapshot = null;
    this.next = null;
    this.limits = null;
    if (el && pid != null) {
      try { el.releasePointerCapture(pid); } catch (_err) {}
    }
  };

  window.BookResizeEngine = ResizeEngine;
})();
