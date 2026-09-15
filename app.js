const API_BASE = window.location.origin;

let map = null;
let stormLayers = [];
let aiLocationLayer = null;
let selectedFile = null;


/* =========================================================
   HELPERS
========================================================= */

function $(id) {
    return document.getElementById(id);
}

function safeNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function showError(message) {
    const box = $("analysisError");

    if (!box) {
        console.error(message);
        return;
    }

    box.textContent = message;
    box.classList.remove("hidden");
}

function clearError() {
    const box = $("analysisError");

    if (box) {
        box.textContent = "";
        box.classList.add("hidden");
    }
}


/* =========================================================
   IMAGE UPLOAD
========================================================= */

const imageInput = $("imageInput");
const dropZone = $("dropZone");
const chooseBtn = $("chooseBtn");
const changeBtn = $("changeBtn");
const analyzeBtn = $("analyzeBtn");
const analyzeBtnPreview = $("analyzeBtnPreview");

if (chooseBtn) {
    chooseBtn.addEventListener("click", () => {
        imageInput.click();
    });
}

if (changeBtn) {
    changeBtn.addEventListener("click", () => {
        imageInput.click();
    });
}

if (imageInput) {
    imageInput.addEventListener("change", (event) => {
        const file = event.target.files?.[0];

        if (file) {
            setSelectedFile(file);
        }
    });
}

if (dropZone) {

    dropZone.addEventListener("dragover", (event) => {
        event.preventDefault();
        dropZone.classList.add("drag-over");
    });

    dropZone.addEventListener("dragleave", () => {
        dropZone.classList.remove("drag-over");
    });

    dropZone.addEventListener("drop", (event) => {

        event.preventDefault();

        dropZone.classList.remove("drag-over");

        const file = event.dataTransfer.files?.[0];

        if (file) {
            setSelectedFile(file);
        }
    });
}


function setSelectedFile(file) {

    if (!file.type.startsWith("image/")) {
        showError("Please select a PNG, JPG or JPEG image.");
        return;
    }

    selectedFile = file;

    clearError();

    const uploadEmpty = $("uploadEmpty");
    const uploadPreview = $("uploadPreview");
    const imagePreview = $("imagePreview");
    const fileName = $("fileName");
    const previewName = $("previewName");

    if (fileName) {
        fileName.textContent = file.name;
    }

    if (previewName) {
        previewName.textContent = file.name;
    }

    if (imagePreview) {
        const url = URL.createObjectURL(file);

        imagePreview.src = url;

        imagePreview.onload = () => {
            URL.revokeObjectURL(url);
        };
    }

    if (uploadEmpty) {
        uploadEmpty.classList.add("hidden");
    }

    if (uploadPreview) {
        uploadPreview.classList.remove("hidden");
    }

    if (analyzeBtn) {
        analyzeBtn.disabled = false;
    }

    if (analyzeBtnPreview) {
        analyzeBtnPreview.disabled = false;
    }

    resetAI();
}


/* =========================================================
   AI ANALYSIS
========================================================= */

if (analyzeBtn) {
    analyzeBtn.addEventListener("click", analyzeImage);
}

if (analyzeBtnPreview) {
    analyzeBtnPreview.addEventListener("click", analyzeImage);
}


async function analyzeImage() {

    if (!selectedFile) {
        showError("Please select a satellite image first.");
        return;
    }

    clearError();

    setAnalyzing(true);

    const formData = new FormData();

    formData.append("file", selectedFile);

    try {

        const response = await fetch(
            `${API_BASE}/detect-cyclone`,
            {
                method: "POST",
                body: formData
            }
        );

        if (!response.ok) {

            let message = `Backend error: ${response.status}`;

            try {
                const errorData = await response.json();

                if (errorData.detail) {
                    message = errorData.detail;
                }
            } catch (_) {}

            throw new Error(message);
        }

        const result = await response.json();

        console.log("VARSHA AI RESULT:", result);

        if (!result.success) {
            throw new Error(
                result.error || "AI analysis failed."
            );
        }

        showAIResult(result);

        updateAIImageLocation(result);

    } catch (error) {

        console.error("Analysis failed:", error);

        showError(
            "Analysis failed: " +
            (error.message || "Unable to connect to backend.")
        );

    } finally {

        setAnalyzing(false);
    }
}


