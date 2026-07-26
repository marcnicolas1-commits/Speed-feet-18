(() => {
    "use strict";

    const APP_VERSION = "3.2.4";

    const STORAGE_KEYS = {
        settings: "speedfeet_settings",
        preparation: "speedfeet_preparation",
        currentNavigation: "speedfeet_current_navigation",
        history: "speedfeet_history",
        nextNavigationNotes: "speedfeet_next_navigation_notes",
        checklistItems: "speedfeet_checklist_items",
        boatTasks: "speedfeet_boat_tasks"
    };

    const DEFAULT_SETTINGS = {
        boatName: "Speed Feet 18",
        defaultMainSail: "GV Régate",
        defaultJib: "Foc Régate",
        defaultSpi: "Spi 32",
        defaultCrew: 1,
        safetyContactName: "",
        safetyContactPhone: "",
        closeHauledAngle: 37.5,
        gpsWindThreshold: 0.3,
        windZones: [
            { start: 0, end: 35, color: "#f33441", label: "Zone rouge" },
            { start: 35, end: 170, color: "#18b54c", label: "Zone verte" },
            { start: 170, end: 180, color: "#1688ff", label: "Zone bleue" }
        ]
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

        nextNavigationNotes: loadJSON(
            STORAGE_KEYS.nextNavigationNotes,
            ""
        ),

        boatTasks: loadJSON(
            STORAGE_KEYS.boatTasks,
            []
        ),

        currentPage: "homePage",
        timerId: null,
        gpsWatchId: null,
        confirmAction: null,
        historyMap: null,
        replayMap: null,
        replayBoatMarker: null,
        replayCursorIndex: 0,
        replayNavigationId: null,
        toastTimerId: null
    };

    const GPS_HEADING_MIN_SPEED_KN = 0.3;

    function hasActiveNavigation() {
        return Boolean(
            state.currentNavigation &&
            state.currentNavigation.status !== "completed" &&
            state.currentNavigation.status !== "abandoned"
        );
    }

    function getSettingsReturnPage() {
        // Tant qu’une navigation existe, les paramètres restent un écran
        // temporaire et le retour doit toujours afficher le cadran.
        return hasActiveNavigation() ? "navigationPage" : "homePage";
    }

    function leaveSettingsPage() {
        const returnPage = getSettingsReturnPage();
        showPage(returnPage);

        if (returnPage === "navigationPage") {
            // Le suivi GPS continue pendant l’affichage des paramètres :
            // on ne redémarre pas le watcher, on rafraîchit seulement l’écran.
            updateNavigationDashboard();
        }
    }

    function getWindZones() {
        const source = Array.isArray(state.settings?.windZones) && state.settings.windZones.length
            ? state.settings.windZones
            : DEFAULT_SETTINGS.windZones;
        const cleaned = source.map((zone, index) => ({
            start: clamp(Number(zone.start), 0, 180),
            end: clamp(Number(zone.end), 0, 180),
            color: /^#[0-9a-f]{6}$/i.test(String(zone.color || "")) ? zone.color : DEFAULT_SETTINGS.windZones[index % DEFAULT_SETTINGS.windZones.length].color,
            label: String(zone.label || `Zone ${index + 1}`)
        })).filter(zone => Number.isFinite(zone.start) && Number.isFinite(zone.end) && zone.end > zone.start)
          .sort((a, b) => a.start - b.start);
        return cleaned.length ? cleaned : cloneValue(DEFAULT_SETTINGS.windZones);
    }

    function windZonesGradient() {
        const zones = getWindZones();
        const stops = [];
        const colorAt = angle => {
            const zone = zones.find(item => angle >= item.start && angle <= item.end);
            return zone?.color || "#26394b";
        };
        zones.forEach(zone => stops.push(`${zone.color} ${zone.start}deg ${zone.end}deg`));
        for (const zone of [...zones].reverse()) {
            stops.push(`${zone.color} ${360 - zone.end}deg ${360 - zone.start}deg`);
        }
        return `conic-gradient(from 0deg, ${stops.join(", ")})`;
    }

    function applyWindGaugeZones() {
        const scale = getElement("navCompassScale");
        if (scale) scale.style.setProperty("--wind-zone-gradient", windZonesGradient());
    }

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
            renderHomeNavigationState();
            renderRecentNavigations();
            renderNextNavigationNotes();
            renderBoatTasksHome();
            renderHomeStats();
            renderHomeLearningSummary();
        }

        if (pageId === "preparePage") {
            loadPreparationForm();
        }

        if (pageId === "historyPage") {
            renderHistory();
        }

        if (pageId === "boatTasksPage") {
            renderBoatTasksPage();
        }

        if (pageId === "settingsPage") {
            loadSettingsForm();
        }

        if (pageId === "recordsPage") {
            renderRecords();
        }

        if (pageId === "achievementsPage") {
            renderAchievements();
        }

        if (pageId === "learningPage") {
            renderLearningDashboard();
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
        if (modalCleanupReplay) { modalCleanupReplay(); modalCleanupReplay = null; }
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

            checklistItems: readEditableChecklist(),
            objective: getElement("navigationObjective")?.value || "Entraînement",

            nextNavigationNotes:
                getElement("nextNavigationNotes")
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

        saveNextNavigationNotes(state.preparation.nextNavigationNotes);
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
                navigationNotes: "",
                checklistItems: loadChecklistModel(),
                objective: "Entraînement",
                nextNavigationNotes: state.nextNavigationNotes || ""
            };

        setInputValue(
            "windAverage",
            data.windAverage
        );

        setInputValue(
            "windGust",
            data.windGust
        );

        const preparedDirection = Number.isFinite(Number(data.windDirection))
            ? (Math.round((((Number(data.windDirection) % 360) + 360) % 360) / 22.5) * 22.5) % 360
            : "";

        setInputValue(
            "windDirection",
            preparedDirection
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

        renderEditableChecklist(data.checklistItems);
        setInputValue("navigationObjective", data.objective || "Entraînement");
        updateObjectiveButtons();
        updatePrepareMeta();
        updateNotesCounter();

        setInputValue(
            "nextNavigationNotes",
            data.nextNavigationNotes ?? state.nextNavigationNotes ?? ""
        );
    }

    function saveNextNavigationNotes(value) {
        state.nextNavigationNotes = String(value || "").trim();
        saveJSON(STORAGE_KEYS.nextNavigationNotes, state.nextNavigationNotes);
        renderNextNavigationNotes();
    }

    function renderNextNavigationNotes() {
        const section = getElement("nextNavigationHomeSection");
        const content = getElement("nextNavigationHomeNotes");
        if (!section || !content) return;

        const notes = String(state.nextNavigationNotes || "").trim();
        section.hidden = !notes;
        content.textContent = notes;
    }

    function clearNextNavigationNotes() {
        setInputValue("nextNavigationNotes", "");
        saveNextNavigationNotes("");
        if (state.preparation) {
            state.preparation.nextNavigationNotes = "";
            saveJSON(STORAGE_KEYS.preparation, state.preparation);
        }
    }

    function editNextNavigationNotes() {
        showPage("preparePage");
        window.setTimeout(() => getElement("nextNavigationNotes")?.focus(), 50);
    }


    function normalizeBoatTasks(value) {
        if (!Array.isArray(value)) return [];
        return value.map((item, index) => ({
            id: String(item?.id || `task-${Date.now()}-${index}`),
            text: String(item?.text || "").trim(),
            completed: Boolean(item?.completed),
            createdAt: item?.createdAt || new Date().toISOString()
        })).filter(item => item.text);
    }

    function saveBoatTasks() {
        state.boatTasks = normalizeBoatTasks(state.boatTasks);
        saveJSON(STORAGE_KEYS.boatTasks, state.boatTasks);
        renderBoatTasksHome();
        if (state.currentPage === "boatTasksPage") renderBoatTasksPage();
    }

    function addBoatTask(text, options = {}) {
        const cleanText = String(text || "").trim();
        if (!cleanText) return false;
        const duplicate = state.boatTasks.some(item => item.text.toLocaleLowerCase("fr-FR") === cleanText.toLocaleLowerCase("fr-FR"));
        if (duplicate) {
            if (!options.silent) showToast("Cette tâche existe déjà");
            return false;
        }
        state.boatTasks.push({
            id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            text: cleanText,
            completed: false,
            createdAt: new Date().toISOString()
        });
        saveBoatTasks();
        if (!options.silent) showToast("Tâche ajoutée");
        return true;
    }

    function toggleBoatTask(taskId, completed) {
        const task = state.boatTasks.find(item => item.id === taskId);
        if (!task) return;
        task.completed = Boolean(completed);
        saveBoatTasks();
    }

    function removeBoatTask(taskId) {
        const task = state.boatTasks.find(item => item.id === taskId);
        if (!task) return;
        showConfirmation(
            "Supprimer cette tâche ?",
            task.text,
            () => {
                state.boatTasks = state.boatTasks.filter(item => item.id !== taskId);
                saveBoatTasks();
                showToast("Tâche supprimée");
            }
        );
    }

    function boatTaskRowHTML(task, compact = false) {
        return `
            <label class="boatTaskRow${task.completed ? " completed" : ""}${compact ? " compact" : ""}">
                <input type="checkbox" data-boat-task-toggle="${escapeHTML(task.id)}" ${task.completed ? "checked" : ""}/>
                <span>${escapeHTML(task.text)}</span>
                ${compact ? "" : `<button class="boatTaskDelete" data-boat-task-delete="${escapeHTML(task.id)}" type="button" aria-label="Supprimer la tâche">Supprimer</button>`}
            </label>
        `;
    }

    function renderBoatTasksHome() {
        const list = getElement("homeBoatTasksList");
        if (!list) return;
        state.boatTasks = normalizeBoatTasks(state.boatTasks);
        setText("homeBoatTaskCount", `(${state.boatTasks.length})`);
        const recent = state.boatTasks.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 3);
        list.innerHTML = recent.length
            ? recent.map(task => boatTaskRowHTML(task, true)).join("")
            : `<div class="emptyCard">Aucune tâche pour le moment.</div>`;
    }

    function renderBoatTasksPage() {
        const list = getElement("boatTasksFullList");
        if (!list) return;
        state.boatTasks = normalizeBoatTasks(state.boatTasks);
        const sorted = state.boatTasks.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        list.innerHTML = sorted.length
            ? sorted.map(task => boatTaskRowHTML(task)).join("")
            : `<div class="emptyCard"><strong>Aucune tâche pour le moment.</strong><p>Ajoute ici les contrôles, réparations ou essais à prévoir.</p></div>`;
    }

    function handleBoatTaskListClick(event) {
        const deleteButton = event.target.closest("[data-boat-task-delete]");
        if (deleteButton) {
            event.preventDefault();
            removeBoatTask(deleteButton.dataset.boatTaskDelete);
        }
    }

    function handleBoatTaskListChange(event) {
        const checkbox = event.target.closest("[data-boat-task-toggle]");
        if (!checkbox) return;
        toggleBoatTask(checkbox.dataset.boatTaskToggle, checkbox.checked);
    }

    function submitBoatTask() {
        const input = getElement("boatTaskInput");
        if (!input) return;
        if (addBoatTask(input.value)) {
            input.value = "";
            input.focus();
        }
    }

    function renderHomeNavigationState() {
        const activePanel = getElement("activeNavigationHome");
        const startLabel = getElement("startNavigationLabel");
        const active = hasActiveNavigation();

        if (activePanel) activePanel.hidden = !active;
        if (startLabel) {
            startLabel.textContent = active
                ? "PRÉPARER UNE NAVIGATION"
                : "NOUVELLE NAVIGATION";
        }
    }

    function resumeCurrentNavigation() {
        if (!hasActiveNavigation()) {
            renderHomeNavigationState();
            showToast("Aucune navigation en cours");
            return;
        }
        showPage("navigationPage");
        if (state.timerId === null || state.gpsWatchId === null) {
            startNavigationRuntime();
        }
        updateNavigationDashboard();
    }

    function requestNewPreparation() {
        if (hasActiveNavigation()) {
            openModal("activeNavigationChoiceModal");
            return;
        }
        beginNewPreparation();
    }

    function abandonCurrentNavigationAndPrepare() {
        closeAllModals();
        stopNavigationRuntime();
        state.currentNavigation = null;
        localStorage.removeItem(STORAGE_KEYS.currentNavigation);
        renderHomeNavigationState();
        beginNewPreparation();
    }

    function showToast(message) {
        const toast = getElement("appToast");
        if (!toast) return;
        toast.textContent = message;
        toast.classList.add("visible");
        if (state.toastTimerId !== null) clearTimeout(state.toastTimerId);
        state.toastTimerId = window.setTimeout(() => {
            toast.classList.remove("visible");
            state.toastTimerId = null;
        }, 1800);
    }

    function setInputValue(id, value) {
        const element = getElement(id);

        if (!element) {
            return;
        }

        element.value =
            value ?? "";
    }

    const DEFAULT_CHECKLIST_ITEMS = [
        "SpeedPuck allumé", "Tablette chargée", "Eau", "Gilet", "Spi embarqué", "Caméra", "Vérification des haubans", "Bouchon de nable"
    ];

    function loadChecklistModel() {
        const saved = loadJSON(STORAGE_KEYS.checklistItems, null);
        if (Array.isArray(saved) && saved.length) return saved;
        return DEFAULT_CHECKLIST_ITEMS.map((label, index) => ({ id: `check-${Date.now()}-${index}`, label, checked: false }));
    }

    function beginNewPreparation() {
        const checklistItems = loadChecklistModel().map(item => ({ ...item, checked: false }));
        state.preparation = {
            ...(state.preparation || {}),
            checklistItems,
            updatedAt: new Date().toISOString()
        };
        saveJSON(STORAGE_KEYS.preparation, state.preparation);
        showPage("preparePage");
    }

    function readEditableChecklist() {
        return Array.from(document.querySelectorAll("#editableChecklist .editableChecklistRow")).map((row) => ({
            id: row.dataset.id,
            label: row.querySelector(".checklistLabel")?.textContent.trim() || "Élément",
            checked: Boolean(row.querySelector('input[type="checkbox"]')?.checked)
        }));
    }

    function saveChecklistModel() {
        const items = readEditableChecklist();
        saveJSON(STORAGE_KEYS.checklistItems, items.map(item => ({ ...item, checked: false })));
        savePreparationDraft();
    }

    function renderEditableChecklist(items) {
        const host = getElement("editableChecklist");
        if (!host) return;
        const base = Array.isArray(items) && items.length ? items : loadChecklistModel();
        host.innerHTML = base.map((item, index) => `<div class="editableChecklistRow" data-id="${escapeHTML(item.id || `item-${Date.now()}-${index}`)}">
            <input type="checkbox" ${item.checked ? "checked" : ""} aria-label="Cocher">
            <span class="checklistLabel">${escapeHTML(item.label || "Élément")}</span>
            <button class="editChecklistItem" type="button" aria-label="Modifier">✎</button>
            <button class="deleteChecklistItem" type="button" aria-label="Supprimer">⌫</button>
        </div>`).join("");
    }

    function addChecklistItem() {
        const label = prompt("Nouvel élément de checklist :");
        if (!label?.trim()) return;
        const items = readEditableChecklist();
        items.push({ id: `item-${Date.now()}`, label: label.trim(), checked: false });
        renderEditableChecklist(items);
        saveChecklistModel();
    }

    function handleChecklistClick(event) {
        const row = event.target.closest(".editableChecklistRow");
        if (!row) return;
        if (event.target.closest(".editChecklistItem")) {
            const current = row.querySelector(".checklistLabel")?.textContent || "";
            const label = prompt("Modifier l’élément :", current);
            if (label?.trim()) { row.querySelector(".checklistLabel").textContent = label.trim(); saveChecklistModel(); }
        }
        if (event.target.closest(".deleteChecklistItem")) {
            if (confirm("Supprimer cet élément de la checklist ?")) { row.remove(); saveChecklistModel(); }
        }
    }

    function resetChecklist() {
        renderEditableChecklist(DEFAULT_CHECKLIST_ITEMS.map((label, index) => ({ id: `default-${index}`, label, checked: false })));
        saveChecklistModel();
    }

    function checkAllChecklist() {
        document.querySelectorAll('#editableChecklist input[type="checkbox"]').forEach(input => input.checked = true);
        savePreparationDraft();
    }

    function updatePrepareMeta() {
        const now = new Date();
        setText("prepareBoatName", state.settings.boatName || "Speed Feet 18");
        setText("prepareDate", now.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }));
        setText("prepareTime", now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }));
    }

    function updateObjectiveButtons() {
        const current = getElement("navigationObjective")?.value || "Entraînement";
        document.querySelectorAll("#objectiveChoices button").forEach(button => button.classList.toggle("selected", button.dataset.objective === current));
    }

    function updateNotesCounter() {
        setText("navigationNotesCount", String(getElement("navigationNotes")?.value.length || 0));
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

        saveNextNavigationNotes(preparation.nextNavigationNotes);
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
            gpsStatus: "searching",
            windAxisDirection: null,
            windAxisCalibratedAt: null,
            windAxisTack: null
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

        const headingCanUpdate = Number(point.speedKn) >= GPS_HEADING_MIN_SPEED_KN;
        if (headingCanUpdate && point.heading === null && previousPoint) {
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

        if (headingCanUpdate && point.heading !== null) {
            state.currentNavigation.currentHeading = point.heading;
        } else if (!headingCanUpdate) {
            point.heading = null;
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
        applyWindGaugeZones();
        const target = getPolarTargetSpeed(navigation);
        setText("navSpeed", speed.toFixed(1) + " nd");
        setText("navHeading", Number.isFinite(navigation.currentHeading)
            ? Math.round(navigation.currentHeading).toString().padStart(3, "0") + "°"
            : "---°");
        setText("navTargetSpeed", Number.isFinite(target) ? target.toFixed(1) + " nd" : "— nd");
        const polarPercent = Number.isFinite(target) && target > 0 ? Math.round(speed / target * 100) : null;
        setText("navPolar", polarPercent !== null ? polarPercent + " %" : "— %");
        const targetBar = getElement("targetProgress");
        const polarBar = getElement("polarProgress");
        if (targetBar) targetBar.style.width = `${Math.min(100, polarPercent || 0)}%`;
        if (polarBar) polarBar.style.width = `${Math.min(100, polarPercent || 0)}%`;
        const elapsed = Math.max(0, now.getTime() - new Date(navigation.startedAt).getTime());
        const h = Math.floor(elapsed / 3600000), m = Math.floor(elapsed % 3600000 / 60000), s = Math.floor(elapsed % 60000 / 1000);
        setText("navElapsed", [h,m,s].map(v => String(v).padStart(2,"0")).join(":"));
        const lastWind = navigation.windRecords?.slice(-1)[0];
        const windAxisDirection = Number.isFinite(Number(navigation.windAxisDirection))
            ? Number(navigation.windAxisDirection)
            : Number(lastWind?.direction);
        const needle = getElement("navWindNeedle");
        if (Number.isFinite(windAxisDirection) && Number.isFinite(navigation.currentHeading)) {
            const angle = ((windAxisDirection - navigation.currentHeading + 540) % 360) - 180;
            const side = angle >= 0 ? "TRIBORD" : "BÂBORD";
            setText("navWindAngle", Math.round(Math.abs(angle)) + "°");
            setText("navTack", side);
            if (needle) {
                needle.style.transform = `translate(-50%, -100%) rotate(${angle}deg)`;
                needle.classList.add("active");
            }
        } else {
            setText("navWindAngle", "—°");
            setText("navTack", "VENT NON CALIBRÉ");
            if (needle) {
                needle.style.transform = "translate(-50%, -100%) rotate(0deg)";
                needle.classList.remove("active");
            }
        }
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

        setInputValue("finishRating", "");
        setInputValue("finishNotes", "");
        setInputValue("finishNextNotes", state.nextNavigationNotes || "");
        const safetyCheckbox = getElement("finishSendSafety");
        if (safetyCheckbox) safetyCheckbox.checked = false;
        openModal("finishNavigationModal");
    }

    function finishNavigation() {
        if (!state.currentNavigation) {
            return;
        }

        const achievementsBefore = new Set(getUnlockedAchievements().unlocked.map(item => item.id));
        stopNavigationRuntime();

        state.currentNavigation.status =
            "completed";

        state.currentNavigation.endedAt =
            new Date().toISOString();

        state.currentNavigation.review = {
            rating: toNumberOrNull(getElement("finishRating")?.value),
            notes: getElement("finishNotes")?.value.trim() || "",
            nextNavigationNotes: getElement("finishNextNotes")?.value.trim() || ""
        };

        if (state.currentNavigation.review.nextNavigationNotes) {
            addBoatTask(state.currentNavigation.review.nextNavigationNotes, { silent: true });
        }
        saveNextNavigationNotes("");
        const shouldPrepareSafetyMessage = Boolean(getElement("finishSendSafety")?.checked);
        const completedNavigation = cloneValue(state.currentNavigation);

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

        closeAllModals();
        showPage("historyPage");
        const newlyUnlocked = getUnlockedAchievements().unlocked.filter(item => !achievementsBefore.has(item.id));
        window.setTimeout(() => {
            openNavigationDetails(completedNavigation.id);
            if (newlyUnlocked.length) window.setTimeout(() => showNewAchievements(newlyUnlocked), 350);
        }, 80);

        if (shouldPrepareSafetyMessage) {
            prepareSafetyMessage(completedNavigation);
        }
    }

    let selectedWindAxisTack = "starboard";

    function getCloseHauledAngle() {
        const value = Number(state.settings?.closeHauledAngle);
        return Number.isFinite(value) && value >= 20 && value <= 60 ? value : 37.5;
    }

    function updateWindAxisTackButtons() {
        document.querySelectorAll("#windAxisTackChoices [data-tack]").forEach(button => {
            button.classList.toggle("selected", button.dataset.tack === selectedWindAxisTack);
        });
    }

    function openWindAxisModal() {
        const navigation = state.currentNavigation;
        if (!navigation) return;
        if (Number(navigation.currentSpeedKn || 0) < GPS_HEADING_MIN_SPEED_KN) {
            showToast("Le bateau doit avancer à au moins 0,3 nd pour calibrer le vent.");
            return;
        }
        if (!Number.isFinite(Number(navigation.currentHeading))) {
            showToast("Attends que le GPS fournisse un cap avant de calibrer le vent.");
            return;
        }
        selectedWindAxisTack = navigation.windAxisTack === "port" ? "port" : "starboard";
        setText("windAxisCurrentHeading", Math.round(Number(navigation.currentHeading)).toString().padStart(3, "0") + "°");
        setText("windAxisCloseHauled", getCloseHauledAngle().toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + "°");
        updateWindAxisTackButtons();
        openModal("windAxisModal");
    }

    function saveWindAxisCalibration() {
        const navigation = state.currentNavigation;
        if (!navigation || Number(navigation.currentSpeedKn || 0) < GPS_HEADING_MIN_SPEED_KN) {
            showToast("Le bateau doit avancer à au moins 0,3 nd pour calibrer le vent.");
            return;
        }
        if (!Number.isFinite(Number(navigation.currentHeading))) {
            showToast("Cap GPS indisponible : calibrage impossible.");
            return;
        }
        const closeHauledAngle = getCloseHauledAngle();
        const sign = selectedWindAxisTack === "port" ? -1 : 1;
        navigation.windAxisDirection = (Number(navigation.currentHeading) + sign * closeHauledAngle + 360) % 360;
        navigation.windAxisCalibratedAt = new Date().toISOString();
        navigation.windAxisTack = selectedWindAxisTack;
        saveJSON(STORAGE_KEYS.currentNavigation, navigation);
        closeAllModals();
        updateNavigationDashboard();
        showToast(`Axe du vent recalibré au près (${closeHauledAngle.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}°).`);
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


    const TRIM_RECOMMENDATION_FIELDS = [
        { key: "travelerMain", label: "Chariot de GV", elementId: "trimRecommendationTravelerMain" },
        { key: "travelerJib", label: "Chariot de foc", elementId: "trimRecommendationTravelerJib" },
        { key: "rotation", label: "Rotation du mât", elementId: "trimRecommendationRotation" },
        { key: "cunningham", label: "Cunningham", elementId: "trimRecommendationCunningham" },
        { key: "outhaul", label: "Bordure", elementId: "trimRecommendationOuthaul" },
        { key: "sheet", label: "Écoute de grand-voile", elementId: "trimRecommendationSheet" }
    ];

    function normalizeAngleDifference(a, b) {
        const first = Number(a);
        const second = Number(b);
        if (!Number.isFinite(first) || !Number.isFinite(second)) return null;
        return Math.abs(((first - second + 540) % 360) - 180);
    }

    const TRIM_WIND_BINS = [
        { start: 0, end: 5, key: "0-5", label: "0–5 nds" },
        { start: 5, end: 10, key: "5-10", label: "5–10 nds" },
        { start: 10, end: 15, key: "10-15", label: "10–15 nds" },
        { start: 15, end: 20, key: "15-20", label: "15–20 nds" },
        { start: 20, end: Infinity, key: "20+", label: "20+ nds" }
    ];

    function getWindBin(speed) {
        const value = Number(speed);
        if (!Number.isFinite(value) || value < 0) return null;
        return TRIM_WIND_BINS.find(bin => value >= bin.start && value < bin.end) || TRIM_WIND_BINS[TRIM_WIND_BINS.length - 1];
    }

    function latestWindBefore(navigation, timestampMs) {
        const records = Array.isArray(navigation?.windRecords) ? navigation.windRecords : [];
        let selected = null;
        for (const record of records) {
            const time = new Date(record.timestamp).getTime();
            if (Number.isFinite(time) && time <= timestampMs && (!selected || time > selected.time)) {
                selected = { record, time };
            }
        }
        if (selected) return selected.record;
        const preparedSpeed = Number(navigation?.preparation?.windAverage);
        const preparedDirection = Number(navigation?.preparation?.windDirection);
        if (Number.isFinite(preparedSpeed)) {
            return { speed: preparedSpeed, direction: Number.isFinite(preparedDirection) ? preparedDirection : null, source: "prévision" };
        }
        return null;
    }

    function trackPointsInWindow(track, startMs, endMs) {
        return (Array.isArray(track) ? track : []).filter(point => {
            const time = new Date(point.timestamp).getTime();
            return time >= startMs && time <= endMs && Number.isFinite(Number(point.speedKn));
        });
    }

    function circularAverageDegrees(values) {
        const usable = values.map(Number).filter(Number.isFinite);
        if (!usable.length) return null;
        const x = usable.reduce((sum, angle) => sum + Math.cos(angle * Math.PI / 180), 0);
        const y = usable.reduce((sum, angle) => sum + Math.sin(angle * Math.PI / 180), 0);
        return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    }

    function buildTrimLearningSamples(navigation) {
        const records = Array.isArray(navigation?.trimRecords) ? navigation.trimRecords : [];
        const track = Array.isArray(navigation?.track) ? navigation.track : [];
        const endNavigationMs = new Date(navigation?.endedAt || navigation?.startedAt || 0).getTime();
        const samples = [];
        records.forEach((record, index) => {
            const recordMs = new Date(record.timestamp).getTime();
            if (!Number.isFinite(recordMs)) return;
            const nextMs = records[index + 1] ? new Date(records[index + 1].timestamp).getTime() : endNavigationMs;
            const startMs = recordMs + 120000;
            const endMs = Math.min(Number.isFinite(nextMs) ? nextMs : startMs + 600000, startMs + 600000);
            if (endMs - startMs < 60000) return;
            const points = trackPointsInWindow(track, startMs, endMs);
            if (points.length < 8) return;
            const speedValues = points.map(point => Number(point.speedKn)).filter(value => Number.isFinite(value) && value >= 0.5);
            if (speedValues.length < 8) return;
            const averageSpeed = speedValues.reduce((sum, value) => sum + value, 0) / speedValues.length;
            const averageHeading = circularAverageDegrees(points.map(point => point.heading));
            const midpoint = startMs + (endMs - startMs) / 2;
            const wind = latestWindBefore(navigation, midpoint);
            const windSpeed = Number(wind?.speed);
            const windDirection = Number(wind?.direction);
            const bin = getWindBin(windSpeed);
            if (!bin) return;
            const angle = normalizeAngleDifference(averageHeading, windDirection);
            const closeHauledLimit = getCloseHauledAngle() + 15;
            if (!Number.isFinite(angle) || angle > closeHauledLimit) return;
            samples.push({ navigationId: navigation.id, record, averageSpeed, windSpeed, windDirection, bin, angle, durationSeconds: Math.round((endMs - startMs) / 1000) });
        });
        return samples;
    }

    function getAllTrimLearningSamples() {
        return (Array.isArray(state.history) ? state.history : [])
            .filter(navigation => navigation?.status === "completed")
            .flatMap(buildTrimLearningSamples);
    }

    function summarizeTrimRecommendations(samples, windBinKey) {
        const relevant = samples.filter(sample => sample.bin.key === windBinKey);
        const result = {};
        TRIM_RECOMMENDATION_FIELDS.forEach(field => {
            const groups = new Map();
            relevant.forEach(sample => {
                const value = String(sample.record?.[field.key] ?? "").trim();
                if (!value) return;
                if (!groups.has(value)) groups.set(value, []);
                groups.get(value).push(sample.averageSpeed);
            });
            const candidates = [...groups.entries()].map(([value, speeds]) => ({
                value,
                count: speeds.length,
                averageSpeed: speeds.reduce((sum, speed) => sum + speed, 0) / speeds.length
            })).filter(candidate => candidate.count >= 3)
              .sort((a, b) => b.averageSpeed - a.averageSpeed || b.count - a.count);
            const best = candidates[0] || null;
            result[field.key] = best ? {
                ...best,
                confidence: best.count >= 5 ? "validated" : "trend",
                confidenceLabel: best.count >= 5 ? "Validé" : "Tendance",
                alternatives: candidates.slice(1)
            } : null;
        });
        return result;
    }

    function getCurrentTrimRecommendationContext() {
        const navigation = state.currentNavigation;
        if (!navigation) return null;
        const latestWind = navigation.windRecords?.slice(-1)[0];
        const windSpeed = Number(latestWind?.speed ?? navigation.preparation?.windAverage);
        const windDirection = Number(latestWind?.direction ?? navigation.preparation?.windDirection ?? navigation.windAxisDirection);
        const heading = Number(navigation.currentHeading);
        const bin = getWindBin(windSpeed);
        if (!bin) return { reason: "wind", bin: null };
        const angle = normalizeAngleDifference(heading, windDirection);
        if (!Number.isFinite(angle) || angle > getCloseHauledAngle() + 15) return { reason: "allure", bin, angle };
        return { reason: null, bin, angle, windSpeed };
    }

    function renderTrimRecommendations() {
        const context = getCurrentTrimRecommendationContext();
        const samples = getAllTrimLearningSamples();
        const recommendations = context?.bin ? summarizeTrimRecommendations(samples, context.bin.key) : {};
        TRIM_RECOMMENDATION_FIELDS.forEach(field => {
            const element = getElement(field.elementId);
            if (!element) return;
            if (!context || context.reason === "wind") {
                element.className = "trimRecommendation unavailable";
                element.textContent = "Aucune recommandation fiable";
                return;
            }
            if (context.reason === "allure") {
                element.className = "trimRecommendation unavailable";
                element.textContent = "Recommandations disponibles au près";
                return;
            }
            const recommendation = recommendations[field.key];
            if (!recommendation) {
                element.className = "trimRecommendation unavailable";
                element.textContent = `Aucune recommandation fiable · ${context.bin.label}`;
                return;
            }
            const dot = recommendation.confidence === "validated" ? "🟢" : "🟡";
            element.className = `trimRecommendation ${recommendation.confidence}`;
            element.textContent = `⭐ Recommandé : ${recommendation.value} ${dot}`;
        });
    }

    function createLearnedTrimRecommendationsHTML(navigation) {
        const allSamples = getAllTrimLearningSamples();
        const navigationSamples = buildTrimLearningSamples(navigation);
        const bins = [...new Map(navigationSamples.map(sample => [sample.bin.key, sample.bin])).values()];
        if (!bins.length) return `<p>Aucune période stable au près avec vent exploitable pour cette sortie.</p>`;
        return bins.map(bin => {
            const recommendations = summarizeTrimRecommendations(allSamples, bin.key);
            const rows = TRIM_RECOMMENDATION_FIELDS.map(field => {
                const rec = recommendations[field.key];
                if (!rec) return `<tr><td>${escapeHTML(field.label)}</td><td>—</td><td>Données insuffisantes</td><td>Moins de 3 observations comparables</td></tr>`;
                const explanation = rec.alternatives.length
                    ? `${rec.averageSpeed.toFixed(2)} nd de moyenne · meilleur résultat parmi ${rec.alternatives.length + 1} valeurs comparées`
                    : `${rec.averageSpeed.toFixed(2)} nd de moyenne sur les périodes stables observées`;
                return `<tr><td>${escapeHTML(field.label)}</td><td><strong>${escapeHTML(rec.value)}</strong></td><td>${escapeHTML(rec.confidenceLabel)} (${rec.count} observations)</td><td>${escapeHTML(explanation)}</td></tr>`;
            }).join("");
            return `<div class="trimLearnedBlock"><h4>Au près · vent ${escapeHTML(bin.label)}</h4><div class="tableScroll"><table class="trimRecommendationTable"><thead><tr><th>Réglage</th><th>Conseillé</th><th>Fiabilité</th><th>Pourquoi</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
        }).join("");
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

        renderTrimRecommendations();
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

    const COMPASS_DIRECTIONS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO"];

    function formatCompassDirection(value) {
        const angle = Number(value);
        if (!Number.isFinite(angle)) return "—";
        const normalized = ((angle % 360) + 360) % 360;
        const label = COMPASS_DIRECTIONS[Math.round(normalized / 22.5) % 16];
        return `${label} (${normalized.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}°)`;
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
        showToast(`${MARKER_LABELS[type]} enregistré`);
    }

    function renderWindZonesEditor() {
        const editor = getElement("windZonesEditor");
        if (!editor) return;
        editor.innerHTML = getWindZones().map((zone, index) => `
            <div class="windZoneRow" data-zone-index="${index}">
                <input class="windZoneColor" type="color" value="${escapeHTML(zone.color)}" aria-label="Couleur de la zone ${index + 1}">
                <label><span>Début</span><input class="windZoneStart" type="number" min="0" max="180" step="1" value="${zone.start}"><b>°</b></label>
                <label><span>Fin</span><input class="windZoneEnd" type="number" min="0" max="180" step="1" value="${zone.end}"><b>°</b></label>
                <button class="deleteWindZone" type="button" aria-label="Supprimer cette zone">✕</button>
            </div>`).join("");
        editor.querySelectorAll(".deleteWindZone").forEach(button => button.addEventListener("click", () => {
            const rows = [...editor.querySelectorAll(".windZoneRow")];
            if (rows.length <= 1) { showToast("Il faut conserver au moins une zone."); return; }
            button.closest(".windZoneRow")?.remove();
            applyWindSettingsFromForm();
        }));
    }

    function readWindZonesEditor() {
        const rows = [...document.querySelectorAll("#windZonesEditor .windZoneRow")];
        const zones = rows.map((row, index) => ({
            start: clamp(Number(row.querySelector(".windZoneStart")?.value), 0, 180),
            end: clamp(Number(row.querySelector(".windZoneEnd")?.value), 0, 180),
            color: row.querySelector(".windZoneColor")?.value || DEFAULT_SETTINGS.windZones[index % 3].color,
            label: `Zone ${index + 1}`
        })).filter(zone => Number.isFinite(zone.start) && Number.isFinite(zone.end) && zone.end > zone.start)
          .sort((a, b) => a.start - b.start);
        return zones.length ? zones : cloneValue(DEFAULT_SETTINGS.windZones);
    }

    function addWindZoneEditorRow() {
        const current = readWindZonesEditor();
        const lastEnd = current.length ? current[current.length - 1].end : 0;
        const start = Math.min(179, lastEnd);
        current.push({ start, end: Math.min(180, start + 10), color: "#f5a623", label: `Zone ${current.length + 1}` });
        state.settings.windZones = current;
        renderWindZonesEditor();
        setInputValue("gpsWindThreshold", state.settings.gpsWindThreshold ?? DEFAULT_SETTINGS.gpsWindThreshold);
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

        setInputValue("safetyContactName", state.settings.safetyContactName || "");
        setInputValue("safetyContactPhone", state.settings.safetyContactPhone || "");
        setInputValue("closeHauledAngle", getCloseHauledAngle());
        renderWindZonesEditor();
        setInputValue("gpsWindThreshold", state.settings.gpsWindThreshold ?? DEFAULT_SETTINGS.gpsWindThreshold);

        setText(
            "appVersion",
            APP_VERSION
        );

        const settingsBackButton = getElement("btnSettingsHome");
        if (settingsBackButton) {
            settingsBackButton.textContent =
                getSettingsReturnPage() === "navigationPage"
                    ? "← Navigation"
                    : "← Accueil";
        }

        renderPolarImportStatus();
    }

    function applyWindSettingsFromForm() {
        const editor = getElement("windZonesEditor");
        if (!editor) return;
        state.settings = {
            ...state.settings,
            windZones: readWindZonesEditor(),
            gpsWindThreshold: clamp(toNumberOrNull(getElement("gpsWindThreshold")?.value) || DEFAULT_SETTINGS.gpsWindThreshold, 0.1, 2)
        };
        saveJSON(STORAGE_KEYS.settings, state.settings);
        applyWindGaugeZones();
    }

    function saveSettings() {
        state.settings = {
            ...state.settings,
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
                ),

            safetyContactName: getElement("safetyContactName")?.value.trim() || "",
            safetyContactPhone: getElement("safetyContactPhone")?.value.trim() || "",
            closeHauledAngle: clamp(toNumberOrNull(getElement("closeHauledAngle")?.value) || 37.5, 20, 60),
            gpsWindThreshold: clamp(toNumberOrNull(getElement("gpsWindThreshold")?.value) || DEFAULT_SETTINGS.gpsWindThreshold, 0.1, 2),
            windZones: readWindZonesEditor()
        };

        saveJSON(
            STORAGE_KEYS.settings,
            state.settings
        );

        alert(
            "Paramètres enregistrés."
        );

        leaveSettingsPage();
    }

    function navigationDurationMinutes(navigation) {
        const start = new Date(navigation?.startedAt || 0).getTime();
        const end = new Date(navigation?.endedAt || navigation?.startedAt || 0).getTime();
        return Math.max(0, Math.round((end - start) / 60000));
    }

    function getRecordDefinitions() {
        const completed = state.history.filter(item => item && item.status === "completed");
        const bestBy = (selector, higherIsBetter = true) => completed.reduce((best, item) => {
            const value = selector(item);
            if (!Number.isFinite(value)) return best;
            if (!best || (higherIsBetter ? value > best.value : value < best.value)) return { navigation: item, value };
            return best;
        }, null);
        const bestManeuver = (type, selector, higherIsBetter = true) => {
            let best = null;
            completed.forEach(navigation => getNavigationManeuverAnalyses(navigation).filter(item => item.marker.type === type).forEach(analysis => {
                const value = selector(analysis);
                if (!Number.isFinite(value)) return;
                if (!best || (higherIsBetter ? value > best.value : value < best.value)) best = { navigation, maneuver: analysis, value };
            }));
            return best;
        };
        return [
            { key: "speed", label: "Vitesse maximale", unit: "nd", decimals: 1, record: bestBy(item => Number(item.maxSpeedKn)) },
            { key: "distance", label: "Plus grande distance", unit: "NM", decimals: 1, record: bestBy(item => Number(item.distanceNm)) },
            { key: "duration", label: "Plus longue navigation", unit: "min", decimals: 0, record: bestBy(item => navigationDurationMinutes(item)) },
            { key: "bestTack", label: "Meilleur virement", unit: "/100", decimals: 0, record: bestManeuver("tack", item => item.score) },
            { key: "bestGybe", label: "Meilleur empannage", unit: "/100", decimals: 0, record: bestManeuver("gybe", item => item.score) },
            { key: "lowestLoss", label: "Plus faible perte de vitesse", unit: "nd", decimals: 1, record: (() => { let best=null; completed.forEach(navigation => getNavigationManeuverAnalyses(navigation).forEach(a => { if (Number.isFinite(a.speedLoss) && a.speedLoss >= 0 && (!best || a.speedLoss < best.value)) best={navigation,maneuver:a,value:a.speedLoss}; })); return best; })() },
            { key: "fastestRecovery", label: "Relance la plus rapide", unit: "s", decimals: 0, record: (() => { let best=null; completed.forEach(navigation => getNavigationManeuverAnalyses(navigation).forEach(a => { if (Number.isFinite(a.recoverySeconds) && (!best || a.recoverySeconds < best.value)) best={navigation,maneuver:a,value:a.recoverySeconds}; })); return best; })() }
        ];
    }

    function getAchievementMetrics() {
        const completed = state.history.filter(item => item && item.status === "completed");
        const totalDistance = completed.reduce((sum, item) => sum + (Number(item.distanceNm) || 0), 0);
        const totalMinutes = completed.reduce((sum, item) => sum + navigationDurationMinutes(item), 0);
        const maximumSpeed = completed.reduce((max, item) => Math.max(max, Number(item.maxSpeedKn) || 0), 0);
        const allMarkers = completed.flatMap(item => item.markers || []);
        const tackCount = allMarkers.filter(marker => marker.type === "tack").length;
        const gybeCount = allMarkers.filter(marker => marker.type === "gybe").length;
        const maneuverCount = tackCount + gybeCount;
        const trimCount = completed.reduce((sum, item) => sum + (item.trimRecords || []).length, 0);
        const windCount = completed.reduce((sum, item) => sum + (item.windRecords || []).length, 0);
        const noteCount = completed.filter(item => Boolean(item.review?.notes || item.preparation?.navigationNotes)).length;
        const ratingCount = completed.filter(item => Number.isFinite(Number(item.review?.rating))).length;
        const nextNoteCount = completed.filter(item => Boolean(item.review?.nextNavigationNotes)).length;
        const uniqueDays = new Set(completed.map(item => String(item.startedAt || "").slice(0,10)).filter(Boolean)).size;
        const completeChecklistCount = completed.filter(item => {
            const list = item.preparation?.checklist || [];
            return list.length > 0 && list.every(entry => entry && entry.checked);
        }).length;
        const fullDataCount = completed.filter(item => (item.track || []).length >= 20 && (item.windRecords || []).length && (item.trimRecords || []).length && (item.markers || []).some(m => m.type === "tack") && (item.markers || []).some(m => m.type === "gybe")).length;
        const returnToStartCount = completed.filter(item => {
            const track = item.track || [];
            if (track.length < 2) return false;
            const first = track[0], last = track[track.length - 1];
            return calculateDistanceNm(first.latitude, first.longitude, last.latitude, last.longitude) <= 0.054; // 100 m
        }).length;
        const longSingleMinutes = completed.reduce((max,item)=>Math.max(max,navigationDurationMinutes(item)),0);
        const maxManeuversSingle = completed.reduce((max,item)=>Math.max(max,(item.markers||[]).filter(m=>["tack","gybe"].includes(m.type)).length),0);
        const maxTacksSingle = completed.reduce((max,item)=>Math.max(max,(item.markers||[]).filter(m=>m.type==="tack").length),0);
        const maxGybesSingle = completed.reduce((max,item)=>Math.max(max,(item.markers||[]).filter(m=>m.type==="gybe").length),0);
        const exact18Maneuvers = completed.some(item => (item.markers || []).filter(m => ["tack","gybe"].includes(m.type)).length === 18);
        const exact18Distance = completed.some(item => Math.abs((Number(item.distanceNm)||0)-18) <= .05);
        const fiveTrimSingle = completed.some(item => (item.trimRecords || []).length >= 5);
        const tenMarkersSingle = completed.some(item => (item.markers || []).length >= 10);
        const bothManeuversSingle = completed.some(item => (item.markers||[]).some(m=>m.type==="tack") && (item.markers||[]).some(m=>m.type==="gybe"));
        const ratedFive = completed.some(item => Number(item.review?.rating) === 5);
        return { completed, navigationCount: completed.length, totalDistance, totalMinutes, maximumSpeed, tackCount, gybeCount, maneuverCount, trimCount, windCount, noteCount, ratingCount, nextNoteCount, uniqueDays, completeChecklistCount, fullDataCount, returnToStartCount, longSingleMinutes, maxManeuversSingle, maxTacksSingle, maxGybesSingle, exact18Maneuvers, exact18Distance, fiveTrimSingle, tenMarkersSingle, bothManeuversSingle, ratedFive };
    }

    function getAchievementDefinitions(metrics = getAchievementMetrics()) {
        const A = (id, title, description, category, test, secret = false, phrase = "") => ({ id, title, description, category, unlocked: Boolean(test), secret, phrase });
        const n=metrics.navigationCount, d=metrics.totalDistance, h=metrics.totalMinutes/60;
        return [
            A("nav-1","Première trace","Terminer une première navigation.","Découverte",n>=1,false,"Le carnet de bord est ouvert."),
            A("nav-2","On remet ça","Terminer 2 navigations.","Découverte",n>=2),
            A("nav-3","Le début d’une habitude","Terminer 3 navigations.","Découverte",n>=3),
            A("nav-5","Habitué du bord","Terminer 5 navigations.","Progression",n>=5),
            A("nav-10","Dix sorties au compteur","Terminer 10 navigations.","Progression",n>=10),
            A("nav-15","Régulier","Terminer 15 navigations.","Progression",n>=15),
            A("nav-20","Vingt fois dehors","Terminer 20 navigations.","Progression",n>=20),
            A("nav-25","Quart de centaine","Terminer 25 navigations.","Progression",n>=25),
            A("nav-30","Une vraie saison","Terminer 30 navigations.","Progression",n>=30),
            A("nav-40","Pilier du ponton","Terminer 40 navigations.","Progression",n>=40),
            A("nav-50","Cinquante sorties","Terminer 50 navigations.","Progression",n>=50),
            A("nav-60","Deux saisons bien remplies","Terminer 60 navigations.","Progression",n>=60),

            A("dist-5","Premiers milles","Cumuler 5 NM.","Progression",d>=5),
            A("dist-10","Dix milles","Cumuler 10 NM.","Progression",d>=10),
            A("dist-25","Le tour s’allonge","Cumuler 25 NM.","Progression",d>=25),
            A("dist-50","Cinquante milles","Cumuler 50 NM.","Progression",d>=50),
            A("dist-100","Cap des cent","Cumuler 100 NM.","Progression",d>=100),
            A("dist-150","150 au loch","Cumuler 150 NM.","Progression",d>=150),
            A("dist-250","Quart de mille","Cumuler 250 NM.","Progression",d>=250),
            A("dist-400","Grand tour","Cumuler 400 NM.","Progression",d>=400),
            A("dist-600","Six cents milles","Cumuler 600 NM.","Progression",d>=600),
            A("dist-800","Deux ans au large","Cumuler 800 NM.","Progression",d>=800),

            A("hours-2","Deux heures de mer","Cumuler 2 h de navigation.","Progression",h>=2),
            A("hours-5","La demi-journée cumulée","Cumuler 5 h de navigation.","Progression",h>=5),
            A("hours-10","Dix heures à la barre","Cumuler 10 h de navigation.","Progression",h>=10),
            A("hours-20","Vingt heures dehors","Cumuler 20 h de navigation.","Progression",h>=20),
            A("hours-40","Semaine nautique","Cumuler 40 h de navigation.","Progression",h>=40),
            A("hours-60","Soixante heures","Cumuler 60 h de navigation.","Progression",h>=60),
            A("hours-80","Quatre-vingts heures","Cumuler 80 h de navigation.","Progression",h>=80),
            A("hours-100","Cent heures au compteur","Cumuler 100 h de navigation.","Progression",h>=100),

            A("single-30","Petite sortie propre","Naviguer au moins 30 min sur une sortie.","Découverte",metrics.longSingleMinutes>=30),
            A("single-60","Une heure tout rond","Naviguer au moins 1 h sur une sortie.","Progression",metrics.longSingleMinutes>=60),
            A("single-120","La vraie session","Naviguer au moins 2 h sur une sortie.","Progression",metrics.longSingleMinutes>=120),
            A("single-180","Trois heures à bord","Naviguer au moins 3 h sur une sortie.","Progression",metrics.longSingleMinutes>=180),
            A("single-240","Grande sortie","Naviguer au moins 4 h sur une sortie.","Progression",metrics.longSingleMinutes>=240),

            A("tack-1","Ça vire !","Enregistrer un premier virement.","Manœuvres",metrics.tackCount>=1),
            A("tack-10","Dix virements","Cumuler 10 virements.","Manœuvres",metrics.tackCount>=10),
            A("tack-25","Bord sur bord","Cumuler 25 virements.","Manœuvres",metrics.tackCount>=25),
            A("tack-50","Manœuvrier","Cumuler 50 virements.","Manœuvres",metrics.tackCount>=50),
            A("tack-100","Cent virements","Cumuler 100 virements.","Manœuvres",metrics.tackCount>=100),
            A("tack-200","Virement automatique","Cumuler 200 virements.","Manœuvres",metrics.tackCount>=200),
            A("tack-400","Le roi du près","Cumuler 400 virements.","Manœuvres",metrics.tackCount>=400),
            A("gybe-1","Et maintenant l’empannage","Enregistrer un premier empannage.","Manœuvres",metrics.gybeCount>=1),
            A("gybe-10","Dix empannages","Cumuler 10 empannages.","Manœuvres",metrics.gybeCount>=10),
            A("gybe-25","Sous spi, ça tourne","Cumuler 25 empannages.","Manœuvres",metrics.gybeCount>=25),
            A("gybe-50","Cinquante empannages","Cumuler 50 empannages.","Manœuvres",metrics.gybeCount>=50),
            A("gybe-100","Cent empannages","Cumuler 100 empannages.","Manœuvres",metrics.gybeCount>=100),
            A("gybe-200","Le roi du portant","Cumuler 200 empannages.","Manœuvres",metrics.gybeCount>=200),
            A("maneuver-100","La machine à manœuvres","Cumuler 100 virements et empannages.","Manœuvres",metrics.maneuverCount>=100),
            A("maneuver-300","Trois cents rotations","Cumuler 300 manœuvres.","Manœuvres",metrics.maneuverCount>=300),
            A("single-maneuver-10","Machine à laver","Enregistrer 10 manœuvres sur une sortie.","Fun",metrics.maxManeuversSingle>=10,false,"Ça tourne, mais proprement."),
            A("single-tack-10","Près intensif","Enregistrer 10 virements sur une sortie.","Manœuvres",metrics.maxTacksSingle>=10),
            A("single-gybe-8","Portant intensif","Enregistrer 8 empannages sur une sortie.","Manœuvres",metrics.maxGybesSingle>=8),

            A("wind-1","Le vent est noté","Enregistrer un premier relevé de vent.","Application",metrics.windCount>=1),
            A("wind-10","Petit météorologue","Cumuler 10 relevés de vent.","Application",metrics.windCount>=10),
            A("wind-30","Observateur régulier","Cumuler 30 relevés de vent.","Application",metrics.windCount>=30),
            A("trim-1","Premier réglage","Enregistrer un changement de réglage.","Application",metrics.trimCount>=1),
            A("trim-10","Régleur","Cumuler 10 changements de réglage.","Application",metrics.trimCount>=10),
            A("trim-30","Metteur au point","Cumuler 30 changements de réglage.","Application",metrics.trimCount>=30),
            A("notes-1","Mémoire du bord","Ajouter une note après une sortie.","Application",metrics.noteCount>=1),
            A("notes-10","Carnet bien tenu","Ajouter des notes à 10 sorties.","Application",metrics.noteCount>=10),
            A("ratings-10","Le ressenti compte","Noter 10 navigations.","Application",metrics.ratingCount>=10),
            A("next-5","Toujours un coup d’avance","Ajouter une idée pour la prochaine sortie 5 fois.","Application",metrics.nextNoteCount>=5),
            A("check-5","Tout est vérifié","Terminer complètement 5 checklists.","Application",metrics.completeChecklistCount>=5),
            A("check-20","Maniaque, mais prêt","Terminer complètement 20 checklists.","Fun",metrics.completeChecklistCount>=20,false,"Même la checklist a été vérifiée."),
            A("days-7","Sept jours différents","Utiliser SpeedFeet sur 7 jours de navigation différents.","Application",metrics.uniqueDays>=7),
            A("days-15","Présent au rendez-vous","Naviguer sur 15 jours différents.","Application",metrics.uniqueDays>=15),
            A("days-30","La régularité paie","Naviguer sur 30 jours différents.","Application",metrics.uniqueDays>=30),
            A("full-data","Sortie complète","Enregistrer GPS, vent, réglages, virement et empannage dans une sortie.","Application",metrics.fullDataCount>=1),
            A("full-data-5","Laboratoire flottant","Réaliser 5 sorties complètes.","Application",metrics.fullDataCount>=5),

            A("return-start","Le facteur","Terminer une navigation à moins de 100 m du départ.","Fun",metrics.returnToStartCount>=1,false,"Le courrier est arrivé au bon ponton."),
            A("return-start-10","Toujours à la bonne adresse","Revenir près du départ 10 fois.","Fun",metrics.returnToStartCount>=10),
            A("both-maneuvers","Menu complet","Enregistrer au moins un virement et un empannage sur la même sortie.","Fun",metrics.bothManeuversSingle),
            A("five-trims","Tournevis imaginaire","Enregistrer 5 changements de réglage sur une sortie.","Fun",metrics.fiveTrimSingle,false,"On ne touche plus à rien… jusqu’au prochain réglage."),
            A("ten-markers","Tout est important","Poser 10 marqueurs sur une sortie.","Fun",metrics.tenMarkersSingle),
            A("rating-five","Sortie cinq étoiles","Attribuer la note maximale à une navigation.","Fun",metrics.ratedFive),
            A("speed-5","Ça glisse","Dépasser 5 nd GPS.","Découverte",metrics.maximumSpeed>=5),
            A("speed-7","Bien lancé","Dépasser 7 nd GPS.","Progression",metrics.maximumSpeed>=7),
            A("speed-9","Le bateau se réveille","Dépasser 9 nd GPS.","Progression",metrics.maximumSpeed>=9),
            A("secret-18-maneuvers","Le nombre du bateau","Enregistrer exactement 18 manœuvres sur une sortie.","Fun",metrics.exact18Maneuvers,true,"Le SF18 approuve."),
            A("secret-18-distance","Dix-huit tout rond","Terminer une sortie à 18,00 NM ± 0,05.","Fun",metrics.exact18Distance,true,"Précision de navigateur."),
            A("secret-all-tools","Tableau de bord complet","Débloquer une sortie complète et revenir près du départ.","Fun",metrics.fullDataCount>=1 && metrics.returnToStartCount>=1,true,"Toutes les cases sont cochées."),
        ];
    }

    function getUnlockedAchievements() {
        const definitions = getAchievementDefinitions();
        const unlocked = definitions.filter(item => item.unlocked);
        return {
            unlocked,
            total: definitions.length
        };
    }

    function showNewAchievements(items) {
        if (!items?.length) return;
        let modal=getElement("newAchievementsModal");
        if (!modal) {
            modal=document.createElement("div"); modal.id="newAchievementsModal"; modal.className="modal";
            modal.innerHTML='<div class="modalContent achievementUnlockModal"><h2>🏆 Nouveau succès</h2><div id="newAchievementsList"></div><button type="button" class="primaryButton" id="btnCloseNewAchievements">Continuer</button></div>';
            document.body.appendChild(modal);
            getElement("btnCloseNewAchievements")?.addEventListener("click", closeAllModals);
        }
        const list=getElement("newAchievementsList");
        if (list) list.innerHTML=items.map(item=>`<article class="achievementUnlockItem"><strong>${escapeHTML(item.title)}</strong><p>${escapeHTML(item.phrase || item.description)}</p></article>`).join("");
        openModal("newAchievementsModal");
    }

    function renderHomeStats() {
        const records = getRecordDefinitions().filter(item => item.record);
        const bestSpeed = records.find(item => item.key === "speed");
        setText("homeRecordSummary", bestSpeed ? `${bestSpeed.record.value.toFixed(1)} nd au maximum` : "Aucun record");
        const achievements = getUnlockedAchievements();
        setText("homeAchievementSummary", `${achievements.unlocked.length} découvert${achievements.unlocked.length > 1 ? "s" : ""}`);
        const totalMiles = state.history.reduce((sum, item) => sum + (Number(item.distanceNm) || 0), 0);
        const totalMinutes = state.history.reduce((sum, item) => sum + navigationDurationMinutes(item), 0);
        const topSpeed = state.history.reduce((max, item) => Math.max(max, Number(item.maxSpeedKn) || 0), 0);
        setText("homeTotalTrips", String(state.history.length));
        setText("homeTotalMiles", totalMiles.toFixed(totalMiles >= 100 ? 0 : 1));
        const hours = Math.floor(totalMinutes / 60), minutes = Math.round(totalMinutes % 60);
        setText("homeTotalTime", hours ? `${hours}h ${String(minutes).padStart(2,"0")}` : `${minutes} min`);
        setText("homeTopSpeed", `${topSpeed.toFixed(1)} nd`);
        const preview = getElement("homeAchievementPreview");
        if (preview) preview.innerHTML = achievements.unlocked.length
            ? achievements.unlocked.slice(-3).reverse().map((item, index) => `<div class="achievementPreview"><span class="medal">${index === 0 ? "🏆" : "🏅"}</span><div><strong>${escapeHTML(item.title)}</strong><small>${escapeHTML(item.description)}</small></div></div>`).join("")
            : '<div class="achievementPreview empty">Aucun succès découvert.</div>';
    }

    function renderRecords() {
        const container = getElement("recordsList");
        if (!container) return;
        const records = getRecordDefinitions();
        container.innerHTML = records.map(item => {
            if (!item.record) return `<div class="recordCard emptyRecord"><strong>${item.label}</strong><span>Pas encore de donnée</span></div>`;
            const value = Number(item.record.value).toFixed(item.decimals ?? 0);
            const separator = item.unit === '/100' ? '' : (item.unit ? ' ' : '');
            return `<button class="recordCard" type="button" data-navigation-id="${item.record.navigation.id}"><strong>${item.label}</strong><span>${value}${separator}${item.unit || ''}</span><small>${formatDateTime(item.record.navigation.startedAt)}</small></button>`;
        }).join("");
        container.querySelectorAll("[data-navigation-id]").forEach(button => button.addEventListener("click", () => openNavigationDetails(button.dataset.navigationId)));
    }

    function renderAchievements() {
        const container = getElement("achievementsList");
        if (!container) return;
        const achievements = getUnlockedAchievements();
        const unlockedCount = achievements.unlocked.length;
        const percentage = achievements.total
            ? Math.round((unlockedCount / achievements.total) * 100)
            : 0;

        setText("achievementProgressText", `${unlockedCount} / ${achievements.total} succès débloqués`);
        setText("achievementPercentageText", `${percentage} %`);

        const progressBar = getElement("achievementProgressBar");
        if (progressBar) progressBar.style.width = `${percentage}%`;

        if (!unlockedCount) {
            container.innerHTML = `
                <div class="emptyCard">
                    <strong>Aucun succès débloqué pour le moment.</strong>
                    <p>Continue à naviguer pour découvrir ton premier succès.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = achievements.unlocked
            .slice()
            .reverse()
            .map(item => `
                <article class="achievementCard unlocked">
                    <span class="achievementBadge">🏆</span>
                    <div>
                        <strong>${escapeHTML(item.title)}</strong>
                        <p>${escapeHTML(item.description)}</p>
                        <small>${escapeHTML(item.category)}${item.phrase ? ` · ${escapeHTML(item.phrase)}` : ""}</small>
                    </div>
                </article>
            `)
            .join("");
    }

    function prepareSafetyMessage(navigation) {
        const phone = String(state.settings.safetyContactPhone || "").replace(/\s+/g, "");
        const name = state.settings.safetyContactName || "";
        const duration = navigationDurationMinutes(navigation);
        const message = `Fin de navigation${name ? " pour " + name : ""} : je suis rentré. Sortie de ${duration} min, ${Number(navigation.distanceNm || 0).toFixed(1)} NM. Message envoyé depuis SpeedFeet.`;
        if (!phone) {
            alert(`Aucun numéro de contact de sécurité n’est enregistré.\n\nMessage préparé :\n${message}`);
            return;
        }
        window.location.href = `sms:${encodeURIComponent(phone)}?body=${encodeURIComponent(message)}`;
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
        const changeAnalysis = analyses.length ? analyses.map(item => {
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
        }).join("") : `<p>Aucun changement de réglage comparable.</p>`;
        return `${changeAnalysis}<div class="trimLearnedAnalysis"><h4>Recommandations apprises par plage de vent</h4><p class="smallText">Calculées uniquement au près, par tranches de 5 nds. Une tendance demande 3 observations comparables et une valeur validée en demande 5.</p>${createLearnedTrimRecommendationsHTML(navigation)}</div>`;
    }



    function pointTimeMs(point, fallback) {
        const value = new Date(point?.timestamp).getTime();
        return Number.isFinite(value) ? value : fallback;
    }

    function nearestTrackIndex(track, timestamp) {
        if (!Array.isArray(track) || !track.length) return -1;
        const target = new Date(timestamp).getTime();
        if (!Number.isFinite(target)) return 0;
        let low = 0, high = track.length - 1;
        while (low < high) {
            const mid = Math.floor((low + high) / 2);
            if (pointTimeMs(track[mid], mid) < target) low = mid + 1;
            else high = mid;
        }
        if (low > 0) {
            const before = Math.abs(pointTimeMs(track[low - 1], low - 1) - target);
            const after = Math.abs(pointTimeMs(track[low], low) - target);
            if (before <= after) return low - 1;
        }
        return low;
    }

    function mean(values) {
        const valid = values.filter(Number.isFinite);
        return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
    }

    function circularMean(values) {
        const valid = values.filter(Number.isFinite);
        if (!valid.length) return null;
        const sin = valid.reduce((sum, value) => sum + Math.sin(value * Math.PI / 180), 0);
        const cos = valid.reduce((sum, value) => sum + Math.cos(value * Math.PI / 180), 0);
        return (Math.atan2(sin, cos) * 180 / Math.PI + 360) % 360;
    }

    function getManeuverMaturity(count) {
        if (count < 10) return { key: "learning", label: "Apprentissage", detail: `${count} observation${count > 1 ? "s" : ""}`, confidence: "faible", progress: Math.min(100, count * 10) };
        if (count < 30) return { key: "first", label: "Premières références", detail: `${count} observations`, confidence: "modérée", progress: Math.round((count / 30) * 100) };
        if (count < 100) return { key: "reliable", label: "Références fiables", detail: `${count} observations`, confidence: "élevée", progress: Math.round((count / 100) * 100) };
        return { key: "solid", label: "Références très solides", detail: `${count} observations`, confidence: "très élevée", progress: 100 };
    }

    function rawManeuverAnalysis(navigation, marker) {
        const track = navigation?.track || [];
        const center = nearestTrackIndex(track, marker.timestamp);
        if (center < 0) return { marker, center, durationSeconds: null, entrySpeed: null, exitSpeed: null, minimumSpeed: null, speedLoss: null, rawScore: null };
        const centerTime = pointTimeMs(track[center], center);
        const before = track.filter(point => {
            const t = pointTimeMs(point, 0);
            return t >= centerTime - 20000 && t <= centerTime - 5000;
        });
        const after = track.filter(point => {
            const t = pointTimeMs(point, 0);
            return t >= centerTime + 5000 && t <= centerTime + 25000;
        });
        const window = track.filter(point => Math.abs(pointTimeMs(point, 0) - centerTime) <= 45000);
        const entrySpeed = mean(before.map(point => Number(point.speedKn)));
        const exitSpeed = mean(after.map(point => Number(point.speedKn)));
        const validSpeeds = window.map(point => Number(point.speedKn)).filter(Number.isFinite);
        const minimumSpeed = validSpeeds.length ? Math.min(...validSpeeds) : null;
        const speedLoss = Number.isFinite(entrySpeed) && Number.isFinite(minimumSpeed) ? entrySpeed - minimumSpeed : null;
        const headingBefore = circularMean(before.map(point => Number(point.heading)));
        const headingAfter = circularMean(after.map(point => Number(point.heading)));
        let durationSeconds = null;
        if (Number.isFinite(headingBefore) && Number.isFinite(headingAfter)) {
            const totalTurn = calculateSmallestAngle(headingBefore, headingAfter);
            const startThreshold = Math.max(8, totalTurn * .18);
            let startIndex = center, endIndex = center;
            for (let i = center; i >= 0; i--) {
                const heading = Number(track[i].heading);
                if (!Number.isFinite(heading) || calculateSmallestAngle(heading, headingBefore) <= startThreshold) { startIndex = i; break; }
            }
            for (let i = center; i < track.length; i++) {
                const heading = Number(track[i].heading);
                if (!Number.isFinite(heading) || calculateSmallestAngle(heading, headingAfter) <= startThreshold) { endIndex = i; break; }
            }
            const startTime = pointTimeMs(track[startIndex], startIndex);
            const endTime = pointTimeMs(track[endIndex], endIndex);
            if (endTime >= startTime) durationSeconds = Math.max(1, Math.round((endTime - startTime) / 1000));
        }
        const recoveryThreshold = Number.isFinite(entrySpeed) ? entrySpeed * 0.95 : null;
        let recoverySeconds = null;
        if (Number.isFinite(recoveryThreshold)) {
            for (let i = center; i < track.length; i++) {
                const speed = Number(track[i].speedKn);
                if (Number.isFinite(speed) && speed >= recoveryThreshold) {
                    recoverySeconds = Math.max(0, Math.round((pointTimeMs(track[i], i) - centerTime) / 1000));
                    break;
                }
            }
        }
        const exitRatio = Number.isFinite(entrySpeed) && entrySpeed > 0 && Number.isFinite(exitSpeed) ? exitSpeed / entrySpeed : null;
        const lossRatio = Number.isFinite(entrySpeed) && entrySpeed > 0 && Number.isFinite(speedLoss) ? speedLoss / entrySpeed : null;
        let rawScore = 50;
        if (Number.isFinite(exitRatio)) rawScore += Math.max(-20, Math.min(20, (exitRatio - 0.75) * 80));
        if (Number.isFinite(lossRatio)) rawScore += Math.max(-25, Math.min(20, (0.45 - lossRatio) * 70));
        if (Number.isFinite(durationSeconds)) rawScore += Math.max(-15, Math.min(15, (18 - durationSeconds) * 1.5));
        if (Number.isFinite(recoverySeconds)) rawScore += Math.max(-15, Math.min(15, (18 - recoverySeconds) * 1.2));
        rawScore = Math.round(Math.max(0, Math.min(100, rawScore)));
        return { marker, center, durationSeconds, entrySpeed, exitSpeed, minimumSpeed, speedLoss, headingBefore, headingAfter, recoverySeconds, rawScore };
    }

    function getManeuverReference(type, excludedNavigation, excludedMarker) {
        const analyses = [];
        state.history.filter(item => item && item.status === "completed").forEach(navigation => {
            (navigation.markers || []).filter(marker => marker.type === type).forEach(marker => {
                if (navigation === excludedNavigation && marker === excludedMarker) return;
                const analysis = rawManeuverAnalysis(navigation, marker);
                if (Number.isFinite(analysis.rawScore)) analyses.push(analysis);
            });
        });
        const scores = analyses.map(item => item.rawScore).filter(Number.isFinite).sort((a, b) => a - b);
        return { analyses, scores, count: scores.length, maturity: getManeuverMaturity(scores.length) };
    }

    function percentileScore(value, sortedValues) {
        if (!Number.isFinite(value) || !sortedValues.length) return null;
        const below = sortedValues.filter(item => item < value).length;
        const equal = sortedValues.filter(item => item === value).length;
        const percentile = (below + equal * .5) / sortedValues.length;
        return Math.round(45 + percentile * 55);
    }

    function maneuverAnalysis(navigation, marker) {
        const analysis = rawManeuverAnalysis(navigation, marker);
        const reference = getManeuverReference(marker.type, navigation, marker);
        const personalScore = percentileScore(analysis.rawScore, reference.scores);
        let personalWeight = 0;
        if (reference.count >= 100) personalWeight = .8;
        else if (reference.count >= 30) personalWeight = .6;
        else if (reference.count >= 10) personalWeight = .3;
        const score = Number.isFinite(personalScore)
            ? Math.round(analysis.rawScore * (1 - personalWeight) + personalScore * personalWeight)
            : analysis.rawScore;
        const historicalAverage = reference.scores.length ? mean(reference.scores) : null;
        const comparison = Number.isFinite(historicalAverage) && Number.isFinite(analysis.rawScore)
            ? Math.round(analysis.rawScore - historicalAverage)
            : null;
        return { ...analysis, score, personalScore, referenceCount: reference.count, maturity: reference.maturity, comparison };
    }

    function getNavigationManeuverAnalyses(navigation) {
        return (navigation?.markers || [])
            .filter(marker => ['tack', 'gybe'].includes(marker.type))
            .map(marker => maneuverAnalysis(navigation, marker));
    }

    function getNavigationPerformanceSummary(navigation) {
        const analyses = getNavigationManeuverAnalyses(navigation);
        const scores = analyses.map(item => item.score).filter(Number.isFinite);
        const averageScore = scores.length ? Math.round(mean(scores)) : null;
        const trackSpeeds = (navigation?.track || []).map(point => Number(point.speedKn)).filter(Number.isFinite);
        let regularityScore = null;
        if (trackSpeeds.length >= 5) {
            const avg = mean(trackSpeeds);
            const variance = mean(trackSpeeds.map(value => Math.pow(value - avg, 2)));
            const cv = avg > 0 ? Math.sqrt(variance) / avg : 1;
            regularityScore = Math.round(Math.max(0, Math.min(100, 100 - cv * 90)));
        }
        const navigationScore = Number.isFinite(averageScore) && Number.isFinite(regularityScore)
            ? Math.round(averageScore * 0.7 + regularityScore * 0.3)
            : (Number.isFinite(averageScore) ? averageScore : regularityScore);
        const best = analyses.filter(item => Number.isFinite(item.score)).sort((a,b) => b.score - a.score)[0] || null;
        const recommendations = [];
        const tackCount = state.history.reduce((sum, item) => sum + (item.markers || []).filter(marker => marker.type === 'tack').length, 0);
        const gybeCount = state.history.reduce((sum, item) => sum + (item.markers || []).filter(marker => marker.type === 'gybe').length, 0);
        const tackMaturity = getManeuverMaturity(tackCount);
        const gybeMaturity = getManeuverMaturity(gybeCount);
        if (!analyses.length) recommendations.push('Enregistre des virements et empannages pour obtenir une analyse détaillée.');
        if (tackCount < 10 && gybeCount < 10) recommendations.push(`SpeedFeet apprend encore : ${tackCount} virement${tackCount > 1 ? 's' : ''} et ${gybeCount} empannage${gybeCount > 1 ? 's' : ''} enregistrés.`);
        if (Number.isFinite(averageScore) && averageScore >= 85 && Math.max(tackCount, gybeCount) >= 10) recommendations.push('Manœuvres très régulières par rapport à tes premières références personnelles.');
        if (Number.isFinite(averageScore) && averageScore < 60 && Math.max(tackCount, gybeCount) >= 10) recommendations.push('La priorité est de réduire la perte de vitesse et de relancer plus tôt après la rotation.');
        const avgRecovery = mean(analyses.map(item => item.recoverySeconds));
        if (Number.isFinite(avgRecovery) && avgRecovery > 20) recommendations.push(`Relance moyenne de ${Math.round(avgRecovery)} s : cherche à reprendre 95 % de la vitesse d’entrée plus rapidement.`);
        const avgLoss = mean(analyses.map(item => item.speedLoss));
        if (Number.isFinite(avgLoss) && avgLoss > 1.2) recommendations.push(`Perte moyenne de ${avgLoss.toFixed(1)} nd : travaille une rotation plus fluide et une remise en puissance progressive.`);
        if (!recommendations.length) recommendations.push('Continue à enregistrer des manœuvres pour affiner les comparaisons.');
        return { analyses, averageScore, regularityScore, navigationScore, best, recommendations, tackCount, gybeCount, tackMaturity, gybeMaturity };
    }

    function getLearningStats(type) {
        let recorded = 0;
        let usable = 0;
        state.history
            .filter(navigation => navigation && navigation.status === "completed")
            .forEach(navigation => {
                (navigation.markers || [])
                    .filter(marker => marker.type === type)
                    .forEach(marker => {
                        recorded += 1;
                        const analysis = rawManeuverAnalysis(navigation, marker);
                        if (Number.isFinite(analysis.rawScore)) usable += 1;
                    });
            });
        return { recorded, usable, maturity: getManeuverMaturity(usable) };
    }

    function getNextLearningThreshold(count) {
        if (count < 10) return { threshold: 10, label: "Premières références" };
        if (count < 30) return { threshold: 30, label: "Références fiables" };
        if (count < 100) return { threshold: 100, label: "Références très solides" };
        return null;
    }

    function createLearningCardHTML(type, title) {
        const stats = getLearningStats(type);
        const next = getNextLearningThreshold(stats.usable);
        const remaining = next ? Math.max(0, next.threshold - stats.usable) : 0;
        const nextText = next
            ? `Encore ${remaining} manœuvre${remaining > 1 ? "s" : ""} exploitable${remaining > 1 ? "s" : ""} avant « ${next.label} ».`
            : "Niveau maximal atteint : les références sont très solides.";
        const qualityText = stats.recorded === stats.usable
            ? `${stats.usable} manœuvre${stats.usable > 1 ? "s" : ""} enregistrée${stats.usable > 1 ? "s" : ""} et exploitable${stats.usable > 1 ? "s" : ""}.`
            : `${stats.recorded} enregistrée${stats.recorded > 1 ? "s" : ""}, dont ${stats.usable} exploitable${stats.usable > 1 ? "s" : ""} avec la trace GPS.`;
        return `<article class="learningDashboardCard ${stats.maturity.key}">
            <div class="learningDashboardHeader">
                <div><h2>${escapeHTML(title)}</h2><p>${escapeHTML(stats.maturity.label)} · confiance ${escapeHTML(stats.maturity.confidence)}</p></div>
                <div class="learningCountBadge"><strong>${stats.usable}</strong><small>observations</small></div>
            </div>
            <div class="learningProgressTrack" aria-label="Progression ${escapeHTML(title)}"><span style="width:${stats.maturity.progress}%"></span></div>
            <p class="learningNextStep">${escapeHTML(nextText)}</p>
            <p class="learningDataQuality">${escapeHTML(qualityText)}</p>
        </article>`;
    }

    function createLearnedTrimMatrixHTML() {
        const samples = getAllTrimLearningSamples();
        const recommendationsByBin = Object.fromEntries(
            TRIM_WIND_BINS.map(bin => [bin.key, summarizeTrimRecommendations(samples, bin.key)])
        );
        const rows = TRIM_RECOMMENDATION_FIELDS.map(field => {
            const cells = TRIM_WIND_BINS.map(bin => {
                const recommendation = recommendationsByBin[bin.key]?.[field.key];
                if (!recommendation) {
                    return `<td class="trimLearningEmpty"><strong>—</strong><small>Données insuffisantes</small></td>`;
                }
                const symbol = recommendation.confidence === "validated" ? "🟢" : "🟡";
                return `<td class="trimLearningCell ${recommendation.confidence}"><strong>${escapeHTML(recommendation.value)}</strong><small>${symbol} ${escapeHTML(recommendation.confidenceLabel)} · ${recommendation.count} obs.</small></td>`;
            }).join("");
            return `<tr><th scope="row">${escapeHTML(field.label)}</th>${cells}</tr>`;
        }).join("");
        return `<div class="tableScroll learnedTrimTableScroll"><table class="learnedTrimMatrix"><thead><tr><th scope="col">Réglage</th>${TRIM_WIND_BINS.map(bin => `<th scope="col">${escapeHTML(bin.label)}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>`;
    }

    function renderLearningDashboard() {
        const container = getElement("learningOverview");
        if (container) {
            container.innerHTML = createLearningCardHTML("tack", "Virements") + createLearningCardHTML("gybe", "Empannages");
        }
        const trimContainer = getElement("learnedTrimSettingsTable");
        if (trimContainer) trimContainer.innerHTML = createLearnedTrimMatrixHTML();
    }

    function renderHomeLearningSummary() {
        const element = getElement("homeLearningSummary");
        if (!element) return;
        const tack = getLearningStats("tack");
        const gybe = getLearningStats("gybe");
        const total = tack.usable + gybe.usable;
        element.textContent = total
            ? `${tack.usable} virement${tack.usable > 1 ? "s" : ""} · ${gybe.usable} empannage${gybe.usable > 1 ? "s" : ""}`
            : "Aucune observation exploitable";
    }

    function createPostNavigationOverviewHTML(navigation) {
        const duration=navigationDurationMinutes(navigation);
        const track=(navigation.track||[]);
        const speeds=track.map(p=>Number(p.speedKn)).filter(Number.isFinite);
        const averageSpeed=speeds.length ? mean(speeds) : null;
        const tackCount=(navigation.markers||[]).filter(m=>m.type==="tack").length;
        const gybeCount=(navigation.markers||[]).filter(m=>m.type==="gybe").length;
        const summary=getNavigationPerformanceSummary(navigation);
        const headline=[];
        headline.push(`Sortie de ${duration} min et ${Number(navigation.distanceNm||0).toFixed(1)} NM.`);
        if (Number.isFinite(averageSpeed)) headline.push(`Vitesse moyenne GPS ${averageSpeed.toFixed(1)} nd, maximum ${Number(navigation.maxSpeedKn||0).toFixed(1)} nd.`);
        if (tackCount+gybeCount) headline.push(`${tackCount} virement${tackCount>1?'s':''} et ${gybeCount} empannage${gybeCount>1?'s':''} enregistrés.`);
        else headline.push("Aucune manœuvre marquée : l’analyse reste générale.");
        return `<div class="postNavigationSummaryText"><p>${escapeHTML(headline.join(" "))}</p></div>
        <div class="postNavigationKpis">
          <div><span>Vitesse moyenne</span><strong>${Number.isFinite(averageSpeed)?averageSpeed.toFixed(1):'—'} nd</strong></div>
          <div><span>Vitesse maximale</span><strong>${Number(navigation.maxSpeedKn||0).toFixed(1)} nd</strong></div>
          <div><span>Virements</span><strong>${tackCount}</strong></div>
          <div><span>Empannages</span><strong>${gybeCount}</strong></div>
          <div><span>Score navigation</span><strong>${summary.navigationScore ?? '—'}${Number.isFinite(summary.navigationScore)?'/100':''}</strong></div>
          <div><span>Points GPS</span><strong>${track.length}</strong></div>
        </div>`;
    }

    function createPerformanceSummaryHTML(navigation) {
        const summary = getNavigationPerformanceSummary(navigation);
        return `<div class="performanceSummary">
            <div class="performanceScore"><span>Score navigation</span><strong>${summary.navigationScore ?? '—'}${Number.isFinite(summary.navigationScore) ? '/100' : ''}</strong></div>
            <div class="performanceMiniStats">
                <span>Manœuvres <b>${summary.analyses.length}</b></span>
                <span>Moyenne <b>${summary.averageScore ?? '—'}${Number.isFinite(summary.averageScore) ? '/100' : ''}</b></span>
                <span>Régularité <b>${summary.regularityScore ?? '—'}${Number.isFinite(summary.regularityScore) ? '/100' : ''}</b></span>
            </div>
            <div class="learningStatusGrid">
                <div class="learningStatus ${summary.tackMaturity.key}"><strong>Virements</strong><span>${summary.tackMaturity.label}</span><small>${summary.tackCount} observation${summary.tackCount > 1 ? 's' : ''} · confiance ${summary.tackMaturity.confidence}</small><i><b style="width:${summary.tackMaturity.progress}%"></b></i></div>
                <div class="learningStatus ${summary.gybeMaturity.key}"><strong>Empannages</strong><span>${summary.gybeMaturity.label}</span><small>${summary.gybeCount} observation${summary.gybeCount > 1 ? 's' : ''} · confiance ${summary.gybeMaturity.confidence}</small><i><b style="width:${summary.gybeMaturity.progress}%"></b></i></div>
            </div>
            <div class="performanceAdvice"><strong>Conseils</strong>${summary.recommendations.map(text => `<p>${escapeHTML(text)}</p>`).join('')}</div>
        </div>`;
    }

    function createReplayChartSVG(track, cursorIndex, key, label, unit, maxValue) {
        if (!track.length) return '';
        const width = 760, height = 160, padX = 34, padY = 20;
        const values = track.map(point => Number(point[key]));
        const valid = values.filter(Number.isFinite);
        if (!valid.length) return `<div class="emptyCard">Aucune donnée ${escapeHTML(label.toLowerCase())}.</div>`;
        const min = key === 'speedKn' ? 0 : 0;
        const max = Number.isFinite(maxValue) ? maxValue : Math.max(...valid, min + 1);
        const points = values.map((value, index) => {
            const x = padX + index / Math.max(1, track.length - 1) * (width - padX * 2);
            const normalized = Number.isFinite(value) ? (value - min) / Math.max(.001, max - min) : 0;
            const y = height - padY - Math.max(0, Math.min(1, normalized)) * (height - padY * 2);
            return `${x.toFixed(1)},${y.toFixed(1)}`;
        }).join(' ');
        const cursorX = padX + cursorIndex / Math.max(1, track.length - 1) * (width - padX * 2);
        const current = values[cursorIndex];
        return `<div class="replayChart"><div class="replayChartHeader"><strong>${escapeHTML(label)}</strong><span>${Number.isFinite(current) ? current.toFixed(key === 'speedKn' ? 1 : 0) + ' ' + unit : '—'}</span></div><svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="Graphique ${escapeHTML(label)}"><line x1="${padX}" y1="${height-padY}" x2="${width-padX}" y2="${height-padY}" class="chartAxis"/><polyline points="${points}" class="chartLine"/><line x1="${cursorX}" y1="${padY}" x2="${cursorX}" y2="${height-padY}" class="chartCursor"/></svg></div>`;
    }

    function createReplayHTML(navigation) {
        const track = navigation?.track || [];
        if (track.length < 2) return `<div class="emptyCard">Aucune trace GPS exploitable pour la relecture.</div>`;
        const maneuvers = (navigation.markers || []).filter(marker => ['tack','gybe'].includes(marker.type));
        return `<div class="replayWorkspace">
            <div id="replayMap" class="historySatelliteMap replayMap" aria-label="Relecture synchronisée de la trace"></div>
            <div class="replayControls">
                <button type="button" id="btnReplayPlay" class="secondaryButton compactButton">▶ Lire</button>
                <input id="replaySlider" type="range" min="0" max="${track.length-1}" value="0" step="1" aria-label="Position dans la navigation">
                <strong id="replayTime">00:00</strong>
            </div>
            <div id="replayLiveStats" class="replayLiveStats"></div>
            <div id="replayCharts"></div>
            <div class="maneuverAnalysisPanel"><h4>Manœuvres détectées / enregistrées</h4><div id="replayManeuverList">${maneuvers.length ? '' : '<p>Aucun virement ou empannage enregistré.</p>'}</div></div>
        </div>`;
    }

    function initializeReplay(navigation) {
        const track = navigation?.track || [];
        const container = getElement('replayMap');
        const slider = getElement('replaySlider');
        if (!container || !slider || track.length < 2 || typeof L === 'undefined') return;
        if (state.replayMap) state.replayMap.remove();
        state.replayNavigationId = navigation.id;
        state.replayCursorIndex = 0;
        const map = L.map(container, { zoomControl: true });
        state.replayMap = map;
        L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Tiles © Esri' }).addTo(map);
        const latlngs = track.map(point => [point.latitude, point.longitude]);
        L.polyline(latlngs, { color: '#42a5ff', weight: 5, opacity: .9 }).addTo(map);
        state.replayBoatMarker = L.circleMarker(latlngs[0], { radius: 9, color: '#fff', weight: 3, fillColor: '#12b76a', fillOpacity: 1 }).addTo(map).bindTooltip('Bateau', { permanent: false });
        (navigation.markers || []).filter(marker => marker.position).forEach((marker, markerIndex) => {
            const analysis = ['tack','gybe'].includes(marker.type) ? maneuverAnalysis(navigation, marker) : null;
            const popup = analysis ? `<strong>${escapeHTML(MARKER_LABELS[marker.type])}</strong><br>${analysis.durationSeconds ?? '—'} s · entrée ${analysis.entrySpeed?.toFixed(1) ?? '—'} nd · sortie ${analysis.exitSpeed?.toFixed(1) ?? '—'} nd` : `<strong>${escapeHTML(MARKER_LABELS[marker.type] || marker.name || 'Marqueur')}</strong>`;
            const dot = L.circleMarker([marker.position.latitude, marker.position.longitude], { radius: 7, color: '#fff', weight: 2, fillColor: marker.type === 'tack' ? '#2e90fa' : marker.type === 'gybe' ? '#f79009' : '#fdb022', fillOpacity: 1 }).addTo(map).bindPopup(popup);
            dot.on('click', () => setReplayIndex(navigation, nearestTrackIndex(track, marker.timestamp)));
        });
        map.fitBounds(L.latLngBounds(latlngs), { padding: [24,24], maxZoom: 17 });
        slider.addEventListener('input', () => setReplayIndex(navigation, Number(slider.value)));
        let playTimer = null;
        const playButton = getElement('btnReplayPlay');
        playButton?.addEventListener('click', () => {
            if (playTimer) { clearInterval(playTimer); playTimer = null; playButton.textContent = '▶ Lire'; return; }
            playButton.textContent = '⏸ Pause';
            playTimer = setInterval(() => {
                let next = Number(slider.value) + Math.max(1, Math.round(track.length / 600));
                if (next >= track.length) { next = 0; }
                slider.value = String(next); setReplayIndex(navigation, next);
            }, 120);
        });
        modalCleanupReplay = () => { if (playTimer) clearInterval(playTimer); };
        renderReplayManeuvers(navigation);
        setReplayIndex(navigation, 0);
        setTimeout(() => map.invalidateSize(), 80);
    }

    let modalCleanupReplay = null;

    function setReplayIndex(navigation, requestedIndex) {
        const track = navigation?.track || [];
        if (!track.length) return;
        const index = Math.max(0, Math.min(track.length - 1, Math.round(requestedIndex || 0)));
        state.replayCursorIndex = index;
        const slider = getElement('replaySlider'); if (slider) slider.value = String(index);
        const point = track[index];
        if (state.replayBoatMarker && Number.isFinite(point.latitude) && Number.isFinite(point.longitude)) state.replayBoatMarker.setLatLng([point.latitude, point.longitude]);
        const start = pointTimeMs(track[0], 0), now = pointTimeMs(point, index);
        setText('replayTime', formatDuration(Math.max(0, now - start)));
        const stats = getElement('replayLiveStats');
        if (stats) stats.innerHTML = `<div><span>Vitesse</span><strong>${Number.isFinite(Number(point.speedKn)) ? Number(point.speedKn).toFixed(1) : '—'} nd</strong></div><div><span>Cap</span><strong>${Number.isFinite(Number(point.heading)) ? Math.round(Number(point.heading)).toString().padStart(3,'0') : '—'}°</strong></div><div><span>Heure</span><strong>${new Date(point.timestamp).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</strong></div>`;
        const charts = getElement('replayCharts');
        if (charts) charts.innerHTML = createReplayChartSVG(track,index,'speedKn','Vitesse','nd') + createReplayChartSVG(track,index,'heading','Cap','°',360);
        document.querySelectorAll('.maneuverReplayCard').forEach(card => card.classList.toggle('active', Math.abs(Number(card.dataset.trackIndex)-index) <= Math.max(2, track.length/200)));
    }

    function renderReplayManeuvers(navigation) {
        const container = getElement('replayManeuverList');
        if (!container) return;
        const maneuvers = (navigation.markers || []).filter(marker => ['tack','gybe'].includes(marker.type));
        container.innerHTML = maneuvers.map((marker, index) => {
            const a = maneuverAnalysis(navigation, marker);
            return `<article class="maneuverReplayCard" data-marker-index="${index}" data-track-index="${a.center}"><button type="button" class="maneuverReplayJump"><strong>${escapeHTML(MARKER_LABELS[marker.type])}</strong><span>${escapeHTML(formatDateTime(marker.timestamp))}</span><em class="maneuverScore">${a.score}/100</em></button><div class="maneuverLearningLine"><span>${escapeHTML(a.maturity.label)}</span><small>${a.referenceCount} référence${a.referenceCount > 1 ? 's' : ''}${Number.isFinite(a.comparison) ? ` · ${a.comparison >= 0 ? '+' : ''}${a.comparison} pt vs moyenne` : ''}</small></div><div class="maneuverMetrics"><span>Durée <b>${a.durationSeconds ?? '—'} s</b></span><span>Entrée <b>${a.entrySpeed?.toFixed(1) ?? '—'} nd</b></span><span>Mini <b>${a.minimumSpeed?.toFixed(1) ?? '—'} nd</b></span><span>Sortie <b>${a.exitSpeed?.toFixed(1) ?? '—'} nd</b></span><span>Perte <b>${a.speedLoss?.toFixed(1) ?? '—'} nd</b></span><span>Relance <b>${a.recoverySeconds ?? '—'} s</b></span></div><label>Note<textarea rows="2" class="maneuverNote" placeholder="Conditions, qualité, réglage…">${escapeHTML(marker.note || '')}</textarea></label><button type="button" class="secondaryButton compactButton saveManeuverNote">Enregistrer la note</button></article>`;
        }).join('') || '<p>Aucun virement ou empannage enregistré.</p>';
        container.querySelectorAll('.maneuverReplayCard').forEach(card => {
            const markerIndex = Number(card.dataset.markerIndex);
            const marker = maneuvers[markerIndex];
            card.querySelector('.maneuverReplayJump')?.addEventListener('click', () => setReplayIndex(navigation, Number(card.dataset.trackIndex)));
            card.querySelector('.saveManeuverNote')?.addEventListener('click', () => {
                marker.note = card.querySelector('.maneuverNote')?.value.trim() || '';
                saveJSON(STORAGE_KEYS.history, state.history);
                showToast('Note de manœuvre enregistrée');
            });
        });
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

            <section class="historyDetailSection postNavigationOverview">
                <h3>Bilan de la navigation</h3>
                ${createPostNavigationOverviewHTML(navigation)}
            </section>

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
                    ${formatCompassDirection(preparation.windDirection)}
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
                <h3>Score et recommandations</h3>
                ${createPerformanceSummaryHTML(navigation)}
            </section>

            <section class="historyDetailSection">
                <h3>Analyse des réglages</h3>
                ${createTrimAnalysisHTML(navigation)}
            </section>

            <section class="historyDetailSection">
                <h3>Relecture synchronisée</h3>
                <p class="smallText">Déplace le curseur pour suivre le bateau sur la carte et lire la vitesse et le cap au même instant.</p>
                ${createReplayHTML(navigation)}
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
        window.setTimeout(() => initializeReplay(navigation), 50);
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

        // Ferme la fiche historique qui pourrait masquer la confirmation.
        closeAllModals();
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

    function normalizePolarPoint(point) {
        if (!point || typeof point !== "object") return null;

        const windSpeed = Number(
            point.windSpeed ?? point.tws ?? point.wind ?? point.trueWindSpeed ?? point.TWS
        );
        const angle = Number(
            point.angle ?? point.twa ?? point.trueWindAngle ?? point.TWA
        );
        const speed = Number(
            point.speed ?? point.bsp ?? point.boatSpeed ?? point.target ?? point.BSP
        );

        if (![windSpeed, angle, speed].every(Number.isFinite)) return null;

        return {
            windSpeed,
            angle,
            speed,
            sailPlan: point.sailPlan ?? point.sail_plan ?? null
        };
    }

    function parsePolarJSON(text) {
        const parsed = JSON.parse(text);
        let rawPoints = [];

        if (Array.isArray(parsed)) {
            rawPoints = parsed;
        } else if (Array.isArray(parsed?.points)) {
            rawPoints = parsed.points;
        } else if (Array.isArray(parsed?.polarData)) {
            rawPoints = parsed.polarData;
        }

        const points = rawPoints
            .map(normalizePolarPoint)
            .filter(Boolean);

        if (!points.length) {
            throw new Error("Aucun point de polaire reconnu dans le JSON.");
        }

        return {
            points,
            metadata: {
                name: parsed?.name || parsed?.title || "Polaire importée",
                boat: parsed?.boat || state.settings.boatName || "Speed Feet 18",
                format: parsed?.format || "json",
                formatVersion: parsed?.formatVersion ?? parsed?.version ?? null,
                sourceDescription: parsed?.source?.description || null
            }
        };
    }

    function parsePolarTable(text) {
        const lines = text
            .replace(/^\uFEFF/, "")
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(Boolean);

        if (lines.length < 2) return [];

        const firstLine = lines[0];
        const separator = firstLine.includes(";")
            ? ";"
            : firstLine.includes("\t")
                ? "\t"
                : ",";

        const cells = lines.map(line =>
            line.split(separator).map(value => value.trim().replace(/^"|"$/g, ""))
        );
        const number = value => Number(String(value).trim().replace(",", "."));
        const normalizeHeader = value => String(value)
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]/g, "");
        const header = cells[0].map(normalizeHeader);

        const windIndex = header.findIndex(value =>
            ["wind", "tws", "vent", "windspeed", "truewindspeed"].some(name => value.includes(name))
        );
        const angleIndex = header.findIndex(value =>
            ["angle", "twa", "allure", "truewindangle"].some(name => value.includes(name))
        );
        const speedIndex = header.findIndex(value =>
            ["speed", "bsp", "boatspeed", "target", "vitesse"].some(name => value.includes(name))
        );
        const sailPlanIndex = header.findIndex(value =>
            ["sailplan", "voiles", "configuration"].some(name => value.includes(name))
        );

        if (windIndex >= 0 && angleIndex >= 0 && speedIndex >= 0) {
            return cells.slice(1)
                .map(row => normalizePolarPoint({
                    windSpeed: number(row[windIndex]),
                    angle: number(row[angleIndex]),
                    speed: number(row[speedIndex]),
                    sailPlan: sailPlanIndex >= 0 ? row[sailPlanIndex] : null
                }))
                .filter(Boolean);
        }

        const angles = cells[0].slice(1).map(number);
        const result = [];
        cells.slice(1).forEach(row => {
            const windSpeed = number(row[0]);
            row.slice(1).forEach((value, index) => {
                const point = normalizePolarPoint({
                    windSpeed,
                    angle: angles[index],
                    speed: number(value)
                });
                if (point) result.push(point);
            });
        });
        return result;
    }

    function parsePolarFileContent(text, fileName = "") {
        const trimmed = text.trim();
        const looksLikeJSON = fileName.toLowerCase().endsWith(".json") ||
            trimmed.startsWith("{") || trimmed.startsWith("[");

        if (looksLikeJSON) return parsePolarJSON(trimmed);

        const points = parsePolarTable(trimmed);
        if (!points.length) {
            throw new Error("Aucun point de polaire reconnu dans le tableau.");
        }

        return {
            points,
            metadata: {
                name: fileName.replace(/\.[^.]+$/, "") || "Polaire importée",
                boat: state.settings.boatName || "Speed Feet 18",
                format: "table",
                formatVersion: null,
                sourceDescription: null
            }
        };
    }

    function formatPolarImportDate(value) {
        if (!value) return "Date inconnue";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "Date inconnue";
        return date.toLocaleString("fr-FR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    function renderPolarImportStatus() {
        const points = Array.isArray(state.settings.polarData)
            ? state.settings.polarData.length
            : 0;

        if (!state.settings.polarFileName || !points) {
            setText("polarImportStatus", "Aucune polaire importée.");
            const button = getElement("btnImportPolar");
            if (button) button.textContent = "Importer une polaire";
            return;
        }

        const metadata = state.settings.polarMetadata || {};
        const version = metadata.formatVersion != null
            ? `Version ${metadata.formatVersion}`
            : metadata.format === "speedfeet-polar"
                ? "Format SpeedFeet Polar"
                : "Format CSV/TXT";

        setText(
            "polarImportStatus",
            `Polaire importée\n${metadata.name || state.settings.polarFileName}\nBateau : ${metadata.boat || state.settings.boatName || "Speed Feet 18"}\n${version}\n${points} points\nImportée le ${formatPolarImportDate(state.settings.polarImportedAt)}`
        );

        const button = getElement("btnImportPolar");
        if (button) button.textContent = "Remplacer la polaire";
    }

    function importPolarFile() {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json,.csv,.txt,application/json,text/csv,text/plain";
        input.addEventListener("change", async () => {
            const file = input.files?.[0];
            if (!file) return;

            try {
                const result = parsePolarFileContent(await file.text(), file.name);
                state.settings.polarData = result.points;
                state.settings.polarFileName = file.name;
                state.settings.polarMetadata = result.metadata;
                state.settings.polarImportedAt = new Date().toISOString();

                if (!saveJSON(STORAGE_KEYS.settings, state.settings)) return;

                renderPolarImportStatus();
                alert(`Polaire importée : ${result.points.length} points.`);
            } catch (error) {
                console.error(error);
                alert("La polaire n’a pas été reconnue. Utilisez le JSON SpeedFeet Polar ou un CSV/TXT contenant TWS, TWA et BSP.");
            }
        });
        input.click();
    }


    function buildBackup() {
        return {
            format: "speedfeet-analyzer-backup",
            formatVersion: 1,
            appVersion: APP_VERSION,
            exportedAt: new Date().toISOString(),
            data: {
                settings: cloneValue(state.settings),
                preparation: cloneValue(state.preparation),
                currentNavigation: cloneValue(state.currentNavigation),
                history: cloneValue(state.history),
                boatTasks: cloneValue(state.boatTasks)
            }
        };
    }

    function exportAllData() {
        try {
            const backup = buildBackup();
            const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            const date = new Date().toISOString().slice(0, 10);
            link.href = url;
            link.download = `SpeedFeet_Analyzer_sauvegarde_${date}.json`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            setText("backupStatus", `${state.history.length} navigation(s) exportée(s) le ${new Date().toLocaleString("fr-FR")}.`);
        } catch (error) {
            console.error(error);
            alert("L’export des données a échoué.");
        }
    }

    function validateBackup(parsed) {
        if (!parsed || parsed.format !== "speedfeet-analyzer-backup" || parsed.formatVersion !== 1 || !parsed.data) {
            throw new Error("Format de sauvegarde non reconnu.");
        }
        if (!Array.isArray(parsed.data.history)) {
            throw new Error("Historique absent ou invalide.");
        }
        if (!parsed.data.settings || typeof parsed.data.settings !== "object") {
            throw new Error("Paramètres absents ou invalides.");
        }
        return parsed.data;
    }

    function applyImportedBackup(data) {
        const importedSettings = { ...DEFAULT_SETTINGS, ...data.settings };
        const importedPreparation = data.preparation ?? null;
        const importedCurrentNavigation = data.currentNavigation ?? null;
        const importedHistory = data.history;
        const importedBoatTasks = normalizeBoatTasks(data.boatTasks || []);

        if (!saveJSON(STORAGE_KEYS.settings, importedSettings)) return;
        if (!saveJSON(STORAGE_KEYS.history, importedHistory)) return;
        if (!saveJSON(STORAGE_KEYS.boatTasks, importedBoatTasks)) return;

        if (importedPreparation === null) localStorage.removeItem(STORAGE_KEYS.preparation);
        else if (!saveJSON(STORAGE_KEYS.preparation, importedPreparation)) return;

        if (importedCurrentNavigation === null) localStorage.removeItem(STORAGE_KEYS.currentNavigation);
        else if (!saveJSON(STORAGE_KEYS.currentNavigation, importedCurrentNavigation)) return;

        alert(`${importedHistory.length} navigation(s) importée(s). L’application va se recharger.`);
        window.location.reload();
    }

    function importAllData() {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json,application/json";
        input.addEventListener("change", async () => {
            const file = input.files?.[0];
            if (!file) return;
            try {
                const parsed = JSON.parse(await file.text());
                const data = validateBackup(parsed);
                showConfirmation(
                    "Importer cette sauvegarde ?",
                    `Elle contient ${data.history.length} navigation(s). Toutes les données présentes sur cet appareil seront remplacées, y compris les paramètres, la polaire et une éventuelle navigation en cours.`,
                    () => applyImportedBackup(data)
                );
            } catch (error) {
                console.error(error);
                alert("Cette sauvegarde SpeedFeet Analyzer n’a pas été reconnue.");
            }
        });
        input.click();
    }

    function bindButtons() {
bindClick(
            "btnStartNavigation",
            requestNewPreparation
        );
        bindClick("btnResumeNavigation", resumeCurrentNavigation);
        bindClick("btnResumeFromChoice", () => { closeAllModals(); resumeCurrentNavigation(); });
        bindClick("btnAbandonAndPrepare", abandonCurrentNavigationAndPrepare);
        bindClick("btnCancelActiveNavigationChoice", closeAllModals);

        bindClick(
            "btnHistory",
            () =>
                showPage(
                    "historyPage"
                )
        );

        bindClick("btnRecords", () => showPage("recordsPage"));
        bindClick("btnAchievements", () => showPage("achievementsPage"));
        bindClick("btnBoatTasks", () => showPage("boatTasksPage"));
        bindClick("btnBoatTasksHome", () => showPage("homePage"));
        bindClick("btnAddBoatTask", submitBoatTask);
        getElement("boatTaskInput")?.addEventListener("keydown", event => {
            if (event.key === "Enter") { event.preventDefault(); submitBoatTask(); }
        });
        getElement("homeBoatTasksList")?.addEventListener("change", handleBoatTaskListChange);
        getElement("boatTasksFullList")?.addEventListener("change", handleBoatTaskListChange);
        getElement("boatTasksFullList")?.addEventListener("click", handleBoatTaskListClick);
        bindClick("btnLearning", () => showPage("learningPage"));
        bindClick("btnHistoryQuick", () => showPage("historyPage"));
        bindClick("btnRecordsSummary", () => showPage("recordsPage"));
        bindClick("btnLearningSummary", () => showPage("learningPage"));
        bindClick("btnRecordsHome", () => showPage("homePage"));
        bindClick("btnAchievementsHome", () => showPage("homePage"));
        bindClick("btnLearningHome", () => showPage("homePage"));

        bindClick(
            "btnSettings",
            () => {
                showPage("settingsPage");
            }
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
            leaveSettingsPage
        );

        bindClick("btnCancelPreparation", () => showPage("homePage"));
        bindClick("btnAddChecklistItem", addChecklistItem);
        getElement("editableChecklist")?.addEventListener("click", handleChecklistClick);
        getElement("editableChecklist")?.addEventListener("change", savePreparationDraft);
        getElement("navigationNotes")?.addEventListener("input", () => { updateNotesCounter(); savePreparationDraft(); });
        document.querySelectorAll("#objectiveChoices button").forEach(button => button.addEventListener("click", () => {
            setInputValue("navigationObjective", button.dataset.objective || "Entraînement"); updateObjectiveButtons(); savePreparationDraft();
        }));

        bindClick(
            "btnStartPreparedNavigation",
            startPreparedNavigation
        );

        bindClick(
            "btnSaveSettings",
            saveSettings
        );
        bindClick("btnAddWindZone", () => { addWindZoneEditorRow(); applyWindSettingsFromForm(); });
        getElement("windZonesEditor")?.addEventListener("input", applyWindSettingsFromForm);
        getElement("windZonesEditor")?.addEventListener("change", applyWindSettingsFromForm);
        getElement("gpsWindThreshold")?.addEventListener("input", applyWindSettingsFromForm);

        bindClick(
            "btnWind",
            openWindModal
        );
        document.querySelectorAll("#windAxisTackChoices [data-tack]").forEach(button => button.addEventListener("click", () => {
            selectedWindAxisTack = button.dataset.tack === "port" ? "port" : "starboard";
            updateWindAxisTackButtons();
        }));
        bindClick("btnCancelWindAxis", closeAllModals);
        bindClick("btnSaveWindAxis", saveWindAxisCalibration);

        bindClick(
            "btnTrim",
            openTrimModal
        );

        bindClick(
            "btnMarker",
            addMarker
        );
        bindClick("btnSpiDown", () => saveTypedMarker("spi-drop"));
        bindClick("btnSpiUp", () => saveTypedMarker("spi-hoist"));

        bindClick("btnQuickTack", () => saveTypedMarker("tack"));
        bindClick("btnQuickGybe", () => saveTypedMarker("gybe"));
        bindClick("btnClearNextNavigationNotes", clearNextNavigationNotes);
        bindClick("btnEditNextNavigationNotes", editNextNavigationNotes);

        const refreshGPSNow = () => {
            if (!state.currentNavigation || !("geolocation" in navigator)) return;
            updateGPSIndicator("searching");
            showToast("Actualisation GPS…");
            navigator.geolocation.getCurrentPosition(
                position => { handleGPSPosition(position); updateNavigationDashboard(); showToast("Vitesse GPS actualisée"); },
                error => { handleGPSError(error); showToast("Actualisation GPS impossible"); },
                { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 }
            );
        };
        bindClick("navSpeedRefresh", refreshGPSNow);
        bindClick("navWindRefresh", openWindAxisModal);
        const bindKeyboardRefresh = (id, callback) => {
            const el = getElement(id);
            if (!el) return;
            el.addEventListener("keydown", event => {
                if (event.key === "Enter" || event.key === " ") { event.preventDefault(); callback(); }
            });
        };
        bindKeyboardRefresh("navSpeedRefresh", refreshGPSNow);
        bindKeyboardRefresh("navWindRefresh", openWindAxisModal);

        bindClick("btnNavigationMenu", () => openModal("navigationOptionsModal"));
        bindClick("btnCloseNavigationMenu", closeAllModals);
        bindClick("btnBoatSettingsFromNavigation", () => {
            closeAllModals();
            showPage("settingsPage");
        });
        bindClick(
            "btnStopNavigation",
            () => { closeAllModals(); askToStopNavigation(); }
        );

        bindClick("btnCancelFinish", closeAllModals);
        bindClick("btnConfirmFinish", finishNavigation);

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

        bindClick(
            "btnExportBackup",
            exportAllData
        );

        bindClick(
            "btnImportBackup",
            importAllData
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

        renderHomeNavigationState();
        renderRecentNavigations();
        if (state.nextNavigationNotes) {
            addBoatTask(state.nextNavigationNotes, { silent: true });
            saveNextNavigationNotes("");
        }
        renderNextNavigationNotes();
        renderBoatTasksHome();
        renderHomeStats();

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
