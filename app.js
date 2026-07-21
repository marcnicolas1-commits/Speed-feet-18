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
/* ==========================================================
   SPEEDFEET ANALYZER
   app.js — Partie 1B
   Données par défaut, stockage local et affichage initial
   ========================================================== */


/* ==========================================================
   VALEURS PAR DÉFAUT
   ========================================================== */

const DEFAULT_SETTINGS = {

    boat: {

        name: "SpeedFeet 18",

        sailNumber: "",

        length: 5.50,

        weight: 550

    },

    sails: {

        mainsail: "GV Régate",

        jib: "Foc Régate",

        spinnaker: "Spi 32 m²"

    },

    crew: {

        number: 1

    },

    units: {

        speed: "knots",

        distance: "nauticalMiles",

        wind: "knots",

        temperature: "celsius"

    },

    navigation: {

        gpsPrecision: "high",

        recordInterval: 2,

        minimumAccuracy: 35,

        keepScreenAwake: true

    },

    analysis: {

        vccEnabled: true,

        polarEnabled: true,

        learningEnabled: true

    },

    interface: {

        theme: "dark",

        largeControls: true

    }

};


const DEFAULT_PREPARATION = {

    createdAt: null,

    updatedAt: null,

    weatherImage: null,

    averageWind: null,

    gustWind: null,

    windDirection: null,

    seaState: "",

    notes: "",

    configuration: {

        mainsail:
            DEFAULT_SETTINGS.sails.mainsail,

        jib:
            DEFAULT_SETTINGS.sails.jib,

        spinnaker:
            DEFAULT_SETTINGS.sails.spinnaker,

        crew:
            DEFAULT_SETTINGS.crew.number

    }

};


/* ==========================================================
   INITIALISATION DES DONNÉES LOCALES
   ========================================================== */

document.addEventListener(
    "DOMContentLoaded",
    initializePersistentData
);


function initializePersistentData() {

    appState.settings =
        loadStoredObject(
            STORAGE_KEYS.settings,
            DEFAULT_SETTINGS
        );

    appState.preparation =
        loadStoredObject(
            STORAGE_KEYS.preparation,
            DEFAULT_PREPARATION
        );

    appState.history =
        loadStoredArray(
            STORAGE_KEYS.history
        );


    normalizeApplicationData();

    renderRecentNavigations();

    renderHistory();

    restoreActiveNavigationState();


    console.log(
        "Données locales chargées",
        {
            settings:
                appState.settings,

            preparation:
                appState.preparation,

            historyCount:
                appState.history.length
        }
    );

}


/* ==========================================================
   CHARGEMENT D’UN OBJET DEPUIS LE STOCKAGE
   ========================================================== */

function loadStoredObject(
    key,
    defaultValue
) {

    try {

        const storedValue =
            localStorage.getItem(key);

        if (!storedValue) {

            return deepClone(defaultValue);

        }

        const parsedValue =
            JSON.parse(storedValue);

        if (
            !parsedValue ||
            typeof parsedValue !== "object" ||
            Array.isArray(parsedValue)
        ) {

            return deepClone(defaultValue);

        }

        return mergeDeep(
            deepClone(defaultValue),
            parsedValue
        );

    } catch (error) {

        console.error(
            `Impossible de lire ${key}`,
            error
        );

        return deepClone(defaultValue);

    }

}


/* ==========================================================
   CHARGEMENT D’UN TABLEAU DEPUIS LE STOCKAGE
   ========================================================== */

function loadStoredArray(key) {

    try {

        const storedValue =
            localStorage.getItem(key);

        if (!storedValue) {

            return [];

        }

        const parsedValue =
            JSON.parse(storedValue);

        return Array.isArray(parsedValue)
            ? parsedValue
            : [];

    } catch (error) {

        console.error(
            `Impossible de lire ${key}`,
            error
        );

        return [];

    }

}


/* ==========================================================
   SAUVEGARDE GÉNÉRIQUE
   ========================================================== */

function saveStoredValue(
    key,
    value
) {

    try {

        localStorage.setItem(
            key,
            JSON.stringify(value)
        );

        return true;

    } catch (error) {

        console.error(
            `Impossible d’enregistrer ${key}`,
            error
        );

        return false;

    }

}


/* ==========================================================
   SAUVEGARDES SPÉCIFIQUES
   ========================================================== */

function saveSettings() {

    return saveStoredValue(
        STORAGE_KEYS.settings,
        appState.settings
    );

}


function savePreparation() {

    if (!appState.preparation) {

        return false;

    }

    appState.preparation.updatedAt =
        new Date().toISOString();

    return saveStoredValue(
        STORAGE_KEYS.preparation,
        appState.preparation
    );

}


function saveHistory() {

    return saveStoredValue(
        STORAGE_KEYS.history,
        appState.history
    );

}


