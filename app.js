/* ==========================================================
   SPEEDFEET ANALYZER
   app.js — Partie 1A
   Base de l’application et navigation entre les pages
   ========================================================== */

"use strict";


/* ==========================================================
   INFORMATIONS DE L’APPLICATION
   ========================================================== */

const APP_NAME = "SpeedFeet Analyzer";
const APP_VERSION = "2.3.0";

const STORAGE_KEYS = {
    settings: "speedfeet-settings",
    preparation: "speedfeet-preparation",
    history: "speedfeet-history",
    activeNavigation: "speedfeet-active-navigation"
};


/* ==========================================================
   ÉTAT GLOBAL DE L’APPLICATION
   ========================================================== */

const appState = {

    currentPage: "home",

    navigationRunning: false,

    watchId: null,

    timerId: null,

    startTime: null,

    currentPosition: null,

    currentTrack: [],

    currentMarkers: [],

    currentWindRecords: [],

    currentTrimRecords: [],

    preparation: null,

    settings: null,

    history: []

};


/* ==========================================================
   RÉFÉRENCES DU DOM
   ========================================================== */

const dom = {

    pages: [],

    homePage: null,
    preparePage: null,
    navigationPage: null,
    historyPage: null,
    settingsPage: null,

    windModal: null,
    trimModal: null,
    confirmModal: null,

    btnPrepare: null,
    btnStartNavigation: null,
    btnHistory: null,
    btnSettings: null

};


/* ==========================================================
   DÉMARRAGE DE L’APPLICATION
   ========================================================== */

document.addEventListener(
    "DOMContentLoaded",
    initApplication
);


/* ==========================================================
   INITIALISATION PRINCIPALE
   ========================================================== */

function initApplication() {

    console.log(
        `${APP_NAME} — version ${APP_VERSION}`
    );

    cacheDomElements();

    initializePageNavigation();

    showPage("home");

}


/* ==========================================================
   RÉCUPÉRATION DES ÉLÉMENTS HTML
   ========================================================== */

function cacheDomElements() {

    dom.pages = Array.from(
        document.querySelectorAll(".page")
    );

    dom.homePage =
        document.getElementById("homePage");

    dom.preparePage =
        document.getElementById("preparePage");

    dom.navigationPage =
        document.getElementById("navigationPage");

    dom.historyPage =
        document.getElementById("historyPage");

    dom.settingsPage =
        document.getElementById("settingsPage");


    dom.windModal =
        document.getElementById("windModal");

    dom.trimModal =
        document.getElementById("trimModal");

    dom.confirmModal =
        document.getElementById("confirmModal");


    dom.btnPrepare =
        document.getElementById("btnPrepare");

    dom.btnStartNavigation =
        document.getElementById(
            "btnStartNavigation"
        );

    dom.btnHistory =
        document.getElementById("btnHistory");

    dom.btnSettings =
        document.getElementById("btnSettings");

}


/* ==========================================================
   INITIALISATION DE LA NAVIGATION
   ========================================================== */

function initializePageNavigation() {

    registerPageButton(
        dom.btnPrepare,
        "prepare"
    );

    registerPageButton(
        dom.btnStartNavigation,
        "navigation"
    );

    registerPageButton(
        dom.btnHistory,
        "history"
    );

    registerPageButton(
        dom.btnSettings,
        "settings"
    );


    document
        .querySelectorAll("[data-page]")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const pageName =
                        button.dataset.page;

                    showPage(pageName);

                }
            );

        });

}


/* ==========================================================
   ASSOCIATION D’UN BOUTON À UNE PAGE
   ========================================================== */

function registerPageButton(
    button,
    pageName
) {

    if (!button) {

        console.warn(
            `Bouton introuvable pour la page : ${pageName}`
        );

        return;

    }

    button.addEventListener(
        "click",
        () => {

            showPage(pageName);

        }
    );

}


/* ==========================================================
   AFFICHAGE D’UNE PAGE
   ========================================================== */

function showPage(pageName) {

    const targetPage =
        document.getElementById(
            `${pageName}Page`
        );

    if (!targetPage) {

        console.warn(
            `Page introuvable : ${pageName}`
        );

        return;

    }


    closeAllModals();


    dom.pages.forEach(page => {

        page.classList.remove("active");

        page.setAttribute(
            "aria-hidden",
            "true"
        );

    });


    targetPage.classList.add("active");

    targetPage.setAttribute(
        "aria-hidden",
        "false"
    );


    appState.currentPage = pageName;


    window.scrollTo({
        top: 0,
        left: 0,
        behavior: "auto"
    });


    document.body.dataset.currentPage =
        pageName;


    window.dispatchEvent(
        new CustomEvent(
            "speedfeet:pagechange",
            {
                detail: {
                    page: pageName
                }
            }
        )
    );

}


/* ==========================================================
   FERMETURE PROVISOIRE DES MODALES
   La gestion complète arrivera dans la prochaine partie.
   ========================================================== */

function closeAllModals() {

    const modals = [
        dom.windModal,
        dom.trimModal,
        dom.confirmModal
    ];

    modals.forEach(modal => {

        if (!modal) {
            return;
        }

        modal.classList.remove(
            "open",
            "active",
            "is-open"
        );

        modal.setAttribute(
            "aria-hidden",
            "true"
        );

    });

    document.body.classList.remove(
        "modal-open"
    );

}


/* ==========================================================
   GESTION DU BOUTON RETOUR DU NAVIGATEUR
   ========================================================== */

window.addEventListener(
    "popstate",
    event => {

        const requestedPage =
            event.state?.page || "home";

        showPage(requestedPage);

    }
);


/* ==========================================================
   INFORMATIONS DE DIAGNOSTIC
   ========================================================== */

function getApplicationStatus() {

    return {

        name: APP_NAME,

        version: APP_VERSION,

        currentPage:
            appState.currentPage,

        numberOfPages:
            dom.pages.length,

        navigationRunning:
            appState.navigationRunning

    };

}


/* ==========================================================
   FIN DE LA PARTIE 1A
   ========================================================== */