function setAnalyzing(loading) {

    const buttons = [
        analyzeBtn,
        analyzeBtnPreview
    ];

    buttons.forEach(button => {

        if (!button) return;

        button.disabled = loading;

        if (loading) {
            button.textContent = "ANALYZING...";
        } else {
            button.textContent = "ANALYZE CYCLONE";
        }
    });

    const aiBadge = $("aiBadge");
    const aiWaiting = $("aiWaiting");

    if (loading) {

        if (aiBadge) {
            aiBadge.textContent = "ANALYZING";
            aiBadge.className = "badge neutral";
        }

        if (aiWaiting) {
            aiWaiting.classList.remove("hidden");
        }

    }
}


/* =========================================================
   SHOW AI RESULT
========================================================= */

function showAIResult(result) {

    const aiWaiting = $("aiWaiting");
    const aiResult = $("aiResult");

    if (aiWaiting) {
        aiWaiting.classList.add("hidden");
    }

    if (aiResult) {
        aiResult.classList.remove("hidden");
    }


    /* ---------- Probability ---------- */

    let probability = safeNumber(
        result.cyclone_probability
    );

    if (probability === null) {
        probability = safeNumber(result.probability);
    }

    if (probability === null) {
        probability = 0;
    }

    if (probability <= 1) {
        probability *= 100;
    }

    probability = Math.max(
        0,
        Math.min(100, probability)
    );

    const probabilityText = $("probability");
    const progressBar = $("progressBar");

    if (probabilityText) {
        probabilityText.textContent =
            probability.toFixed(1) + "%";
    }

    if (progressBar) {
        progressBar.style.width =
            probability + "%";
    }


    /* ---------- Detection ---------- */

    const isCyclone =
        result.cyclone_detected === true;


    const aiBadge = $("aiBadge");
    const detectionBox = $("detectionBox");
    const detectionDot = $("detectionDot");
    const detectionText = $("detectionText");
    const confidenceText = $("confidenceText");


    if (isCyclone) {

        if (aiBadge) {
            aiBadge.textContent = "CYCLONE DETECTED";
            aiBadge.className = "badge danger";
        }

        if (detectionText) {
            detectionText.textContent =
                "CYCLONE DETECTED";
        }

        if (detectionBox) {
            detectionBox.classList.add("danger");
        }

        if (detectionDot) {
            detectionDot.classList.add("danger");
        }

    } else {

        if (aiBadge) {
            aiBadge.textContent = "NO CYCLONE";
            aiBadge.className = "badge success";
        }

        if (detectionText) {
            detectionText.textContent =
                "NO CYCLONE DETECTED";
        }
    }


    /* ---------- Confidence ---------- */

    if (confidenceText) {

        const confidence =
            safeNumber(result.confidence);

        confidenceText.textContent =
            confidence !== null
                ? `Confidence ${confidence}%`
                : "AI confidence unavailable";
    }


    /* ---------- Model ---------- */

    const modelName = $("modelName");

    if (modelName) {
        modelName.textContent =
            result.model || "OpenAI Vision";
    }


    /* ---------- Analysis ---------- */

    const modelWarning = $("modelWarning");

    if (modelWarning) {

        const analysis =
            result.analysis ||
            "AI analysis completed.";

        const evidence =
            result.visual_evidence || "";

        modelWarning.innerHTML =
            `<strong>AI Assessment</strong><br>
             ${escapeHTML(analysis)}
             ${evidence
                ? `<br><br><strong>Visual Evidence</strong><br>${escapeHTML(evidence)}`
                : ""
             }`;
    }
}


/* =========================================================
   AI LOCATION
========================================================= */

function updateAIImageLocation(result) {

    if (!map) return;


    if (aiLocationLayer) {

        map.removeLayer(aiLocationLayer);

        aiLocationLayer = null;
    }


    const available =
        result.location_available === true;


    if (!available) {
        return;
    }


    const latitude =
        safeNumber(result.latitude);

    const longitude =
        safeNumber(result.longitude);


    if (
        latitude === null ||
        longitude === null ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
    ) {
        return;
    }


    aiLocationLayer =
        L.layerGroup().addTo(map);


    L.circle(
        [latitude, longitude],
        {
            radius: 120000,
            color: "#ff3344",
            weight: 2,
            fillColor: "#ff3344",
            fillOpacity: 0.10
        }
    ).addTo(aiLocationLayer);


    const marker =
        L.circleMarker(
            [latitude, longitude],
            {
                radius: 9,
                color: "#ffffff",
                weight: 2,
                fillColor: "#ff3344",
                fillOpacity: 1
            }
        ).addTo(aiLocationLayer);


    marker.bindPopup(`
        <strong>VARSHA AI</strong><br><br>
        AI Estimated Location<br>
        Latitude: ${latitude.toFixed(4)}°<br>
        Longitude: ${longitude.toFixed(4)}°<br>
        Confidence: ${
            result.location_confidence || "LOW"
        }
    `);
}