function saveActiveNavigation() {

    const activeNavigation = {

        navigationRunning:
            appState.navigationRunning,

        startTime:
            appState.startTime,

        currentTrack:
            appState.currentTrack,

        currentMarkers:
            appState.currentMarkers,

        currentWindRecords:
            appState.currentWindRecords,

        currentTrimRecords:
            appState.currentTrimRecords

    };

    return saveStoredValue(
        STORAGE_KEYS.activeNavigation,
        activeNavigation
    );

}


/* ==========================================================
   NORMALISATION DES DONNÉES
   ========================================================== */

function normalizeApplicationData() {

    if (!appState.settings) {

        appState.settings =
            deepClone(DEFAULT_SETTINGS);

    }

    if (!appState.preparation) {

        appState.preparation =
            deepClone(DEFAULT_PREPARATION);

    }

    if (!Array.isArray(appState.history)) {

        appState.history = [];

    }


    if (
        !appState.preparation.configuration
    ) {

        appState.preparation.configuration = {

            mainsail:
                appState.settings.sails.mainsail,

            jib:
                appState.settings.sails.jib,

            spinnaker:
                appState.settings.sails.spinnaker,

            crew:
                appState.settings.crew.number

        };

    }

}


/* ==========================================================
   RESTAURATION D’UNE NAVIGATION ACTIVE
   ========================================================== */

function restoreActiveNavigationState() {

    const activeNavigation =
        loadStoredObject(
            STORAGE_KEYS.activeNavigation,
            {}
        );

    if (
        !activeNavigation ||
        !activeNavigation.navigationRunning
    ) {

        return;

    }

    appState.navigationRunning = true;

    appState.startTime =
        activeNavigation.startTime || null;

    appState.currentTrack =
        Array.isArray(
            activeNavigation.currentTrack
        )
            ? activeNavigation.currentTrack
            : [];

    appState.currentMarkers =
        Array.isArray(
            activeNavigation.currentMarkers
        )
            ? activeNavigation.currentMarkers
            : [];

    appState.currentWindRecords =
        Array.isArray(
            activeNavigation.currentWindRecords
        )
            ? activeNavigation.currentWindRecords
            : [];

    appState.currentTrimRecords =
        Array.isArray(
            activeNavigation.currentTrimRecords
        )
            ? activeNavigation.currentTrimRecords
            : [];

}


/* ==========================================================
   AFFICHAGE DES DERNIÈRES NAVIGATIONS
   ========================================================== */

function renderRecentNavigations() {

    const container =
        document.getElementById(
            "recentNavigationList"
        );

    if (!container) {

        return;

    }

    container.innerHTML = "";


    if (appState.history.length === 0) {

        container.innerHTML = `
            <div class="emptyCard">
                Aucune navigation enregistrée.
            </div>
        `;

        return;

    }


    const recentNavigations =
        [...appState.history]
            .sort(sortNavigationsNewestFirst)
            .slice(0, 3);


    recentNavigations.forEach(
        navigation => {

            container.appendChild(
                createNavigationCard(
                    navigation,
                    true
                )
            );

        }
    );

}


/* ==========================================================
   AFFICHAGE DE L’HISTORIQUE
   ========================================================== */

function renderHistory() {

    const container =
        document.getElementById(
            "historyList"
        );

    if (!container) {

        return;

    }

    container.innerHTML = "";


    if (appState.history.length === 0) {

        container.innerHTML = `
            <div class="emptyCard">
                Aucune sortie enregistrée pour le moment.
            </div>
        `;

        return;

    }


    const sortedHistory =
        [...appState.history]
            .sort(sortNavigationsNewestFirst);


    sortedHistory.forEach(
        navigation => {

            container.appendChild(
                createNavigationCard(
                    navigation,
                    false
                )
            );

        }
    );

}


/* ==========================================================
   CRÉATION D’UNE CARTE DE NAVIGATION
   ========================================================== */

