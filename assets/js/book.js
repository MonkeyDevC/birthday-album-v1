/**
 * Lógica del libro 3D: renderizado de páginas y navegación.
 * Sin dependencias externas; compatible con GitHub Pages.
 */
(function () {
  "use strict";

  function escapeHtml(str) {
    if (str == null) return "";
    var s = String(str);
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeAttr(str) {
    if (str == null) return "";
    return String(str).replace(/"/g, "&quot;");
  }

  window.Book = function (config) {
    this.config = config || {};
    this.spreads = [];
    this.currentIndex = 0;
    this.total = 0;
    this.container = null;
    this.statusEl = null;
    this.progressEl = null;
    this.btnPrev = null;
    this.btnNext = null;
    this.btnHome = null;
    this.animating = false;
  };

  Book.prototype.init = function () {
    this.container = document.getElementById("bookContainer");
    this.statusEl = document.getElementById("statusText");
    this.progressEl = document.getElementById("hudProgress");
    this.btnPrev = document.getElementById("btnPrev");
    this.btnNext = document.getElementById("btnNext");
    this.btnHome = document.getElementById("btnHome");

    if (!this.container) return;

    this.buildSpreads();
    this.render();
    this.updateUI();
    this.bindEvents();

    var bookContainer = this.container;
    requestAnimationFrame(function () {
      bookContainer.classList.add("is-open");
    });
  };

  Book.prototype.buildSpreads = function () {
    var cfg = this.config;
    var pages = cfg.pages || [];
    var list = [];

    list.push({
      type: "cover",
      title: cfg.title,
      subtitle: cfg.subtitle,
      coverImage: cfg.coverImage
    });

    for (var i = 0; i < pages.length; i++) {
      var p = pages[i];
      list.push({
        type: "content",
        pageId: p.id != null ? String(p.id) : String(i + 1),
        image: p.image,
        heading: p.title != null ? p.title : p.heading,
        message: p.content != null ? p.content : p.message,
        pageNum: i + 1,
        totalPages: pages.length
      });
    }

    list.push({
      type: "back",
      backCoverImage: cfg.backCoverImage
    });

    this.spreads = list;
    this.total = list.length;
  };

  Book.prototype.render = function () {
    var self = this;
    var html = "";
    var total = this.total;

    this.spreads.forEach(function (spread, index) {
      var spreadClass = "spread";
      if (spread.type === "cover") spreadClass += " spread--cover";
      if (spread.type === "back") spreadClass += " spread--back";

      var zIndex = index === self.currentIndex ? total + 1 : total - 1 - index;
      var inner = self.renderSpreadInner(spread, index);
      html +=
        '<div class="' + spreadClass + '" data-index="' + index + '" style="z-index: ' + zIndex + '">' +
          '<div class="spread-inner">' + inner + "</div>" +
          '<div class="spread-back" aria-hidden="true"></div>' +
        "</div>";
    });

    this.container.innerHTML = html;
  };

  Book.prototype.renderSpreadInner = function (spread, index) {
    if (spread.type === "cover") {
      var style = "";
      if (spread.coverImage) {
        style = ' style="background-image: url(\'' + escapeAttr(spread.coverImage) + '\'); background-size: cover; background-position: center; background-repeat: no-repeat;"';
      }
      return '<div class="cover-content cover-content--image"' + style + '></div>';
    }

    if (spread.type === "back") {
      var backStyle = "";
      if (spread.backCoverImage) {
        backStyle =
          ' style="background-image: url(\'' +
          escapeAttr(spread.backCoverImage) +
          '\'); background-size: cover; background-position: center 42%; background-repeat: no-repeat;"';
      }
      return '<div class="cover-content cover-content--image"' + backStyle + '></div>';
    }

    return (
      '<section class="page-left" data-page-id="' + escapeAttr(spread.pageId) + '">' +
        '<div class="editable-element editable-image-box" data-editable="true" data-page-id="' + escapeAttr(spread.pageId) + '" data-element-id="' + escapeAttr(spread.pageId) + '-img">' +
          '<img class="page-image" src="' + escapeAttr(spread.image) + '" alt="Recuerdo ' + spread.pageNum + '" loading="lazy">' +
        '</div>' +
      "</section>" +
      '<section class="page-right" data-page-id="' + escapeAttr(spread.pageId) + '">' +
        '<h3 class="editable-element" data-editable="true" data-page-id="' + escapeAttr(spread.pageId) + '" data-element-id="' + escapeAttr(spread.pageId) + '-title">' + escapeHtml(spread.heading) + "</h3>" +
        '<p class="page-message editable-element" data-editable="true" data-page-id="' + escapeAttr(spread.pageId) + '" data-element-id="' + escapeAttr(spread.pageId) + '-message">' + escapeHtml(spread.message) + "</p>" +
        '<span class="page-num">' + spread.pageNum + " / " + spread.totalPages + "</span>" +
      "</section>"
    );
  };

  /**
   * Ajusta variables CSS para realismo dinámico:
   * - grosor del lomo según total de páginas
   * - acumulación visual izquierda/derecha según índice actual
   * - sombras progresivas en el lado con más páginas
   */
  Book.prototype.updateDepthFx = function () {
    if (!this.container) return;

    var contentTotal = Math.max(1, this.total - 2); // excluye portada y contraportada
    var contentIndex = Math.max(0, Math.min(contentTotal - 1, this.currentIndex - 1));
    var ratio = contentTotal <= 1 ? 0.5 : contentIndex / (contentTotal - 1); // 0=principio, 1=final

    var leftWeight = ratio;
    var rightWeight = 1 - ratio;
    var leftPages = Math.round(leftWeight * contentTotal);
    var rightPages = Math.max(0, contentTotal - leftPages);

    var spineVisualScale = 1 + Math.min(contentTotal, 100) * 0.0015 + Math.abs(leftWeight - rightWeight) * 0.03;
    var leftStack = 4 + leftPages * 0.16;
    var rightStack = 4 + rightPages * 0.16;

    var leftDark = 0.08 + leftWeight * 0.18;
    var rightDark = 0.08 + rightWeight * 0.18;

    this.container.style.setProperty("--spine-visual-scale", spineVisualScale.toFixed(3));
    this.container.style.setProperty("--stack-left-size", leftStack.toFixed(2) + "px");
    this.container.style.setProperty("--stack-right-size", rightStack.toFixed(2) + "px");
    this.container.style.setProperty("--page-shadow-left-color", "rgba(0, 0, 0, " + leftDark.toFixed(3) + ")");
    this.container.style.setProperty("--page-shadow-right-color", "rgba(0, 0, 0, " + rightDark.toFixed(3) + ")");
  };

  Book.prototype.updateUI = function () {
    var cur = this.currentIndex;
    var total = this.total;
    var spread = this.spreads[cur];

    if (this.statusEl) {
      if (cur === 0) this.statusEl.textContent = "Portada";
      else if (cur === total - 1) this.statusEl.textContent = "Contraportada — Fin del libro";
      else this.statusEl.textContent = "Página " + cur + " de " + (total - 2);
    }

    if (this.progressEl) {
      var pct = total <= 1 ? 0 : (cur / (total - 1)) * 100;
      this.progressEl.style.setProperty("--progress-pct", pct);
      this.progressEl.setAttribute("aria-valuenow", cur + 1);
      this.progressEl.setAttribute("aria-valuemax", total);
    }

    if (this.btnPrev) this.btnPrev.disabled = cur <= 0;
    if (this.btnNext) this.btnNext.disabled = cur >= total - 1;
    if (this.btnHome) this.btnHome.disabled = cur === 0;

    this.updateDepthFx();

    var nodes = this.container ? this.container.querySelectorAll(".spread") : [];
    for (var i = 0; i < nodes.length; i++) {
      var z = i === cur ? total + 1 : total - 1 - i;
      nodes[i].style.zIndex = z;
      nodes[i].classList.toggle("is-current", i === cur);
    }
  };

  Book.prototype.goNext = function () {
    if (this.animating || this.currentIndex >= this.total - 1) return;
    var nodes = this.container.querySelectorAll(".spread");
    var cur = this.currentIndex;

    this.currentIndex = cur + 1;
    this.animating = true;
    nodes[cur].classList.add("flipped");
    this.updateUI();

    var self = this;
    setTimeout(function () {
      self.animating = false;
    }, 580);
  };

  Book.prototype.goPrev = function () {
    if (this.animating || this.currentIndex <= 0) return;
    this.currentIndex--;
    this.container.querySelectorAll(".spread")[this.currentIndex].classList.remove("flipped");
    this.updateUI();
  };

  Book.prototype.goHome = function () {
    if (this.animating || this.currentIndex === 0) return;
    var nodes = this.container.querySelectorAll(".spread");
    for (var i = 0; i < this.currentIndex; i++) nodes[i].classList.remove("flipped");
    this.currentIndex = 0;
    this.updateUI();
  };

  /**
   * Actualiza la configuración del libro y re-renderiza (para editor).
   * @param {Object} config - { title, subtitle, coverImage, backCoverImage, pages }
   */
  Book.prototype.setConfig = function (config) {
    if (!config || !this.container) return;
    this.config = config;
    this.buildSpreads();
    this.currentIndex = Math.min(this.currentIndex, Math.max(0, this.total - 1));
    this.render();
    this.updateUI();
  };

  Book.prototype.goToPage = function (index) {
    if (this.animating) return;
    index = Math.max(0, Math.min(index, this.total - 1));
    if (index === this.currentIndex) return;
    var nodes = this.container.querySelectorAll(".spread");
    var total = this.total;
    if (index > this.currentIndex) {
      for (var i = this.currentIndex; i < index; i++) nodes[i].classList.add("flipped");
    } else {
      for (var j = index; j < this.currentIndex; j++) nodes[j].classList.remove("flipped");
    }
    this.currentIndex = index;
    for (var k = 0; k < nodes.length; k++) {
      nodes[k].style.zIndex = k === this.currentIndex ? total + 1 : total - 1 - k;
    }
    this.updateUI();
  };

  Book.prototype.bindEvents = function () {
    var self = this;
    if (this.btnPrev) this.btnPrev.addEventListener("click", function () { self.goPrev(); });
    if (this.btnNext) this.btnNext.addEventListener("click", function () { self.goNext(); });
    if (this.btnHome) this.btnHome.addEventListener("click", function () { self.goHome(); });

    if (this.progressEl) {
      this.progressEl.addEventListener("click", function (e) {
        var bar = e.currentTarget;
        var rect = bar.getBoundingClientRect();
        var x = e.clientX - rect.left;
        var w = rect.width;
        if (w <= 0) return;
        var pct = Math.max(0, Math.min(1, x / w));
        var total = self.total;
        var index = total <= 1 ? 0 : Math.round(pct * (total - 1));
        self.goToPage(index);
      });
    }

    document.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") self.goPrev();
      if (e.key === "ArrowRight") self.goNext();
      if (e.key === "Home" || (e.key.toLowerCase() === "h" && !e.ctrlKey && !e.metaKey)) {
        e.preventDefault();
        self.goHome();
      }
    });
  };
})();