/* =========================================================
   MAP
========================================================= */

function initializeMap() {

    const mapElement = $("map");

    if (!mapElement) return;

    if (typeof L === "undefined") {
        console.error("Leaflet not loaded.");
        return;
    }

    map = L.map(mapElement, {
        zoomControl: true,
        worldCopyJump: true
    }).setView(
        [15, 80],
        4
    );


    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 18,
            attribution:
                "&copy; OpenStreetMap contributors"
        }
    ).addTo(map);
}


/* =========================================================
   LIVE CYCLONES
========================================================= */

async function loadLiveCyclones() {

    const mapMessage = $("mapMessage");

    try {

        if (mapMessage) {
            mapMessage.textContent =
                "Loading live cyclone data...";
        }


        const response =
            await fetch(
                `${API_BASE}/live-cyclones`,
                {
                    cache: "no-store"
                }
            );


        if (!response.ok) {
            throw new Error(
                `Live API error ${response.status}`
            );
        }


        const data =
            await response.json();


        console.log(
            "LIVE CYCLONE DATA:",
            data
        );


        const stormList =
            Array.isArray(data.storms)
                ? data.storms
                : [];


        drawAllStorms(stormList);

        updateCurrentStatus(
            stormList,
            data
        );

        updateForecast(
            stormList
        );


    } catch (error) {

        console.error(
            "Live cyclone error:",
            error
        );

        if (mapMessage) {
            mapMessage.textContent =
                "Live cyclone data unavailable.";
        }

        updateCurrentStatus([], {
            source: "Live feed unavailable"
        });

        updateForecast([]);
    }
}


/* =========================================================
   CURRENT STATUS
========================================================= */

function updateCurrentStatus(stormList, data) {

    const badge = $("stormBadge");
    const name = $("stormName");
    const status = $("stormStatus");
    const wind = $("windSpeed");
    const pressure = $("pressure");
    const lat = $("latValue");
    const lon = $("lonValue");
    const source = $("dataSource");


    if (!stormList.length) {

        if (badge) {
            badge.textContent = "NO ACTIVE CYCLONE";
            badge.className = "badge neutral";
        }

        if (name) {
            name.textContent = "NO ACTIVE STORM";
        }

        if (status) {
            status.textContent =
                "No active cyclone detected in the configured live feed.";
        }

        if (wind) wind.textContent = "--";
        if (pressure) pressure.textContent = "--";
        if (lat) lat.textContent = "--";
        if (lon) lon.textContent = "--";

        if (source) {
            source.textContent =
                data.source || "NOAA / NHC";
        }

        return;
    }


    const storm = stormList[0];


    if (badge) {

        badge.textContent =
            storm.classification ||
            storm.category ||
            "ACTIVE";

        badge.className =
            "badge danger";
    }


    if (name) {
        name.textContent =
            storm.name || "UNKNOWN STORM";
    }


    if (status) {

        const movement =
            storm.movement_direction ||
            storm.movement_dir;

        const speed =
            storm.movement_speed_kt;

        status.textContent =
            movement !== undefined
                ? `Moving ${movement}° at ${speed || "--"} kt`
                : "Active tropical system";
    }


    if (wind) {

        wind.textContent =
            storm.wind_speed_kt !== undefined
                ? `${storm.wind_speed_kt} kt`
                : "--";
    }


    if (pressure) {

        pressure.textContent =
            storm.pressure_mbar !== undefined
                ? `${storm.pressure_mbar} mb`
                : "--";
    }


    if (lat) {

        lat.textContent =
            storm.latitude !== undefined
                ? Number(storm.latitude).toFixed(2) + "°"
                : "--";
    }


    if (lon) {

        lon.textContent =
            storm.longitude !== undefined
                ? Number(storm.longitude).toFixed(2) + "°"
                : "--";
    }


    if (source) {
        source.textContent =
            storm.source ||
            data.source ||
            "NOAA / NHC";
    }
}


/* =========================================================
   DRAW STORMS
========================================================= */