function createNavigationCard(
    navigation,
    compactMode = false
) {

    const article =
        document.createElement("article");

    article.className =
        "navigationItem";


    const title =
        navigation.title ||
        "Navigation SpeedFeet 18";

    const date =
        formatDateTime(
            navigation.startedAt ||
            navigation.date
        );

    const duration =
        formatDuration(
            navigation.durationSeconds || 0
        );

    const distance =
        formatDistance(
            navigation.distanceNm || 0
        );

    const maximumSpeed =
        formatSpeed(
            navigation.maximumSpeed || 0
        );


    article.innerHTML = `
        <div class="navigationItemHeader">

            <h3 class="navigationItemTitle">
                ${escapeHtml(title)}
            </h3>

            <span class="navigationItemDate">
                ${escapeHtml(date)}
            </span>

        </div>

        <div class="navigationItemData">

            <span>
                Durée : ${escapeHtml(duration)}
            </span>

            <span>
                Distance : ${escapeHtml(distance)}
            </span>

            <span>
                Vitesse max :
                ${escapeHtml(maximumSpeed)}
            </span>

            <span>
                Équipage :
                ${escapeHtml(
                    String(
                        navigation.crew || 1
                    )
                )}
            </span>

        </div>
    `;


    if (!compactMode) {

        const actions =
            document.createElement("div");

        actions.className =
            "navigationItemActions";


        const openButton =
            document.createElement("button");

        openButton.type = "button";

        openButton.className =
            "secondaryButton";

        openButton.textContent =
            "Ouvrir";

        openButton.addEventListener(
            "click",
            () => {

                openNavigationFromHistory(
                    navigation.id
                );

            }
        );


        actions.appendChild(
            openButton
        );

        article.appendChild(
            actions
        );

    }

    return article;

}


/* ==========================================================
   OUVERTURE PROVISOIRE D’UNE SORTIE
   L’analyse complète arrivera dans la Partie 6.
   ========================================================== */

function openNavigationFromHistory(
    navigationId
) {

    const navigation =
        appState.history.find(
            item =>
                item.id === navigationId
        );

    if (!navigation) {

        console.warn(
            "Navigation introuvable",
            navigationId
        );

        return;

    }

    appState.selectedNavigation =
        navigation;

    console.log(
        "Navigation sélectionnée",
        navigation
    );

}


/* ==========================================================
   TRI DES NAVIGATIONS
   ========================================================== */

function sortNavigationsNewestFirst(
    firstNavigation,
    secondNavigation
) {

    const firstDate =
        new Date(
            firstNavigation.startedAt ||
            firstNavigation.date ||
            0
        ).getTime();

    const secondDate =
        new Date(
            secondNavigation.startedAt ||
            secondNavigation.date ||
            0
        ).getTime();

    return secondDate - firstDate;

}


/* ==========================================================
   OUTILS DE FORMATAGE
   ========================================================== */

function formatDateTime(value) {

    if (!value) {

        return "Date inconnue";

    }

    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return "Date inconnue";

    }

    return new Intl.DateTimeFormat(
        "fr-FR",
        {
            dateStyle: "medium",
            timeStyle: "short"
        }
    ).format(date);

}


function formatDuration(
    totalSeconds
) {

    const safeSeconds =
        Math.max(
            0,
            Math.floor(
                Number(totalSeconds) || 0
            )
        );

    const hours =
        Math.floor(
            safeSeconds / 3600
        );

    const minutes =
        Math.floor(
            (safeSeconds % 3600) / 60
        );

    const seconds =
        safeSeconds % 60;


    return [
        hours,
        minutes,
        seconds
    ]
        .map(value =>
            String(value).padStart(2, "0")
        )
        .join(":");

}


function formatDistance(value) {

    const distance =
        Number(value) || 0;

    return `${distance.toFixed(2)} nm`;

}


function formatSpeed(value) {

    const speed =
        Number(value) || 0;

    return `${speed.toFixed(1)} nds`;

}


/* ==========================================================
   OUTILS POUR LES OBJETS
   ========================================================== */

function deepClone(value) {

    if (
        typeof structuredClone ===
        "function"
    ) {

        try {

            return structuredClone(value);

        } catch (error) {

            console.warn(
                "structuredClone indisponible",
                error
            );

        }

    }

    return JSON.parse(
        JSON.stringify(value)
    );

}


function mergeDeep(
    target,
    source
) {

    if (
        !source ||
        typeof source !== "object"
    ) {

        return target;

    }

    Object.keys(source)
        .forEach(key => {

            const sourceValue =
                source[key];

            const targetValue =
                target[key];


            if (
                sourceValue &&
                typeof sourceValue ===
                    "object" &&
                !Array.isArray(sourceValue)
            ) {

                target[key] =
                    mergeDeep(
                        targetValue &&
                        typeof targetValue ===
                            "object"
                            ? targetValue
                            : {},
                        sourceValue
                    );

            } else {

                target[key] =
                    sourceValue;

            }

        });

    return target;

}


/* ==========================================================
   PROTECTION DU HTML
   ========================================================== */

function escapeHtml(value) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


/* ==========================================================
   GÉNÉRATION D’UN IDENTIFIANT
   ========================================================== */

function generateId(prefix = "item") {

    if (
        window.crypto &&
        typeof window.crypto.randomUUID ===
            "function"
    ) {

        return `${prefix}-${crypto.randomUUID()}`;

    }

    return (
        `${prefix}-` +
        Date.now() +
        "-" +
        Math.random()
            .toString(16)
            .slice(2)
    );

}


/* ==========================================================
   FIN DE LA PARTIE 1B
   ========================================================== */
