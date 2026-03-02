/**
 * Punto de entrada: inicializa el libro con la configuración global.
 */
(function () {
  "use strict";

  function init() {
    if (window.AlbumEditor && typeof window.AlbumEditor.loadData === "function") {
      window.AlbumEditor.loadData();
    }

    var config = window.BOOK_CONFIG;
    if (!config) {
      var status = document.getElementById("statusText");
      if (status) status.textContent = "Falta la configuración del libro (BOOK_CONFIG).";
      return;
    }

    var book = new window.Book(config);
    book.init();
    window.bookInstance = book;

    if (window.AlbumEditor && typeof window.AlbumEditor.init === "function") {
      window.AlbumEditor.init(book);
    }
    if (window.AlbumEditor && typeof window.AlbumEditor.initMusic === "function") {
      window.AlbumEditor.initMusic();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
