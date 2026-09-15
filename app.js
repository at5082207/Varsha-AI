const API_BASE = "https://varsha-ai-i8e4.onrender.com";

let map = null;
let mapLayers = [];
let aiLocationLayer = null;
let selectedFile = null;
let storms = [];


/* =========================================================
   BASIC HELPERS
========================================================= */

function $(id) {
    return document.getElementById(id);
}

function safeNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}


/* =========================================================
   DOM ELEMENTS
========================================================= */

const imageInput = $("imageInput");
const dropZone = $("dropZone");
const chooseBtn = $("chooseBtn");
const changeBtn = $("changeBtn");
const analyzeBtn = $("analyzeBtn");
const analyzeBtnPreview = $("analyzeBtnPreview");


/* =========================================================
   IMAGE UPLOAD
========================================================= */

if (imageInput) {
    imageInput.addEventListener("change", function (event) {
        const file = event.target.files && event.target.files[0];

        if (file) {
            setSelectedFile(file);
        }
    });
}


if (chooseBtn) {
    chooseBtn.addEventListener("click", function () {
        if (imageInput) {
            imageInput.click();
        }
    });
}


if (changeBtn) {
    changeBtn.addEventListener("click", function () {
        if (imageInput) {
            imageInput.click();
        }
    });
}


if (dropZone) {

    dropZone.addEventListener("dragover", function (event) {
        event.preventDefault();
        dropZone.classList.add("drag-over");
    });

    dropZone.addEventListener("dragleave", function () {
        dropZone.classList.remove("drag-over");
    });

    dropZone.addEventListener("drop", function (event) {

        event.preventDefault();

        dropZone.classList.remove("drag-over");

        const file = event.dataTransfer.files &&
                     event.dataTransfer.files[0];

        if (file) {
            setSelectedFile(file);
        }
    });
}


/* =========================================================
   SELECT FILE
========================================================= */

function setSelectedFile(file) {

    selectedFile = file;

    const previewImage = $("previewImage");
    const fileName = $("fileName");
    const uploadPanel = $("uploadPanel");
    const previewPanel = $("previewPanel");
    const errorBox = $("errorBox");

    if (errorBox) {
        errorBox.textContent = "";
        errorBox.classList.add("hidden");
    }

    if (fileName) {
        fileName.textContent = file.name;
    }

    if (previewImage) {

        const url = URL.createObjectURL(file);

        previewImage.src = url;

        previewImage.onload = function () {
            URL.revokeObjectURL(url);
        };
    }

    if (uploadPanel) {
        uploadPanel.classList.add("hidden");
    }

    if (previewPanel) {
        previewPanel.classList.remove("hidden");
    }

    if (analyzeBtn) {
        analyzeBtn.disabled = false;
    }

    if (analyzeBtnPreview) {
        analyzeBtnPreview.disabled = false;
    }

    clearAIResult();
}


/* =========================================================
   ANALYZE BUTTONS
========================================================= */

if (analyzeBtn) {
    analyzeBtn.addEventListener("click", analyzeImage);
}

if (analyzeBtnPreview) {
    analyzeBtnPreview.addEventListener("click", analyzeImage);
}


/* =========================================================
   AI IMAGE ANALYSIS
========================================================= */

async function analyzeImage() {

    if (!selectedFile) {
        showError("Please select a satellite image first.");
        return;
    }

    const formData = new FormData();

    formData.append("file", selectedFile);

    setAnalyzingState(true);

    try {

        const response = await fetch(
            `${API_BASE}/detect-cyclone`,
            {
                method: "POST",
                body: formData
            }
        );

        if (!response.ok) {

            let message = `Server error: ${response.status}`;

            try {
                const errorData = await response.json();

                if (errorData.detail) {
                    message = errorData.detail;
                }
            } catch (_) {}

            throw new Error(message);
        }

        const result = await response.json();

        console.log("AI RESULT:", result);

        showAIResult(result);

        updateAIImageLocation(result);

    } catch (error) {

        console.error("Analysis failed:", error);

        showError(
            "Analysis failed: " +
            (error.message || "Unable to connect to backend.")
        );

    } finally {

        setAnalyzingState(false);
    }
}