function drawAllStorms(stormList) {

    if (!map) return;


    stormLayers.forEach(layer => {

        try {
            map.removeLayer(layer);
        } catch (_) {}
    });


    stormLayers = [];


    stormList.forEach(storm => {

        drawStorm(storm);
    });


    const mapMessage = $("mapMessage");

    if (mapMessage) {

        mapMessage.textContent =
            stormList.length
                ? `${stormList.length} active cyclone system(s) loaded.`
                : "No active cyclone in the configured live feed.";
    }
}


function drawStorm(storm) {

    const lat =
        safeNumber(storm.latitude);

    const lon =
        safeNumber(storm.longitude);


    if (lat === null || lon === null) {
        return;
    }


    /* Current marker */

    const marker =
        L.circleMarker(
            [lat, lon],
            {
                radius: 8,
                color: "#ffffff",
                weight: 2,
                fillColor: "#ff3344",
                fillOpacity: 1
            }
        ).addTo(map);


    const name =
        storm.name || "Unknown Storm";

    const classification =
        storm.classification ||
        storm.category ||
        "Tropical System";


    marker.bindPopup(`
        <strong>${escapeHTML(name)}</strong><br>
        ${escapeHTML(classification)}<br><br>
        Wind: ${storm.wind_speed_kt || "--"} kt<br>
        Pressure: ${storm.pressure_mbar || "--"} mb<br>
        Latitude: ${lat.toFixed(2)}°<br>
        Longitude: ${lon.toFixed(2)}°
    `);


    stormLayers.push(marker);


    /* Forecast */

    const forecast =
        Array.isArray(storm.forecast_track)
            ? storm.forecast_track
            : [];


    const points = forecast
        .map(point => {

            const pLat =
                safeNumber(
                    point.latitude ??
                    point.lat
                );

            const pLon =
                safeNumber(
                    point.longitude ??
                    point.lon ??
                    point.lng
                );

            if (
                pLat === null ||
                pLon === null
            ) {
                return null;
            }

            return [pLat, pLon];
        })
        .filter(Boolean);


    if (points.length > 1) {

        const line =
            L.polyline(
                [[lat, lon], ...points],
                {
                    weight: 3,
                    dashArray: "8 8",
                    opacity: 0.8
                }
            ).addTo(map);

        stormLayers.push(line);
    }
}


/* =========================================================
   FORECAST LIST
========================================================= */

function updateForecast(stormList) {

    const list = $("forecastList");

    if (!list) return;


    list.innerHTML = "";


    if (!stormList.length) {

        list.innerHTML =
            `<div class="empty-state">
                No active cyclone forecast available.
             </div>`;

        return;
    }


    let hasForecast = false;


    stormList.forEach(storm => {

        const forecast =
            Array.isArray(storm.forecast_track)
                ? storm.forecast_track
                : [];


        forecast.forEach((point, index) => {

            const lat =
                safeNumber(point.latitude);

            const lon =
                safeNumber(point.longitude);


            if (
                lat === null ||
                lon === null
            ) {
                return;
            }


            hasForecast = true;


            const item =
                document.createElement("div");

            item.className =
                "forecast-item";


            item.innerHTML = `
                <div>
                    <strong>
                        ${escapeHTML(storm.name || "Storm")}
                    </strong>
                    <span>
                        Forecast Point ${index + 1}
                    </span>
                </div>

                <strong>
                    ${lat.toFixed(2)}°,
                    ${lon.toFixed(2)}°
                </strong>
            `;


            list.appendChild(item);
        });
    });


    if (!hasForecast) {

        list.innerHTML =
            `<div class="empty-state">
                Forecast track not available from the live source.
             </div>`;
    }
}


/* =========================================================
   RESET
========================================================= */

function resetAI() {

    const aiWaiting = $("aiWaiting");
    const aiResult = $("aiResult");
    const aiBadge = $("aiBadge");

    if (aiWaiting) {
        aiWaiting.classList.remove("hidden");
    }

    if (aiResult) {
        aiResult.classList.add("hidden");
    }

    if (aiBadge) {
        aiBadge.textContent = "WAITING";
        aiBadge.className = "badge neutral";
    }
}


/* =========================================================
   SECURITY
========================================================= */

function escapeHTML(value) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


/* =========================================================
   REFRESH
========================================================= */

const refreshButton =
    $("refreshMapBtn");

if (refreshButton) {

    refreshButton.addEventListener(
        "click",
        loadLiveCyclones
    );
}


/* =========================================================
   START
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        console.log(
            "VARSHA AI frontend connected to:",
            API_BASE
        );

        initializeMap();

        loadLiveCyclones();

        setInterval(
            loadLiveCyclones,
            5 * 60 * 1000
        );
    }
);
