(() => {
    "use strict";

    const APP_VERSION = "2.5.0";

    const STORAGE_KEYS = {
        settings: "speedfeet_settings",
        preparation: "speedfeet_preparation",
        currentNavigation: "speedfeet_current_navigation",
        history: "speedfeet_history"
    };

    const DEFAULT_SETTINGS = {
        boatName: "Speed Feet 18",
        defaultMainSail: "GV Régate",
        defaultJib: "Foc Régate",
        defaultSpi: "Spi 32",
        defaultCrew: 1
    };

    const SELECT_OPTIONS = {
        mainSails: [
            "GV Régate",
            "GV Entraînement"
        ],

        jibs: [
            "Foc Régate",
            "Foc Entraînement"
        ],

        spinnakers: [
            "Spi 32",
            "Spi 42",
            "Sans spi"
        ],

        travelerMain: ["1", "2", "3", "4", "5"],

        travelerJib: ["1", "2", "3", "4", "5"],

        mastRotation: ["1", "2", "3", "4", "5"],

        cunningham: ["1", "2", "3", "4", "5"],

        outhaul: [
            "Creuse",
            "Moyenne",
            "Plate",
            "Très plate"
        ],

        mainsheet: [
            "Choquée",
            "Légèrement choquée",
            "Moyenne",
            "Bordée",
            "Très bordée"
        ]
    };

    const state = {
        settings: loadJSON(
            STORAGE_KEYS.settings,
            DEFAULT_SETTINGS
        ),

        preparation: loadJSON(
            STORAGE_KEYS.preparation,
            null
        ),

        currentNavigation: loadJSON(
            STORAGE_KEYS.currentNavigation,
            null
        ),

        history: loadJSON(
            STORAGE_KEYS.history,
            []
        ),

        currentPage: "homePage",
        timerId: null,
        gpsWatchId: null,
        confirmAction: null,
        historyMap: null
    };

    function getElement(id) {
        return document.getElementById(id);
    }

    function loadJSON(key, fallbackValue) {
        try {
            const savedValue = localStorage.getItem(key);

            if (!savedValue) {
                return cloneValue(fallbackValue);
            }

            return JSON.parse(savedValue);
        } catch (error) {
            console.error(
                "Erreur de lecture :",
                key,
                error
            );

            return cloneValue(fallbackValue);
        }
    }

    function saveJSON(key, value) {
        try {
            localStorage.setItem(
                key,
                JSON.stringify(value)
            );

            return true;
        } catch (error) {
            console.error(
                "Erreur d'enregistrement :",
                key,
                error
            );

            alert(
                "L'application n'a pas réussi à enregistrer les données."
            );

            return false;
        }
    }

    function cloneValue(value) {
        if (
            value === null ||
            value === undefined
        ) {
            return value;
        }

        return JSON.parse(
            JSON.stringify(value)
        );
    }

    function toNumberOrNull(value) {
        if (
            value === "" ||
            value === null ||
            value === undefined
        ) {
            return null;
        }

        const number = Number(value);

        if (!Number.isFinite(number)) {
            return null;
        }

        return number;
    }

    function clamp(value, minimum, maximum) {
        return Math.min(
            maximum,
            Math.max(minimum, value)
        );
    }

    function bindClick(id, callback) {
        const element = getElement(id);

        if (!element) {
            console.warn(
                "Bouton introuvable :",
                id
            );

            return;
        }

        element.addEventListener(
            "click",
            callback
        );
    }

    function fillSelect(
        element,
        values,
        selectedValue
    ) {
        if (!element) {
            return;
        }

        element.innerHTML = "";

        values.forEach((value) => {
            const option =
                document.createElement("option");

            option.value = value;
            option.textContent = value;

            if (value === selectedValue) {
                option.selected = true;
            }

            element.appendChild(option);
        });
    }

    function initializeSelects() {
        fillSelect(
            getElement("defaultMainSail"),
            SELECT_OPTIONS.mainSails,
            state.settings.defaultMainSail
        );

        fillSelect(
            getElement("defaultJib"),
            SELECT_OPTIONS.jibs,
            state.settings.defaultJib
        );

        fillSelect(
            getElement("defaultSpi"),
            SELECT_OPTIONS.spinnakers,
            state.settings.defaultSpi
        );

        fillSelect(
            getElement("mainSail"),
            SELECT_OPTIONS.mainSails,
            state.settings.defaultMainSail
        );

        fillSelect(
            getElement("jib"),
            SELECT_OPTIONS.jibs,
            state.settings.defaultJib
        );

        fillSelect(
            getElement("spinnaker"),
            SELECT_OPTIONS.spinnakers,
            state.settings.defaultSpi
        );

        fillSelect(
            getElement("trimTravelerMain"),
            SELECT_OPTIONS.travelerMain,
            "3"
        );

        fillSelect(
            getElement("trimTravelerJib"),
            SELECT_OPTIONS.travelerJib,
            "3"
        );

        fillSelect(
            getElement("trimRotation"),
            SELECT_OPTIONS.mastRotation,
            "3"
        );

        fillSelect(
            getElement("trimCunningham"),
            SELECT_OPTIONS.cunningham,
            "3"
        );

        fillSelect(
            getElement("trimOuthaul"),
            SELECT_OPTIONS.outhaul,
            "Moyenne"
        );

        fillSelect(
            getElement("trimSheet"),
            SELECT_OPTIONS.mainsheet,
            "Moyenne"
        );
    }

    function showPage(pageId) {
        document
            .querySelectorAll(".page")
            .forEach((page) => {
                page.classList.remove("active");
                page.setAttribute(
                    "aria-hidden",
                    "true"
                );
            });

        const selectedPage =
            getElement(pageId);

        if (!selectedPage) {
            console.error(
                "Page introuvable :",
                pageId
            );

            return;
        }

        selectedPage.classList.add("active");

        selectedPage.setAttribute(
            "aria-hidden",
            "false"
        );

        state.currentPage = pageId;

        closeAllModals();

        window.scrollTo({
            top: 0,
            behavior: "auto"
        });

        if (pageId === "homePage") {
            renderRecentNavigations();
        }

        if (pageId === "preparePage") {
            loadPreparationForm();
        }

        if (pageId === "historyPage") {
            renderHistory();
        }

        if (pageId === "settingsPage") {
            loadSettingsForm();
        }

        if (pageId === "navigationPage") {
            updateNavigationDashboard();
        }
    }

    function openModal(modalId) {
        const modal = getElement(modalId);

        if (!modal) {
            return;
        }

        modal.style.display = "flex";
        modal.classList.add("open");

        modal.setAttribute(
            "aria-hidden",
            "false"
        );
    }

    function closeAllModals() {
        document
            .querySelectorAll(".modal")
            .forEach((modal) => {
                modal.style.display = "none";
                modal.classList.remove("open");

                modal.setAttribute(
                    "aria-hidden",
                    "true"
                );
            });
    }

    function readPreparationForm() {
        const previousImageName =
            state.preparation?.weatherImageName ||
            "";
        const previousImageData =
            state.preparation?.weatherImageData ||
            "";

        const selectedImage =
            getElement("weatherImage")
                ?.files?.[0];

        return {
            weatherImageName:
                selectedImage?.name ||
                previousImageName,

            weatherImageData:
                previousImageData,

            windAverage:
                toNumberOrNull(
                    getElement("windAverage")
                        ?.value
                ),

            windGust:
                toNumberOrNull(
                    getElement("windGust")
                        ?.value
                ),

            windDirection:
                toNumberOrNull(
                    getElement("windDirection")
                        ?.value
                ),

            seaState:
                getElement("seaState")
                    ?.value ||
                "",

            weatherNotes:
                getElement("weatherNotes")
                    ?.value
                    .trim() ||
                "",

            mainSail:
                getElement("mainSail")
                    ?.value ||
                state.settings.defaultMainSail,

            jib:
                getElement("jib")
                    ?.value ||
                state.settings.defaultJib,

            spinnaker:
                getElement("spinnaker")
                    ?.value ||
                state.settings.defaultSpi,

            crew: clamp(
                toNumberOrNull(
                    getElement("crew")
                        ?.value
                ) ||
                state.settings.defaultCrew,
                1,
                10
            ),

            navigationNotes:
                getElement("navigationNotes")
                    ?.value
                    .trim() ||
                "",

            updatedAt:
                new Date().toISOString()
        };
    }

    function savePreparationDraft() {
        state.preparation =
            readPreparationForm();

        saveJSON(
            STORAGE_KEYS.preparation,
            state.preparation
        );
    }

    function loadPreparationForm() {
        const data =
            state.preparation || {
                windAverage: null,
                windGust: null,
                windDirection: null,
                seaState: "",
                weatherNotes: "",
                mainSail:
                    state.settings
                        .defaultMainSail,
                jib:
                    state.settings
                        .defaultJib,
                spinnaker:
                    state.settings
                        .defaultSpi,
                crew:
                    state.settings
                        .defaultCrew,
                navigationNotes: ""
            };

        setInputValue(
            "windAverage",
            data.windAverage
        );

        setInputValue(
            "windGust",
            data.windGust
        );

        setInputValue(
            "windDirection",
            data.windDirection
        );

        setInputValue(
            "seaState",
            data.seaState
        );

        setInputValue(
            "weatherNotes",
            data.weatherNotes
        );

        setInputValue(
            "mainSail",
            data.mainSail ||
                state.settings
                    .defaultMainSail
        );

        setInputValue(
            "jib",
            data.jib ||
                state.settings
                    .defaultJib
        );

        setInputValue(
            "spinnaker",
            data.spinnaker ||
                state.settings
                    .defaultSpi
        );

        setInputValue(
            "crew",
            data.crew ||
                state.settings
                    .defaultCrew
        );

        setInputValue(
            "navigationNotes",
            data.navigationNotes
        );
    }

    function setInputValue(id, value) {
        const element = getElement(id);

        if (!element) {
            return;
        }

        element.value =
            value ?? "";
    }

    function validatePreparation(data) {
        const errors = [];

        if (
            data.windAverage !== null &&
            (
                data.windAverage < 0 ||
                data.windAverage > 100
            )
        ) {
            errors.push(
                "Le vent moyen doit être compris entre 0 et 100 nœuds."
            );
        }

        if (
            data.windGust !== null &&
            (
                data.windGust < 0 ||
                data.windGust > 120
            )
        ) {
            errors.push(
                "Les rafales doivent être comprises entre 0 et 120 nœuds."
            );
        }

        if (
            data.windAverage !== null &&
            data.windGust !== null &&
            data.windGust <
                data.windAverage
        ) {
            errors.push(
                "Les rafales ne peuvent pas être inférieures au vent moyen."
            );
        }

        if (
            data.windDirection !== null &&
            (
                data.windDirection < 0 ||
                data.windDirection > 359
            )
        ) {
            errors.push(
                "La direction doit être comprise entre 0° et 359°."
            );
        }

        if (
            !Number.isInteger(data.crew) ||
            data.crew < 1 ||
            data.crew > 10
        ) {
            errors.push(
                "Le nombre de personnes doit être compris entre 1 et 10."
            );
        }

        return errors;
    }

    function startPreparedNavigation() {
        const preparation =
            readPreparationForm();

        const errors =
            validatePreparation(
                preparation
            );

        if (errors.length > 0) {
            alert(errors.join("\n"));
            return;
        }

        state.preparation =
            preparation;

        saveJSON(
            STORAGE_KEYS.preparation,
            preparation
        );

        startNavigation(preparation);
    }

    function startNavigation(preparation) {
        if (
            state.currentNavigation
                ?.status === "running"
        ) {
            showPage(
                "navigationPage"
            );

            startNavigationRuntime();

            return;
        }

        const now =
            new Date().toISOString();

        state.currentNavigation = {
            id: `navigation-${Date.now()}`,
            status: "running",

            boatName:
                state.settings.boatName,

            startedAt: now,
            endedAt: null,

            preparation:
                preparation || {
                    mainSail:
                        state.settings
                            .defaultMainSail,

                    jib:
                        state.settings
                            .defaultJib,

                    spinnaker:
                        state.settings
                            .defaultSpi,

                    crew:
                        state.settings
                            .defaultCrew
                },

            track: [],
            windRecords: [],
            trimRecords: [],
            markers: [],

            distanceNm: 0,
            currentSpeedKn: 0,
            maxSpeedKn: 0,
            currentHeading: null,
            gpsStatus: "searching"
        };

        saveJSON(
            STORAGE_KEYS.currentNavigation,
            state.currentNavigation
        );

        showPage("navigationPage");

        startNavigationRuntime();
    }

    function startNavigationRuntime() {
        stopNavigationRuntime();

        state.timerId =
            window.setInterval(
                updateNavigationDashboard,
                1000
            );

        if (
            "geolocation" in navigator
        ) {
            state.gpsWatchId =
                navigator.geolocation
                    .watchPosition(
                        handleGPSPosition,

                        handleGPSError,

                        {
                            enableHighAccuracy:
                                true,

                            maximumAge: 2000,

                            timeout: 15000
                        }
                    );
        } else {
            displayMapMessage(
                "La géolocalisation n'est pas disponible."
            );
        }

        updateNavigationDashboard();
    }

    function stopNavigationRuntime() {
        if (state.timerId !== null) {
            clearInterval(
                state.timerId
            );

            state.timerId = null;
        }

        if (
            state.gpsWatchId !== null &&
            "geolocation" in navigator
        ) {
            navigator.geolocation
                .clearWatch(
                    state.gpsWatchId
                );

            state.gpsWatchId = null;
        }
    }

    function handleGPSPosition(position) {
        if (
            !state.currentNavigation ||
            state.currentNavigation
                .status !== "running"
        ) {
            return;
        }

        const coordinates =
            position.coords;

        const point = {
            latitude:
                coordinates.latitude,

            longitude:
                coordinates.longitude,

            accuracy:
                coordinates.accuracy,

            speedKn:
                Number.isFinite(
                    coordinates.speed
                ) &&
                coordinates.speed >= 0
                    ? coordinates.speed *
                      1.943844
                    : null,

            heading:
                Number.isFinite(
                    coordinates.heading
                ) &&
                coordinates.heading >= 0
                    ? coordinates.heading
                    : null,

            timestamp:
                new Date(
                    position.timestamp
                ).toISOString()
        };

        const track =
            state.currentNavigation.track;

        const previousPoint =
            track[track.length - 1];

        if (previousPoint) {
            const segmentDistance =
                calculateDistanceNm(
                    previousPoint.latitude,
                    previousPoint.longitude,
                    point.latitude,
                    point.longitude
                );

            if (
                segmentDistance >= 0 &&
                segmentDistance < 0.5
            ) {
                state.currentNavigation
                    .distanceNm +=
                    segmentDistance;
            }
        }

        if (point.speedKn !== null) {
            state.currentNavigation
                .currentSpeedKn =
                point.speedKn;

            state.currentNavigation
                .maxSpeedKn =
                Math.max(
                    state.currentNavigation
                        .maxSpeedKn,

                    point.speedKn
                );
        }

        if (point.heading === null && previousPoint) {
            const moved = calculateDistanceNm(
                previousPoint.latitude,
                previousPoint.longitude,
                point.latitude,
                point.longitude
            );
            if (moved >= 0.002) {
                point.heading = calculateBearing(
                    previousPoint.latitude,
                    previousPoint.longitude,
                    point.latitude,
                    point.longitude
                );
            }
        }

        if (point.heading !== null) {
            state.currentNavigation.currentHeading = point.heading;
        }
        state.currentNavigation.gpsStatus = "active";

        track.push(point);

        if (track.length % 3 === 0) {
            saveJSON(
                STORAGE_KEYS
                    .currentNavigation,

                state.currentNavigation
            );
        }

        updateNavigationDashboard();

        displayMapMessage(
            "GPS actif — " +
            point.latitude.toFixed(5) +
            ", " +
            point.longitude.toFixed(5)
        );
    }

    function handleGPSError(error) {
        console.warn(
            "Erreur GPS :",
            error
        );

        let message =
            "GPS indisponible.";

        if (error.code === 1) {
            message =
                "Autorisation GPS refusée.";
        }

        if (error.code === 2) {
            message =
                "Position GPS indisponible.";
        }

        if (error.code === 3) {
            message =
                "Le GPS met trop de temps à répondre.";
        }

        if (state.currentNavigation) {
            state.currentNavigation.gpsStatus = "error";
        }
        updateNavigationDashboard();
    }

    function calculateDistanceNm(
        latitude1,
        longitude1,
        latitude2,
        longitude2
    ) {
        const earthRadiusKm =
            6371.0088;

        const toRadians =
            (degrees) =>
                degrees *
                Math.PI /
                180;

        const latitudeDifference =
            toRadians(
                latitude2 -
                latitude1
            );

        const longitudeDifference =
            toRadians(
                longitude2 -
                longitude1
            );

        const value =
            Math.sin(
                latitudeDifference / 2
            ) ** 2 +
            Math.cos(
                toRadians(latitude1)
            ) *
            Math.cos(
                toRadians(latitude2)
            ) *
            Math.sin(
                longitudeDifference / 2
            ) ** 2;

        const distanceKm =
            2 *
            earthRadiusKm *
            Math.asin(
                Math.sqrt(value)
            );

        return distanceKm / 1.852;
    }

    function getElapsedMilliseconds(
        navigation
    ) {
        if (!navigation?.startedAt) {
            return 0;
        }

        const endDate =
            navigation.endedAt
                ? new Date(
                    navigation.endedAt
                )
                : new Date();

        return Math.max(
            0,
            endDate -
            new Date(
                navigation.startedAt
            )
        );
    }

    function formatDuration(
        milliseconds
    ) {
        const totalSeconds =
            Math.floor(
                milliseconds / 1000
            );

        const hours =
            String(
                Math.floor(
                    totalSeconds / 3600
                )
            ).padStart(2, "0");

        const minutes =
            String(
                Math.floor(
                    (
                        totalSeconds %
                        3600
                    ) / 60
                )
            ).padStart(2, "0");

        const seconds =
            String(
                totalSeconds % 60
            ).padStart(2, "0");

        return (
            hours +
            ":" +
            minutes +
            ":" +
            seconds
        );
    }

    function calculateVMG() {
        const navigation =
            state.currentNavigation;

        const windRecord =
            navigation
                ?.windRecords
                ?.slice(-1)[0];

        const lastPoint =
            navigation
                ?.track
                ?.slice(-1)[0];

        if (
            !windRecord ||
            !lastPoint ||
            lastPoint.speedKn === null ||
            lastPoint.heading === null
        ) {
            return 0;
        }

        const angle =
            calculateSmallestAngle(
                lastPoint.heading,
                windRecord.direction
            );

        return (
            lastPoint.speedKn *
            Math.cos(
                angle *
                Math.PI /
                180
            )
        );
    }

    function calculateSmallestAngle(
        angle1,
        angle2
    ) {
        const difference =
            Math.abs(
                angle1 - angle2
            ) % 360;

        return difference > 180
            ? 360 - difference
            : difference;
    }

    function calculateBearing(lat1, lon1, lat2, lon2) {
        const toRad = value => value * Math.PI / 180;
        const toDeg = value => value * 180 / Math.PI;
        const phi1 = toRad(lat1);
        const phi2 = toRad(lat2);
        const deltaLon = toRad(lon2 - lon1);
        const y = Math.sin(deltaLon) * Math.cos(phi2);
        const x = Math.cos(phi1) * Math.sin(phi2) -
            Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLon);
        return (toDeg(Math.atan2(y, x)) + 360) % 360;
    }

    function getPolarTargetSpeed(navigation) {
        const polar = state.settings?.polarData;
        const wind = navigation?.windRecords?.slice(-1)[0]?.speed ?? navigation?.preparation?.windAverage;
        const windDirection = navigation?.windRecords?.slice(-1)[0]?.direction ?? navigation?.preparation?.windDirection;
        const heading = navigation?.currentHeading;
        if (!Array.isArray(polar) || !polar.length || !Number.isFinite(Number(wind)) || !Number.isFinite(Number(windDirection)) || !Number.isFinite(Number(heading))) return null;
        const twa = calculateSmallestAngle(Number(heading), Number(windDirection));
        let best = null;
        polar.forEach(row => {
            const ws = Number(row.windSpeed ?? row.tws ?? row.wind);
            const angle = Number(row.angle ?? row.twa);
            const speed = Number(row.speed ?? row.boatSpeed ?? row.target);
            if (![ws, angle, speed].every(Number.isFinite)) return;
            const distance = Math.abs(ws - Number(wind)) * 4 + Math.abs(angle - twa);
            if (!best || distance < best.distance) best = { distance, speed };
        });
        return best?.speed ?? null;
    }

    function updateGPSIndicator(status) {
        const dot = getElement("navGPSDot");
        if (!dot) return;
        dot.className = "gpsMiniDot " + (status === "active" ? "active" : status === "error" ? "error" : "searching");
        const label = status === "active" ? "GPS actif" : status === "error" ? "GPS indisponible" : "GPS en recherche";
        dot.setAttribute("aria-label", label);
        dot.title = label;
    }

    function updateNavigationDashboard() {
        const navigation = state.currentNavigation;
        const now = new Date();
        setText("navClock", now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }));

        if (!navigation) {
            updateGPSIndicator("searching");
            setText("navSpeed", "0.0 nd");
            setText("navHeading", "---°");
            setText("navPolar", "— %");
            setText("navTargetSpeed", "— nd");
            return;
        }

        updateGPSIndicator(navigation.gpsStatus);
        const speed = Number(navigation.currentSpeedKn || 0);
        const target = getPolarTargetSpeed(navigation);
        setText("navSpeed", speed.toFixed(1) + " nd");
        setText("navHeading", Number.isFinite(navigation.currentHeading)
            ? Math.round(navigation.currentHeading).toString().padStart(3, "0") + "°"
            : "---°");
        setText("navTargetSpeed", Number.isFinite(target) ? target.toFixed(1) + " nd" : "— nd");
        setText("navPolar", Number.isFinite(target) && target > 0 ? Math.round(speed / target * 100) + " %" : "— %");
    }

    function setText(id, value) {
        const element =
            getElement(id);

        if (element) {
            element.textContent =
                value;
        }
    }


    function renderTrackMap() {
        // La carte est volontairement absente pendant la navigation.
    }

    function displayMapMessage(message) {
        if (/actif/i.test(message) && state.currentNavigation) {
            state.currentNavigation.gpsStatus = "active";
        }
        setText("navGPS", message || "Recherche…");
    }

    function askToStopNavigation() {
        if (
            !state.currentNavigation ||
            state.currentNavigation
                .status !== "running"
        ) {
            showPage("homePage");
            return;
        }

        showConfirmation(
            "Arrêter la navigation",
            "La navigation sera enregistrée dans l'historique.",
            finishNavigation
        );
    }

    function finishNavigation() {
        if (!state.currentNavigation) {
            return;
        }

        stopNavigationRuntime();

        state.currentNavigation.status =
            "completed";

        state.currentNavigation.endedAt =
            new Date().toISOString();

        state.history.unshift(
            cloneValue(
                state.currentNavigation
            )
        );

        saveJSON(
            STORAGE_KEYS.history,
            state.history
        );

        state.currentNavigation = null;

        localStorage.removeItem(
            STORAGE_KEYS.currentNavigation
        );

        state.preparation = null;

        localStorage.removeItem(
            STORAGE_KEYS.preparation
        );

        showPage("historyPage");
    }

    function openWindModal() {
        if (!state.currentNavigation) {
            return;
        }

        const lastRecord =
            state.currentNavigation
                .windRecords
                .slice(-1)[0];

        setInputValue(
            "popupWindSpeed",
            lastRecord?.speed
        );

        setInputValue(
            "popupWindDirection",
            lastRecord?.direction
        );

        setInputValue(
            "popupWindQuality",
            lastRecord?.quality ||
                "green"
        );

        openModal("windModal");
    }

    function saveWindRecord() {
        if (!state.currentNavigation) {
            return;
        }

        const speed =
            toNumberOrNull(
                getElement(
                    "popupWindSpeed"
                )?.value
            );

        const direction =
            toNumberOrNull(
                getElement(
                    "popupWindDirection"
                )?.value
            );

        const quality =
            getElement(
                "popupWindQuality"
            )?.value ||
            "green";

        if (
            speed === null ||
            speed < 0 ||
            speed > 100
        ) {
            alert(
                "Indique une force de vent comprise entre 0 et 100 nœuds."
            );

            return;
        }

        if (
            direction === null ||
            direction < 0 ||
            direction > 359
        ) {
            alert(
                "Indique une direction comprise entre 0° et 359°."
            );

            return;
        }

        state.currentNavigation
            .windRecords
            .push({
                speed,
                direction,
                quality,

                timestamp:
                    new Date()
                        .toISOString(),

                position:
                    state.currentNavigation
                        .track
                        .slice(-1)[0] ||
                    null
            });

        saveJSON(
            STORAGE_KEYS.currentNavigation,
            state.currentNavigation
        );

        closeAllModals();

        updateNavigationDashboard();
    }

    function readCompass() {
        alert(
            "Pour cette version, ouvre la boussole de l'iPhone et saisis la direction affichée. La lecture automatique sera ajoutée ensuite."
        );
    }

    function openTrimModal() {
        if (!state.currentNavigation) {
            return;
        }

        const lastRecord =
            state.currentNavigation
                .trimRecords
                .slice(-1)[0];

        if (lastRecord) {
            setInputValue(
                "trimTravelerMain",
                lastRecord.travelerMain
            );

            setInputValue(
                "trimTravelerJib",
                lastRecord.travelerJib
            );

            setInputValue(
                "trimRotation",
                lastRecord.rotation
            );

            setInputValue(
                "trimCunningham",
                lastRecord.cunningham
            );

            setInputValue(
                "trimOuthaul",
                lastRecord.outhaul
            );

            setInputValue(
                "trimSheet",
                lastRecord.sheet
            );
        }

        openModal("trimModal");
    }

    function saveTrimRecord() {
        if (!state.currentNavigation) return;

        const previous = state.currentNavigation.trimRecords.slice(-1)[0] || null;
        const record = {
            travelerMain: getElement("trimTravelerMain")?.value || "",
            travelerJib: getElement("trimTravelerJib")?.value || "",
            rotation: getElement("trimRotation")?.value || "",
            cunningham: getElement("trimCunningham")?.value || "",
            outhaul: getElement("trimOuthaul")?.value || "",
            sheet: getElement("trimSheet")?.value || "",
            timestamp: new Date().toISOString(),
            position: state.currentNavigation.track.slice(-1)[0] || null,
            previousSettings: previous ? {
                travelerMain: previous.travelerMain,
                travelerJib: previous.travelerJib,
                rotation: previous.rotation,
                cunningham: previous.cunningham
            } : null,
            stabilizationSeconds: 120
        };

        state.currentNavigation.trimRecords.push(record);
        saveJSON(STORAGE_KEYS.currentNavigation, state.currentNavigation);
        closeAllModals();
    }

    const MARKER_LABELS = {
        "tack": "Virement",
        "gybe": "Empannage",
        "spi-hoist": "Envoi de spi",
        "spi-drop": "Affalage du spi",
        "other": "Autre"
    };

    function addMarker() {
        if (!state.currentNavigation) return;
        openModal("markerModal");
    }

    function saveTypedMarker(type) {
        if (!state.currentNavigation || !MARKER_LABELS[type]) return;
        state.currentNavigation.markers.push({
            type,
            name: MARKER_LABELS[type],
            timestamp: new Date().toISOString(),
            position: state.currentNavigation.track.slice(-1)[0] || null
        });
        saveJSON(STORAGE_KEYS.currentNavigation, state.currentNavigation);
        closeAllModals();
    }

    function loadSettingsForm() {
        setInputValue(
            "boatName",
            state.settings.boatName
        );

        setInputValue(
            "defaultMainSail",
            state.settings
                .defaultMainSail
        );

        setInputValue(
            "defaultJib",
            state.settings
                .defaultJib
        );

        setInputValue(
            "defaultSpi",
            state.settings
                .defaultSpi
        );

        setInputValue(
            "defaultCrew",
            state.settings
                .defaultCrew
        );

        setText(
            "appVersion",
            APP_VERSION
        );
    }

    function saveSettings() {
        state.settings = {
            boatName:
                getElement("boatName")
                    ?.value
                    .trim() ||
                "Speed Feet 18",

            defaultMainSail:
                getElement(
                    "defaultMainSail"
                )?.value ||
                DEFAULT_SETTINGS
                    .defaultMainSail,

            defaultJib:
                getElement(
                    "defaultJib"
                )?.value ||
                DEFAULT_SETTINGS
                    .defaultJib,

            defaultSpi:
                getElement(
                    "defaultSpi"
                )?.value ||
                DEFAULT_SETTINGS
                    .defaultSpi,

            defaultCrew:
                clamp(
                    toNumberOrNull(
                        getElement(
                            "defaultCrew"
                        )?.value
                    ) ||
                    1,
                    1,
                    10
                )
        };

        saveJSON(
            STORAGE_KEYS.settings,
            state.settings
        );

        alert(
            "Paramètres enregistrés."
        );

        showPage("homePage");
    }

    function renderRecentNavigations() {
        const container =
            getElement(
                "recentNavigationList"
            );

        if (!container) {
            return;
        }

        const recentNavigations =
            state.history.slice(0, 1);

        if (
            recentNavigations.length === 0
        ) {
            container.innerHTML =
                '<div class="emptyCard">Aucune navigation enregistrée.</div>';

            return;
        }

        container.innerHTML =
            recentNavigations
                .map(createHistoryCard)
                .join("");
    }

    function renderHistory() {
        const container =
            getElement("historyList");

        if (!container) {
            return;
        }

        if (state.history.length === 0) {
            container.innerHTML =
                '<div class="emptyCard">Aucune navigation enregistrée.</div>';

            return;
        }

        container.innerHTML =
            state.history
                .map(createHistoryCard)
                .join("");
    }

    function createHistoryCard(
        navigation
    ) {
        const date =
            new Intl.DateTimeFormat(
                "fr-FR",
                {
                    dateStyle: "medium",
                    timeStyle: "short"
                }
            ).format(
                new Date(
                    navigation.startedAt
                )
            );

        const duration =
            formatDuration(
                getElapsedMilliseconds(
                    navigation
                )
            );

        const configuration =
            navigation.preparation ||
            {};

        return `
            <article class="card navigationHistoryCard"
                     data-navigation-id="${escapeHTML(navigation.id)}"
                     role="button"
                     tabindex="0"
                     aria-label="Ouvrir le détail de cette navigation">
                <h3>${escapeHTML(
                    navigation.boatName ||
                    "Speed Feet 18"
                )}</h3>

                <p>
                    <strong>${escapeHTML(
                        date
                    )}</strong>
                </p>

                <p>
                    ${escapeHTML(duration)}
                    ·
                    ${Number(
                        navigation.distanceNm ||
                        0
                    ).toFixed(2)} nm
                    ·
                    Vmax
                    ${Number(
                        navigation.maxSpeedKn ||
                        0
                    ).toFixed(1)} nd
                </p>

                <p>
                    ${escapeHTML(
                        configuration.mainSail ||
                        ""
                    )}
                    ·
                    ${escapeHTML(
                        configuration.jib ||
                        ""
                    )}
                    ·
                    ${escapeHTML(
                        configuration.spinnaker ||
                        ""
                    )}
                </p>
            </article>
        `;
    }


    function findNavigationById(navigationId) {
        return state.history.find(
            navigation => navigation.id === navigationId
        ) || null;
    }

    function formatDateTime(value) {
        if (!value) {
            return "Non renseigné";
        }

        return new Intl.DateTimeFormat(
            "fr-FR",
            {
                dateStyle: "long",
                timeStyle: "short"
            }
        ).format(new Date(value));
    }

    function createHistoricalTrackSVG(navigation) {
        const track = navigation?.track || [];
        if (track.length < 2) {
            return `<div class="emptyCard">Aucune trace GPS exploitable pour cette sortie.</div>`;
        }
        return `<div id="historySatelliteMap" class="historySatelliteMap" aria-label="Carte satellite de la sortie"></div>
            <p class="smallText">Fond satellite disponible avec une connexion Internet.</p>`;
    }

    function initializeHistorySatelliteMap(navigation) {
        const container = getElement("historySatelliteMap");
        const track = navigation?.track || [];
        if (!container || track.length < 2 || typeof L === "undefined") return;

        if (state.historyMap) {
            state.historyMap.remove();
            state.historyMap = null;
        }
        const map = L.map(container, { zoomControl: true });
        state.historyMap = map;
        L.tileLayer(
            "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            { maxZoom: 19, attribution: "Tiles © Esri" }
        ).addTo(map);

        const latlngs = track.map(point => [point.latitude, point.longitude]);
        L.polyline(latlngs, { color: "#42a5ff", weight: 5, opacity: 0.95 }).addTo(map);
        L.circleMarker(latlngs[0], { radius: 7, color: "#fff", weight: 2, fillColor: "#32d583", fillOpacity: 1 })
            .addTo(map).bindPopup("Départ");
        L.circleMarker(latlngs[latlngs.length - 1], { radius: 7, color: "#fff", weight: 2, fillColor: "#f04438", fillOpacity: 1 })
            .addTo(map).bindPopup("Arrivée");

        (navigation.markers || []).filter(marker => marker.position).forEach(marker => {
            const label = MARKER_LABELS[marker.type] || marker.name || "Marqueur";
            L.circleMarker([marker.position.latitude, marker.position.longitude], {
                radius: 7, color: "#fff", weight: 2, fillColor: "#fdb022", fillOpacity: 1
            }).addTo(map).bindPopup(`<strong>${escapeHTML(label)}</strong><br>${escapeHTML(formatDateTime(marker.timestamp))}`);
        });
        map.fitBounds(L.latLngBounds(latlngs), { padding: [24, 24], maxZoom: 17 });
        setTimeout(() => map.invalidateSize(), 80);
    }

    function averageSpeedInWindow(track, startMs, endMs) {
        const values = track.filter(point => {
            const t = new Date(point.timestamp).getTime();
            return t >= startMs && t <= endMs && Number.isFinite(point.speedKn);
        }).map(point => point.speedKn);
        if (values.length < 4) return null;
        return values.reduce((sum, value) => sum + value, 0) / values.length;
    }

    function analyzeTrimRecords(navigation) {
        const track = navigation.track || [];
        const records = navigation.trimRecords || [];
        return records.map((record, recordIndex) => {
            const t = new Date(record.timestamp).getTime();
            const nextRecordTime = records[recordIndex + 1] ? new Date(records[recordIndex + 1].timestamp).getTime() : null;
            const interrupted = Number.isFinite(nextRecordTime) && nextRecordTime < t + 240000;
            const before = averageSpeedInWindow(track, t - 120000, t);
            const after = averageSpeedInWindow(track, t + 120000, t + 240000);
            const changes = [];
            const labels = { travelerMain: "Chariot GV", travelerJib: "Chariot foc", rotation: "Rotation mât", cunningham: "Cunningham" };
            if (record.previousSettings) {
                Object.keys(labels).forEach(key => {
                    if (record.previousSettings[key] !== record[key]) changes.push(`${labels[key]} ${record.previousSettings[key]} → ${record[key]}`);
                });
            }
            const gain = !interrupted && before !== null && after !== null ? after - before : null;
            return { record, before, after, gain, changes, interrupted };
        });
    }

    function createTrimAnalysisHTML(navigation) {
        const analyses = analyzeTrimRecords(navigation).filter(item => item.changes.length);
        if (!analyses.length) return `<p>Aucun changement de réglage comparable.</p>`;
        return analyses.map(item => {
            let verdict = item.interrupted ? "Analyse annulée : nouveau réglage avant la fin de la stabilisation" : "Données insuffisantes";
            let cls = "";
            if (!item.interrupted && item.gain !== null) {
                if (item.gain > 0.08) { verdict = "Amélioration probable"; cls = "positive"; }
                else if (item.gain < -0.08) { verdict = "Dégradation probable"; cls = "negative"; }
                else verdict = "Effet peu significatif";
            }
            return `<div class="trimAnalysisItem">
                <strong>${escapeHTML(item.changes.join(" · "))}</strong>
                <span>${escapeHTML(formatDateTime(item.record.timestamp))}</span>
                <p>Stabilisation : 2 min, puis comparaison sur 2 min.</p>
                <p class="trimVerdict ${cls}">${verdict}${item.gain === null ? "" : ` (${item.gain >= 0 ? "+" : ""}${item.gain.toFixed(2)} nd)`}</p>
            </div>`;
        }).join("");
    }

    function openNavigationDetails(navigationId) {
        const navigation = findNavigationById(navigationId);

        if (!navigation) {
            alert("Cette navigation est introuvable.");
            return;
        }

        let modal = getElement("navigationDetailsModal");

        if (!modal) {
            modal = document.createElement("div");
            modal.id = "navigationDetailsModal";
            modal.className = "modal historyDetailsModal";
            modal.setAttribute("aria-hidden", "true");

            modal.innerHTML = `
                <div class="modalContent historyDetailsContent">
                    <div class="historyDetailsHeader">
                        <h2 id="navigationDetailsTitle">
                            Détail de la sortie
                        </h2>

                        <button
                            type="button"
                            id="btnCloseNavigationDetails"
                            class="secondaryButton compactButton"
                        >
                            Fermer
                        </button>
                    </div>

                    <div id="navigationDetailsBody"></div>
                </div>
            `;

            document.body.appendChild(modal);

            getElement("btnCloseNavigationDetails")
                ?.addEventListener(
                    "click",
                    closeAllModals
                );

            modal.addEventListener(
                "click",
                event => {
                    if (event.target === modal) {
                        closeAllModals();
                    }
                }
            );
        }

        const preparation = navigation.preparation || {};
        const windRecords = navigation.windRecords || [];
        const trimRecords = navigation.trimRecords || [];
        const markers = navigation.markers || [];
        const latestWind = windRecords.slice(-1)[0];

        setText(
            "navigationDetailsTitle",
            navigation.boatName || "Détail de la sortie"
        );

        const body = getElement("navigationDetailsBody");

        if (!body) {
            return;
        }

        body.innerHTML = `
            <div class="historyDetailsGrid">
                <div class="detailStat">
                    <span>Date</span>
                    <strong>
                        ${escapeHTML(formatDateTime(navigation.startedAt))}
                    </strong>
                </div>

                <div class="detailStat">
                    <span>Durée</span>
                    <strong>
                        ${escapeHTML(
                            formatDuration(
                                getElapsedMilliseconds(navigation)
                            )
                        )}
                    </strong>
                </div>

                <div class="detailStat">
                    <span>Distance</span>
                    <strong>
                        ${Number(navigation.distanceNm || 0).toFixed(2)} nm
                    </strong>
                </div>

                <div class="detailStat">
                    <span>Vitesse maximale</span>
                    <strong>
                        ${Number(navigation.maxSpeedKn || 0).toFixed(1)} nd
                    </strong>
                </div>
            </div>

            <section class="historyDetailSection">
                <h3>Configuration</h3>
                <p>
                    ${escapeHTML(preparation.mainSail || "GV non renseignée")}
                    ·
                    ${escapeHTML(preparation.jib || "Foc non renseigné")}
                    ·
                    ${escapeHTML(preparation.spinnaker || "Spi non renseigné")}
                </p>
                <p>
                    Équipage :
                    ${Number(preparation.crew || 1)}
                </p>
            </section>

            <section class="historyDetailSection">
                <h3>Météo préparée</h3>
                <p>
                    Vent moyen :
                    ${preparation.windAverage ?? "—"} nd
                    · Rafales :
                    ${preparation.windGust ?? "—"} nd
                    · Direction :
                    ${preparation.windDirection ?? "—"}°
                </p>
                <p>
                    État de mer :
                    ${escapeHTML(preparation.seaState || "Non renseigné")}
                </p>
                ${preparation.weatherNotes ? `<p>${escapeHTML(preparation.weatherNotes)}</p>` : ""}
                ${preparation.weatherImageData
                    ? `<button type="button" class="weatherThumbnailButton" id="btnWeatherThumbnail"><img src="${preparation.weatherImageData}" alt="${escapeHTML(preparation.weatherImageName || "Capture météo")}"></button>`
                    : `<p>Aucune capture météo enregistrée pour cette navigation.</p>`}
            </section>

            <section class="historyDetailSection">
                <h3>Données enregistrées</h3>
                <p>
                    Points GPS : ${navigation.track?.length || 0}
                    · Relevés de vent : ${windRecords.length}
                    · Réglages : ${trimRecords.length}
                    · Marqueurs : ${markers.length}
                </p>

                ${
                    latestWind
                        ? `
                            <p>
                                Dernier vent saisi :
                                ${Number(latestWind.speed).toFixed(1)} nd
                                à
                                ${Number(latestWind.direction).toFixed(0)}°
                            </p>
                        `
                        : ""
                }
            </section>

            <section class="historyDetailSection">
                <h3>Analyse des réglages</h3>
                ${createTrimAnalysisHTML(navigation)}
            </section>

            <section class="historyDetailSection">
                <h3>Trace GPS sur carte satellite</h3>
                ${createHistoricalTrackSVG(navigation)}
            </section>

            <section class="historyDetailSection">
                <h3>Source GPS</h3>
                <div class="vccStatus">${navigation.speedPuck ? `SpeedPuck — ${escapeHTML(navigation.speedPuck.fileName)} · ${navigation.speedPuck.pointCount} points` : "Téléphone — aucun fichier VCC importé"}</div>
                <div class="historyActionBar">
                    <button type="button" id="btnImportNavigationVCC" class="secondaryButton">Importer un fichier VCC SpeedPuck</button>
                    <button type="button" id="btnDeleteNavigation" class="dangerButton">Supprimer cette navigation</button>
                </div>
            </section>

            ${
                preparation.navigationNotes
                    ? `
                        <section class="historyDetailSection">
                            <h3>Notes</h3>
                            <p>
                                ${escapeHTML(preparation.navigationNotes)}
                            </p>
                        </section>
                    `
                    : ""
            }
        `;

        getElement("btnWeatherThumbnail")?.addEventListener("click", () => openWeatherImage(preparation.weatherImageData, preparation.weatherImageName));
        getElement("btnImportNavigationVCC")?.addEventListener("click", () => importVCCForNavigation(navigation.id));
        getElement("btnDeleteNavigation")?.addEventListener("click", () => deleteNavigation(navigation.id));

        openModal("navigationDetailsModal");
        window.setTimeout(() => initializeHistorySatelliteMap(navigation), 50);
    }

    function bindHistoryCards() {
        const activateCard = event => {
            const actionButton = event.target.closest("[data-history-action]");
            if (actionButton) {
                event.preventDefault();
                event.stopPropagation();
                const navigationId = actionButton.dataset.navigationId;
                if (actionButton.dataset.historyAction === "delete") deleteNavigation(navigationId);
                if (actionButton.dataset.historyAction === "vcc") importVCCForNavigation(navigationId);
                if (actionButton.dataset.historyAction === "weather") openWeatherImage(actionButton.dataset.image, actionButton.dataset.imageName);
                return;
            }
            const card = event.target.closest(
                ".navigationHistoryCard"
            );

            if (!card) {
                return;
            }

            const navigationId =
                card.dataset.navigationId;

            if (navigationId) {
                openNavigationDetails(navigationId);
            }
        };

        ["recentNavigationList", "historyList"]
            .forEach(containerId => {
                const container = getElement(containerId);

                if (!container) {
                    return;
                }

                container.addEventListener(
                    "click",
                    activateCard
                );

                container.addEventListener(
                    "keydown",
                    event => {
                        if (
                            event.key === "Enter" ||
                            event.key === " "
                        ) {
                            event.preventDefault();
                            activateCard(event);
                        }
                    }
                );
            });
    }

    function escapeHTML(value) {
        return String(value ?? "")
            .replaceAll(
                "&",
                "&amp;"
            )
            .replaceAll(
                "<",
                "&lt;"
            )
            .replaceAll(
                ">",
                "&gt;"
            )
            .replaceAll(
                '"',
                "&quot;"
            )
            .replaceAll(
                "'",
                "&#039;"
            );
    }

    function showConfirmation(
        title,
        message,
        action
    ) {
        setText(
            "confirmTitle",
            title
        );

        setText(
            "confirmMessage",
            message
        );

        state.confirmAction =
            action;

        openModal("confirmModal");
    }

    function confirmAction() {
        const action =
            state.confirmAction;

        state.confirmAction =
            null;

        closeAllModals();

        if (
            typeof action ===
            "function"
        ) {
            action();
        }
    }

    function compressImageFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(new Error("Lecture de l’image impossible."));
            reader.onload = () => {
                const image = new Image();
                image.onerror = () => reject(new Error("Image illisible."));
                image.onload = () => {
                    const maximum = 1600;
                    const ratio = Math.min(1, maximum / Math.max(image.width, image.height));
                    const canvas = document.createElement("canvas");
                    canvas.width = Math.max(1, Math.round(image.width * ratio));
                    canvas.height = Math.max(1, Math.round(image.height * ratio));
                    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
                    resolve(canvas.toDataURL("image/jpeg", 0.78));
                };
                image.src = reader.result;
            };
            reader.readAsDataURL(file);
        });
    }

    async function saveWeatherImage() {
        const file = getElement("weatherImage")?.files?.[0];
        if (!file) return;
        try {
            const imageData = await compressImageFile(file);
            const preparation = readPreparationForm();
            preparation.weatherImageName = file.name;
            preparation.weatherImageData = imageData;
            state.preparation = preparation;
            saveJSON(STORAGE_KEYS.preparation, preparation);
        } catch (error) {
            console.error(error);
            alert("La capture météo n’a pas pu être enregistrée.");
        }
    }

    function openWeatherImage(imageData, imageName) {
        if (!imageData) return;
        let modal = getElement("weatherImageModal");
        if (!modal) {
            modal = document.createElement("div");
            modal.id = "weatherImageModal";
            modal.className = "modal imageViewerModal";
            modal.innerHTML = `<div class="modalContent imageViewerContent"><div class="imageViewerToolbar"><button id="btnCloseWeatherImage" class="secondaryButton compactButton">Fermer</button></div><img id="weatherImageFull" class="imageViewerImage" alt="Capture météo agrandie"></div>`;
            document.body.appendChild(modal);
            getElement("btnCloseWeatherImage")?.addEventListener("click", closeAllModals);
            modal.addEventListener("click", event => { if (event.target === modal) closeAllModals(); });
        }
        const image = getElement("weatherImageFull");
        image.src = imageData;
        image.alt = imageName || "Capture météo agrandie";
        openModal("weatherImageModal");
    }

    function parseVCCText(text) {
        const parseNumber = value => Number(String(value ?? "").trim().replace(",", "."));
        const normalizedName = value => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");

        if (text.trim().startsWith("<")) {
            try {
                const documentXML = new DOMParser().parseFromString(text, "application/xml");
                if (!documentXML.querySelector("parsererror")) {
                    const candidates = Array.from(documentXML.querySelectorAll("trkpt, trackpoint, point, sample, fix, record"));
                    const xmlTrack = candidates.map((node, index) => {
                        const findValue = names => {
                            for (const name of names) {
                                const attribute = node.getAttribute(name);
                                if (attribute !== null) return attribute;
                                const child = Array.from(node.children).find(item => names.includes(normalizedName(item.tagName)));
                                if (child) return child.textContent;
                            }
                            return null;
                        };
                        const latitude = parseNumber(findValue(["lat", "latitude"]));
                        const longitude = parseNumber(findValue(["lon", "lng", "longitude"]));
                        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
                        const speed = parseNumber(findValue(["speedkn", "boatspeed", "sog", "speed", "vitesse"]));
                        const heading = parseNumber(findValue(["heading", "cog", "course", "cap"]));
                        const rawDate = findValue(["datetime", "timestamp", "time", "date", "heure"]);
                        const parsedDate = rawDate ? new Date(rawDate) : null;
                        return {
                            latitude,
                            longitude,
                            speedKn: Number.isFinite(speed) ? speed : null,
                            heading: Number.isFinite(heading) ? heading : null,
                            timestamp: parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : new Date(Date.now() + index * 1000).toISOString(),
                            source: "speedpuck"
                        };
                    }).filter(Boolean);
                    if (xmlTrack.length > 1) return xmlTrack;
                }
            } catch (error) {
                console.warn("Lecture XML VCC impossible", error);
            }
        }

        const lines = text.split(/\r?\n/).filter(line => line.trim());
        if (lines.length < 2) return [];
        const separator = lines[0].includes(";") ? ";" : lines[0].includes("\t") ? "\t" : ",";
        const clean = value => value.trim().replace(/^"|"$/g, "");
        const headers = lines[0].split(separator).map(value => normalizedName(clean(value)));
        const findIndex = names => headers.findIndex(header => names.some(name => header.includes(name)));
        const latIndex = findIndex(["latitude", "lat"]);
        const lonIndex = findIndex(["longitude", "lon", "lng"]);
        const speedIndex = findIndex(["speedkn", "boatspeed", "sog", "speed", "vitesse"]);
        const headingIndex = findIndex(["heading", "cog", "course", "cap"]);
        const dateIndex = findIndex(["datetime", "timestamp", "date", "time", "heure"]);
        if (latIndex < 0 || lonIndex < 0) return [];
        return lines.slice(1).map((line, index) => {
            const columns = line.split(separator).map(clean);
            const latitude = parseNumber(columns[latIndex]);
            const longitude = parseNumber(columns[lonIndex]);
            if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
            const rawDate = dateIndex >= 0 ? columns[dateIndex] : "";
            const parsedDate = rawDate ? new Date(rawDate) : null;
            const speed = speedIndex >= 0 ? parseNumber(columns[speedIndex]) : null;
            const heading = headingIndex >= 0 ? parseNumber(columns[headingIndex]) : null;
            return { latitude, longitude, speedKn: Number.isFinite(speed) ? speed : null, heading: Number.isFinite(heading) ? heading : null, timestamp: parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : new Date(Date.now() + index * 1000).toISOString(), source: "speedpuck" };
        }).filter(Boolean);
    }

    function importVCCForNavigation(navigationId) {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".vcc,.csv,.txt,text/plain,text/csv";
        input.addEventListener("change", async () => {
            const file = input.files?.[0];
            if (!file) return;
            try {
                const text = await file.text();
                const track = parseVCCText(text);
                if (track.length < 2) {
                    alert("Le fichier a été lu, mais aucune trace GPS exploitable n’a été reconnue. Le format VCC devra être adapté à ce modèle de fichier.");
                    return;
                }
                const navigation = findNavigationById(navigationId);
                if (!navigation) return;
                navigation.speedPuck = { fileName: file.name, importedAt: new Date().toISOString(), pointCount: track.length };
                navigation.phoneTrack = navigation.phoneTrack || navigation.track || [];
                navigation.speedPuckTrack = track;
                navigation.track = track;
                recalculateNavigationStats(navigation);
                saveJSON(STORAGE_KEYS.history, state.history);
                renderHistory();
                renderRecentNavigations();
                openNavigationDetails(navigationId);
            } catch (error) {
                console.error(error);
                alert("L’import du fichier VCC a échoué.");
            }
        });
        input.click();
    }

    function recalculateNavigationStats(navigation) {
        const track = navigation.track || [];
        let distance = 0;
        let maximum = 0;
        track.forEach((point, index) => {
            if (Number.isFinite(point.speedKn)) maximum = Math.max(maximum, point.speedKn);
            if (index) distance += calculateDistanceNm(track[index - 1].latitude, track[index - 1].longitude, point.latitude, point.longitude);
        });
        navigation.distanceNm = distance;
        navigation.maxSpeedKn = maximum;
    }

    function deleteNavigation(navigationId) {
        showConfirmation(
            "Supprimer cette navigation ?",
            "Cette suppression est irréversible. La navigation, ses données GPS, ses réglages, sa météo et son fichier SpeedPuck seront supprimés. Les polaires, recommandations de réglage et futurs conseils seront recalculés à partir des navigations restantes.",
            () => {
                state.history = state.history.filter(navigation => navigation.id !== navigationId);
                saveJSON(STORAGE_KEYS.history, state.history);
                renderHistory();
                renderRecentNavigations();
                closeAllModals();
            }
        );
    }

    function bindPreparationAutosave() {
        const fieldIds = [
            "weatherImage",
            "windAverage",
            "windGust",
            "windDirection",
            "seaState",
            "weatherNotes",
            "mainSail",
            "jib",
            "spinnaker",
            "crew",
            "navigationNotes"
        ];

        fieldIds.forEach((fieldId) => {
            const field =
                getElement(fieldId);

            if (!field) {
                return;
            }

            field.addEventListener(
                "input",
                savePreparationDraft
            );

            field.addEventListener(
                "change",
                savePreparationDraft
            );
        });

        getElement("weatherImage")?.addEventListener("change", saveWeatherImage);
    }

    function parsePolarText(text) {
        const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
        if (lines.length < 2) return [];
        const separator = lines[0].includes(";") ? ";" : lines[0].includes("\t") ? "\t" : ",";
        const cells = lines.map(line => line.split(separator).map(value => value.trim().replace(/^"|"$/g, "")));
        const number = value => Number(String(value).replace(",", "."));
        const header = cells[0].map(value => value.toLowerCase().replace(/[^a-z0-9]/g, ""));
        const windIndex = header.findIndex(value => ["wind", "tws", "vent", "windspeed"].some(name => value.includes(name)));
        const angleIndex = header.findIndex(value => ["angle", "twa", "allure"].some(name => value.includes(name)));
        const speedIndex = header.findIndex(value => ["speed", "boatspeed", "target", "vitesse"].some(name => value.includes(name)));
        if (windIndex >= 0 && angleIndex >= 0 && speedIndex >= 0) {
            return cells.slice(1).map(row => ({ windSpeed: number(row[windIndex]), angle: number(row[angleIndex]), speed: number(row[speedIndex]) }))
                .filter(row => [row.windSpeed, row.angle, row.speed].every(Number.isFinite));
        }
        const angles = cells[0].slice(1).map(number);
        const result = [];
        cells.slice(1).forEach(row => {
            const windSpeed = number(row[0]);
            row.slice(1).forEach((value, index) => {
                const speed = number(value);
                const angle = angles[index];
                if ([windSpeed, angle, speed].every(Number.isFinite)) result.push({ windSpeed, angle, speed });
            });
        });
        return result;
    }

    function importPolarFile() {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".csv,.txt,text/csv,text/plain";
        input.addEventListener("change", async () => {
            const file = input.files?.[0];
            if (!file) return;
            try {
                const polarData = parsePolarText(await file.text());
                if (!polarData.length) {
                    alert("La polaire n’a pas été reconnue. Utilisez un CSV avec Vent/TWA/Vitesse ou un tableau Vent × angles.");
                    return;
                }
                state.settings.polarData = polarData;
                state.settings.polarFileName = file.name;
                saveJSON(STORAGE_KEYS.settings, state.settings);
                alert(`Polaire importée : ${polarData.length} points.`);
            } catch (error) {
                console.error(error);
                alert("L’import de la polaire a échoué.");
            }
        });
        input.click();
    }

    function bindButtons() {
bindClick(
            "btnStartNavigation",
            () =>
                showPage(
                    "preparePage"
                )
        );

        bindClick(
            "btnHistory",
            () =>
                showPage(
                    "historyPage"
                )
        );

        bindClick(
            "btnSettings",
            () =>
                showPage(
                    "settingsPage"
                )
        );

        bindClick(
            "btnBackHome",
            () =>
                showPage(
                    "homePage"
                )
        );

        bindClick(
            "btnHistoryHome",
            () =>
                showPage(
                    "homePage"
                )
        );

        bindClick(
            "btnSettingsHome",
            () =>
                showPage(
                    "homePage"
                )
        );

        bindClick(
            "btnStartPreparedNavigation",
            startPreparedNavigation
        );

        bindClick(
            "btnSaveSettings",
            saveSettings
        );

        bindClick(
            "btnWind",
            openWindModal
        );

        bindClick(
            "btnTrim",
            openTrimModal
        );

        bindClick(
            "btnMarker",
            addMarker
        );

        bindClick(
            "btnStopNavigation",
            askToStopNavigation
        );

        bindClick(
            "btnCancelWind",
            closeAllModals
        );

        bindClick(
            "btnSaveWind",
            saveWindRecord
        );

        bindClick(
            "btnCompass",
            readCompass
        );

        bindClick(
            "btnCancelTrim",
            closeAllModals
        );

        bindClick(
            "btnSaveTrim",
            saveTrimRecord
        );

        bindClick(
            "btnConfirmCancel",
            () => {
                state.confirmAction =
                    null;

                closeAllModals();
            }
        );

        bindClick(
            "btnConfirmOk",
            confirmAction
        );

        bindClick(
            "btnImportPolar",
            importPolarFile
        );
document
            .querySelectorAll(".modal")
            .forEach((modal) => {
                modal.addEventListener(
                    "click",
                    (event) => {
                        if (
                            event.target ===
                            modal
                        ) {
                            closeAllModals();
                        }
                    }
                );
            });

        document.addEventListener(
            "keydown",
            (event) => {
                if (
                    event.key ===
                    "Escape"
                ) {
                    closeAllModals();
                }
            }
        );
    }

    function initializeApplication() {
        initializeSelects();

        loadSettingsForm();

        loadPreparationForm();

        bindButtons();

        bindPreparationAutosave();

        bindHistoryCards();

        document.querySelectorAll(".markerChoiceButton").forEach(button => {
            button.addEventListener("click", () => saveTypedMarker(button.dataset.markerType));
        });
        bindClick("btnCancelMarker", closeAllModals);

        renderRecentNavigations();

        displayMapMessage(
            "En attente du GPS"
        );

        if (
            state.currentNavigation?.status === "running"
        ) {
            showPage("navigationPage");
            startNavigationRuntime();
        } else {
            showPage("homePage");
        }

        window.addEventListener(
            "beforeunload",
            () => {
                if (
                    state.currentPage ===
                    "preparePage"
                ) {
                    savePreparationDraft();
                }

                if (
                    state.currentNavigation
                ) {
                    saveJSON(
                        STORAGE_KEYS
                            .currentNavigation,

                        state.currentNavigation
                    );
                }
            }
        );
    }

    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            initializeApplication
        );
    } else {
        initializeApplication();
    }
})();