/* =========================================================
   ANALYZING STATE
========================================================= */

function setAnalyzingState(isLoading) {

    const buttons = [
        analyzeBtn,
        analyzeBtnPreview
    ];

    buttons.forEach(function (button) {

        if (!button) {
            return;
        }

        button.disabled = isLoading;

        if (isLoading) {
            button.dataset.originalText = button.textContent;
            button.textContent = "Analyzing...";
        } else {
            button.textContent =
                button.dataset.originalText || "Analyze Cyclone";
        }
    });

    const loadingBox = $("loadingBox");

    if (loadingBox) {
        if (isLoading) {
            loadingBox.classList.remove("hidden");
        } else {
            loadingBox.classList.add("hidden");
        }
    }
}


/* =========================================================
   SHOW AI RESULT
========================================================= */

function showAIResult(result) {

    console.log("Showing AI result:", result);

    const resultPanel = $("resultPanel");

    if (resultPanel) {
        resultPanel.classList.remove("hidden");
    }


    /* ---------- Probability ---------- */

    let probability =
        safeNumber(result.cyclone_probability);

    if (probability === null) {
        probability =
            safeNumber(result.probability);
    }

    if (probability === null) {
        probability = 0;
    }

    if (probability <= 1) {
        probability = probability * 100;
    }

    probability = Math.max(
        0,
        Math.min(100, probability)
    );

    const probabilityText = $("probability");
    const probabilityBar = $("probabilityBar");

    if (probabilityText) {
        probabilityText.textContent =
            probability.toFixed(1) + "%";
    }

    if (probabilityBar) {
        probabilityBar.style.width =
            probability.toFixed(1) + "%";
    }


    /* ---------- Detection ---------- */

    const detection =
        String(
            result.detection ||
            result.classification ||
            result.label ||
            ""
        ).toLowerCase();

    let isCyclone = false;

    if (
        detection.includes("cyclone") ||
        detection.includes("storm") ||
        detection.includes("tropical")
    ) {
        isCyclone = true;
    }

    if (
        result.is_cyclone === true ||
        result.cyclone_detected === true
    ) {
        isCyclone = true;
    }


    const detectionStatus =
        $("detectionStatus");

    if (detectionStatus) {

        if (isCyclone) {

            detectionStatus.textContent =
                "CYCLONE DETECTED";

            detectionStatus.classList.remove(
                "text-green-400"
            );

            detectionStatus.classList.add(
                "text-red-400"
            );

        } else {

            detectionStatus.textContent =
                "NO CYCLONE DETECTED";

            detectionStatus.classList.remove(
                "text-red-400"
            );

            detectionStatus.classList.add(
                "text-green-400"
            );
        }
    }


    /* ---------- Model ---------- */

    const modelName =
        $("modelName");

    if (modelName) {

        modelName.textContent =
            result.model ||
            result.model_name ||
            "OpenAI Vision";
    }


    /* ---------- Warning ---------- */

    const warning =
        $("warningText");

    if (warning) {

        warning.textContent =
            result.warning ||
            result.analysis ||
            result.summary ||
            "AI analysis completed.";
    }


    /* ---------- Summary ---------- */

    const summary =
        $("aiSummary");

    if (summary) {

        summary.textContent =
            result.summary ||
            result.analysis ||
            "No additional summary available.";
    }


    /* ---------- Confidence ---------- */

    const confidence =
        $("confidence");

    if (confidence) {

        confidence.textContent =
            result.confidence ||
            "AI ESTIMATE";
    }


    /* ---------- Intensity ---------- */

    const intensity =
        $("intensity");

    if (intensity) {

        intensity.textContent =
            result.intensity ||
            result.storm_intensity ||
            "Unknown";
    }


    /* ---------- Movement ---------- */

    const movement =
        $("movement");

    if (movement) {

        movement.textContent =
            result.movement ||
            result.movement_direction ||
            "Unknown";
    }


    /* ---------- AI Reason ---------- */

    const reason =
        $("aiReason");

    if (reason) {

        reason.textContent =
            result.reason ||
            result.explanation ||
            "AI visual assessment completed.";
    }


    /* ---------- Location ---------- */

    updateAIImageLocation(result);
}


