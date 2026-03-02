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

    if (window.BookStore && typeof window.BookStore.bootstrap === "function") {
      window.BookStore.bootstrap({
        config: config,
        musicStorageKey: "album-music-config"
      });
    }

    var book = new window.Book(config);
    book.init();
    window.bookInstance = book;

    if (window.BookInteractions && typeof window.BookInteractions.destroy === "function") {
      window.BookInteractions.destroy();
    }
    if (window.BookInteractions && typeof window.BookInteractions.init === "function") {
      window.BookInteractions.init(book.container);
    }

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
