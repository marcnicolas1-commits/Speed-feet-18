/* ==========================================================
   SPEEDFEET ANALYZER
   app.js — Partie 1A
   Initialisation et état global
   ========================================================== */

"use strict";

/* ==========================================================
   APPLICATION
   ========================================================== */

const APP_NAME = "SpeedFeet Analyzer";
const APP_VERSION = "2.3.0";
const STORAGE_KEY = "speedfeet-data";

/* ==========================================================
   ÉTAT GLOBAL
   ========================================================== */

const appState = {

    currentPage: "home",

    navigationRunning: false,

    watchId: null,

    startTime: null,

    currentTrack: [],

    currentMarkers: [],

    weather: {},

    preparation: {},

    settings: {},

    history: []

};

/* ==========================================================
   DOM
   ========================================================== */

const dom = {};

/* ==========================================================
   INITIALISATION
   ========================================================== */

document.addEventListener("DOMContentLoaded", initApplication);

/* ==========================================================
   INITIALISATION PRINCIPALE
   ========================================================== */

function initApplication() {

    console.log(APP_NAME + " " + APP_VERSION);

    cacheDom();

    loadStorage();

    initNavigation();

    showPage("home");

}

/* ==========================================================
   CACHE DOM
   ========================================================== */

function cacheDom() {

    dom.pages = document.querySelectorAll(".page");

    dom.homePage = document.getElementById("homePage");
    dom.preparePage = document.getElementById("preparePage");
    dom.navigationPage = document.getElementById("navigationPage");
    dom.historyPage = document.getElementById("historyPage");
    dom.settingsPage = document.getElementById("settingsPage");

    dom.windModal = document.getElementById("windModal");
    dom.trimModal = document.getElementById("trimModal");
    dom.confirmModal = document.getElementById("confirmModal");

}

/* ==========================================================
   NAVIGATION ENTRE LES PAGES
   ========================================================== */

function initNavigation() {

    registerPageButton(
        "prepareButton",
        "prepare"
    );

    registerPageButton(
        "startNavigationButton",
        "navigation"
    );

    registerPageButton(
        "historyButton",
        "history"
    );

    registerPageButton(
        "settingsButton",
        "settings"
    );

    document
        .querySelectorAll("[data-page]")
        .forEach(button => {

            button.addEventListener("click", () => {

                showPage(
                    button.dataset.page
                );

            });

        });

}

/* ==========================================================
   ENREGISTREMENT D'UN BOUTON
   ========================================================== */

function registerPageButton(id, page) {

    const button = document.getElementById(id);

    if (!button) return;

    button.addEventListener("click", () => {

        showPage(page);

    });

}

/* ==========================================================
   AFFICHER UNE PAGE
   ========================================================== */

function showPage(pageName) {

    appState.currentPage = pageName;

    dom.pages.forEach(page => {

        page.classList.remove("active");

    });

    const page = document.getElementById(
        pageName + "Page"
    );

    if (page) {

        page.classList.add("active");

    }

    window.scrollTo({
        top: 0,
        behavior: "instant"
    });

}

/* ==========================================================
   FIN PARTIE 1A
   ========================================================== */