/* =========================================================
   AI IMAGE LOCATION
========================================================= */

function updateAIImageLocation(result) {

    if (!map) {
        console.warn("Map is not initialized.");
        return;
    }

    /*
        Remove previous AI marker
    */

    if (aiLocationLayer) {

        map.removeLayer(aiLocationLayer);

        aiLocationLayer = null;
    }


    const locationAvailable =
        result.location_available === true;


    const locationPanel =
        $("aiLocationPanel");

    const locationStatus =
        $("aiLocationStatus");

    const locationCoordinates =
        $("aiLocationCoordinates");

    const locationConfidence =
        $("aiLocationConfidence");

    const locationNote =
        $("aiLocationNote");


    /* =====================================================
       NO LOCATION
    ===================================================== */

    if (!locationAvailable) {

        if (locationStatus) {
            locationStatus.textContent =
                "LOCATION NOT AVAILABLE";
        }

        if (locationCoordinates) {
            locationCoordinates.textContent =
                "Coordinates unavailable";
        }

        if (locationConfidence) {
            locationConfidence.textContent =
                "N/A";
        }

        if (locationNote) {
            locationNote.textContent =
                result.location_note ||
                "The satellite image does not contain enough visible geographic reference to estimate coordinates safely.";
        }

        if (locationPanel) {
            locationPanel.classList.remove("hidden");
        }

        return;
    }


    /* =====================================================
       READ COORDINATES
    ===================================================== */

    const latitude =
        safeNumber(result.latitude);

    const longitude =
        safeNumber(result.longitude);


    /*
        Safety check:
        Never put invalid coordinates on the map.
    */

    if (
        latitude === null ||
        longitude === null ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
    ) {

        if (locationStatus) {
            locationStatus.textContent =
                "LOCATION NOT AVAILABLE";
        }

        if (locationCoordinates) {
            locationCoordinates.textContent =
                "Invalid coordinates returned by AI";
        }

        if (locationConfidence) {
            locationConfidence.textContent =
                "N/A";
        }

        if (locationNote) {
            locationNote.textContent =
                "AI did not return safe geographic coordinates.";
        }

        if (locationPanel) {
            locationPanel.classList.remove("hidden");
        }

        return;
    }


    /* =====================================================
       LOCATION PANEL
    ===================================================== */

    if (locationStatus) {
        locationStatus.textContent =
            "AI LOCATION ESTIMATE";
    }

    if (locationCoordinates) {

        locationCoordinates.textContent =
            `${latitude.toFixed(4)}°, ${longitude.toFixed(4)}°`;
    }

    if (locationConfidence) {

        locationConfidence.textContent =
            String(
                result.location_confidence ||
                "LOW"
            ).toUpperCase();
    }

    if (locationNote) {

        locationNote.textContent =
            result.location_note ||
            "Approximate location inferred from visible geographic references in the image.";
    }

    if (locationPanel) {
        locationPanel.classList.remove("hidden");
    }


    /* =====================================================
       CREATE AI MARKER
    ===================================================== */

    aiLocationLayer = L.layerGroup().addTo(map);


    const outerCircle =
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
        <div style="min-width:220px">
            <strong>VARSHA AI</strong><br>
            AI Estimated Cyclone Location<br><br>
            Latitude: ${latitude.toFixed(4)}°<br>
            Longitude: ${longitude.toFixed(4)}°<br>
            Confidence: ${
                String(
                    result.location_confidence || "LOW"
                ).toUpperCase()
            }
        </div>
    `);


    marker.openPopup();


    /* =====================================================
       MOVE MAP
    ===================================================== */

    map.flyTo(
        [latitude, longitude],
        5,
        {
            duration: 1.5
        }
    );
}


/* =========================================================
   ERROR
========================================================= */

function showError(message) {

    const errorBox =
        $("errorBox");

    if (!errorBox) {
        console.error(message);
        return;
    }

    errorBox.textContent = message;

    errorBox.classList.remove("hidden");
}


/* =========================================================
   CLEAR AI RESULT
========================================================= */

function clearAIResult() {

    const resultPanel =
        $("resultPanel");

    if (resultPanel) {
        resultPanel.classList.add("hidden");
    }


    if (aiLocationLayer && map) {

        map.removeLayer(aiLocationLayer);

        aiLocationLayer = null;
    }


    const locationPanel =
        $("aiLocationPanel");

    if (locationPanel) {
        locationPanel.classList.add("hidden");
    }
}


/* =========================================================
   MAP INITIALIZATION
========================================================= */

function initializeMap() {

    const mapElement =
        $("map");

    if (!mapElement) {

        console.warn(
            "Map element #map not found."
        );

        return;
    }


    if (typeof L === "undefined") {

        console.error(
            "Leaflet is not loaded."
        );

        return;
    }


    map = L.map(
        mapElement,
        {
            zoomControl: true,
            worldCopyJump: true
        }
    ).setView(
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


    console.log("Map initialized.");
}


/* =========================================================
   LIVE CYCLONES
========================================================= */

async function loadLiveCyclones() {

    try {

        const response =
            await fetch(
                `${API_BASE}/live-cyclones`
            );


        if (!response.ok) {
            throw new Error(
                `Live cyclone API returned ${response.status}`
            );
        }


        const data =
            await response.json();


        storms =
            Array.isArray(data)
                ? data
                : (
                    Array.isArray(data.storms)
                        ? data.storms
                        : []
                );


        console.log(
            "Live cyclones:",
            storms
        );


        drawAllStorms();


    } catch (error) {

        console.error(
            "Live cyclone loading failed:",
            error
        );
    }
}


/* =========================================================
   DRAW LIVE STORMS
========================================================= */

function drawAllStorms() {

    if (!map) {
        return;
    }


    /*
        Remove previous storm layers
        but keep AI marker.
    */

    mapLayers.forEach(function (layer) {

        try {
            map.removeLayer(layer);
        } catch (_) {}
    });


    mapLayers = [];


    if (!Array.isArray(storms)) {
        return;
    }


    storms.forEach(function (storm) {

        try {

            drawStorm(
                storm
            );

        } catch (error) {

            console.error(
                "Storm drawing failed:",
                error,
                storm
            );
        }
    });
}


/* =========================================================
   DRAW ONE STORM
========================================================= */

function drawStorm(storm) {

    if (!storm || !map) {
        return;
    }


    const lat =
        safeNumber(
            storm.latitude ??
            storm.lat
        );

    const lon =
        safeNumber(
            storm.longitude ??
            storm.lon ??
            storm.lng
        );


    if (
        lat === null ||
        lon === null
    ) {
        return;
    }


    /*
        Forecast track
    */

    const track =
        storm.forecast_track ||
        storm.forecast ||
        storm.track;


    if (
        Array.isArray(track) &&
        track.length > 1
    ) {

        const points =
            track
                .map(function (point) {

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

                    return [
                        pLat,
                        pLon
                    ];
                })
                .filter(Boolean);


        if (points.length > 1) {

            const line =
                L.polyline(
                    points,
                    {
                        weight: 3,
                        dashArray: "8 8",
                        opacity: 0.75
                    }
                ).addTo(map);


            mapLayers.push(line);
        }
    }


    /*
        Current storm marker
    */

    const marker =
        L.circleMarker(
            [lat, lon],
            {
                radius: 7,
                weight: 2,
                color: "#ffffff",
                fillOpacity: 0.95
            }
        ).addTo(map);


    const name =
        storm.name ||
        storm.storm_name ||
        "Unknown Storm";


    const category =
        storm.category ||
        storm.status ||
        "Tropical Cyclone";


    marker.bindPopup(`
        <strong>${name}</strong><br>
        ${category}<br><br>
        Latitude: ${lat.toFixed(2)}°<br>
        Longitude: ${lon.toFixed(2)}°
    `);


    mapLayers.push(marker);
}


/* =========================================================
   AUTO REFRESH
========================================================= */

function startLiveRefresh() {

    setInterval(
        loadLiveCyclones,
        5 * 60 * 1000
    );
}


/* =========================================================
   PAGE LOAD
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        console.log(
            "VARSHA AI frontend loaded."
        );


        initializeMap();

        loadLiveCyclones();

        startLiveRefresh();
    }
);
