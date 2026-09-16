import os
import base64
import json
from pathlib import Path
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from openai import OpenAI


# =========================================================
# PATH
# =========================================================

BASE_DIR = Path(__file__).resolve().parent


# =========================================================
# APP
# =========================================================

app = FastAPI(
    title="VARSHA AI Cyclone Intelligence API",
    version="1.0.0"
)


# =========================================================
# CORS
# =========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# OPENAI
# =========================================================

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

if OPENAI_API_KEY:
    client = OpenAI(api_key=OPENAI_API_KEY)
    OPENAI_CONFIGURED = True
else:
    client = None
    OPENAI_CONFIGURED = False


OPENAI_MODEL = os.getenv(
    "OPENAI_MODEL",
    "gpt-5.6-luna"
)


# =========================================================
# IMAGE HELPER
# =========================================================

async def image_to_data_url(file: UploadFile):

    contents = await file.read()

    if not contents:
        raise HTTPException(
            status_code=400,
            detail="Uploaded image is empty."
        )

    content_type = file.content_type or "image/jpeg"

    if not content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail="Please upload a valid image file."
        )

    encoded = base64.b64encode(contents).decode("utf-8")

    return f"data:{content_type};base64,{encoded}"


# =========================================================
# ROOT
# =========================================================

@app.get("/")
async def root():

    index_file = BASE_DIR / "index.html"

    if index_file.exists():
        return FileResponse(index_file)

    return {
        "name": "VARSHA AI Cyclone Intelligence API",
        "status": "online",
        "version": "1.0.0",
        "docs": "/docs"
    }


# =========================================================
# HEALTH
# =========================================================

@app.get("/health")
async def health():

    return {
        "status": "healthy",
        "openai_configured": OPENAI_CONFIGURED,
        "model": OPENAI_MODEL
    }


# =========================================================
# AI CYCLONE DETECTION
# =========================================================

@app.post("/detect-cyclone")
async def detect_cyclone(
    file: UploadFile = File(...)
):

    if not OPENAI_CONFIGURED:
        raise HTTPException(
            status_code=500,
            detail="OPENAI_API_KEY is not configured on the server."
        )

    # -----------------------------------------------------
    # IMAGE
    # -----------------------------------------------------

    image_data_url = await image_to_data_url(file)


    # -----------------------------------------------------
    # AI PROMPT
    # -----------------------------------------------------

    prompt = """
You are the AI vision engine of VARSHA AI,
a cyclone intelligence prototype.

Analyze the uploaded satellite/weather image carefully.

Your tasks:

1. Decide whether the image appears to show a tropical cyclone,
   storm system, or organized cyclonic circulation.

2. Give a cyclone probability from 0 to 100.

3. Estimate confidence from 0 to 100.

4. Look for geographic clues visible INSIDE the image.

Possible clues include:

- country outlines
- coastlines
- islands
- cities
- labels
- latitude/longitude
- satellite map annotations
- ocean/sea names
- recognizable geographic features

5. If enough geographic evidence is visible, provide an
   APPROXIMATE latitude and longitude.

6. NEVER invent coordinates when there is insufficient evidence.

7. Clearly distinguish between:

   - image-based geographic estimate
   - confirmed geographic information

Return ONLY valid JSON.

Use exactly this structure:

{
    "cyclone_detected": true,
    "cyclone_probability": 0,
    "confidence": 0,
    "location_available": false,
    "latitude": null,
    "longitude": null,
    "location_confidence": 0,
    "location_note": "",
    "analysis": "",
    "visual_evidence": ""
}

Important rules:

- cyclone_probability must be between 0 and 100.
- confidence must be between 0 and 100.
- location_confidence must be between 0 and 100.
- latitude must be between -90 and 90.
- longitude must be between -180 and 180.

If location cannot be estimated reliably:

"location_available": false
"latitude": null
"longitude": null

Do not fabricate geographic coordinates.
"""


    # =====================================================
    # OPENAI REQUEST
    # =====================================================

    try:

        response = client.responses.create(
            model=OPENAI_MODEL,
            input=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "input_text",
                            "text": prompt
                        },
                        {
                            "type": "input_image",
                            "image_url": image_data_url
                        }
                    ]
                }
            ]
        )

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=f"OpenAI analysis failed: {str(e)}"
        )


    # =====================================================
    # RESPONSE TEXT
    # =====================================================

    result_text = response.output_text.strip()


    # Remove markdown code fences

    if result_text.startswith("```json"):
        result_text = result_text[7:]

    elif result_text.startswith("```"):
        result_text = result_text[3:]

    if result_text.endswith("```"):
        result_text = result_text[:-3]

    result_text = result_text.strip()


    # =====================================================
    # PARSE JSON
    # =====================================================

    try:

        result = json.loads(result_text)

    except json.JSONDecodeError:

        raise HTTPException(
            status_code=500,
            detail={
                "message": "AI returned invalid JSON.",
                "raw_response": result_text
            }
        )


    # =====================================================
    # SAFE DEFAULTS
    # =====================================================

    cyclone_detected = bool(
        result.get("cyclone_detected", False)
    )

    cyclone_probability = float(
        result.get("cyclone_probability", 0)
    )

    confidence = float(
        result.get("confidence", 0)
    )

    location_available = bool(
        result.get("location_available", False)
    )

    latitude = result.get("latitude")

    longitude = result.get("longitude")

    location_confidence = float(
        result.get("location_confidence", 0)
    )

    location_note = result.get(
        "location_note",
        ""
    )

    analysis = result.get(
        "analysis",
        ""
    )

    visual_evidence = result.get(
        "visual_evidence",
        ""
    )


    # =====================================================
    # VALIDATE PROBABILITIES
    # =====================================================

    cyclone_probability = max(
        0,
        min(100, cyclone_probability)
    )

    confidence = max(
        0,
        min(100, confidence)
    )

    location_confidence = max(
        0,
        min(100, location_confidence)
    )


    # =====================================================
    # VALIDATE LOCATION
    # =====================================================

    if not location_available:

        latitude = None
        longitude = None

    else:

        try:

            latitude = float(latitude)
            longitude = float(longitude)

        except (TypeError, ValueError):

            latitude = None
            longitude = None
            location_available = False

        if latitude is not None:

            if latitude < -90 or latitude > 90:

                latitude = None
                location_available = False

        if longitude is not None:

            if longitude < -180 or longitude > 180:

                longitude = None
                location_available = False


    # =====================================================
    # FINAL RESPONSE
    # =====================================================

    return {

        "success": True,

        "cyclone_detected": cyclone_detected,

        "cyclone_probability": round(
            cyclone_probability,
            2
        ),

        "confidence": round(
            confidence,
            2
        ),

        "location_available": location_available,

        "latitude": latitude,

        "longitude": longitude,

        "location_confidence": round(
            location_confidence,
            2
        ),

        "location_note": location_note,

        "analysis": analysis,

        "visual_evidence": visual_evidence,

        "model": OPENAI_MODEL,

        "source": "OpenAI Vision"
    }


# =========================================================
# LIVE CYCLONES
# =========================================================

@app.get("/live-cyclones")
async def live_cyclones():
    """
    Real-time tropical cyclone feed.

    Source:
    Global Disaster Alert and Coordination System (GDACS).

    GDACS updates its public feeds frequently and provides:
    - current cyclone position
    - current wind speed
    - cyclone status
    - observed track
    - forecast track
    - alert level

    This endpoint keeps the frontend contract simple:
    { success, storms, source, updated_at }
    """

    GDACS_BASE = "https://www.gdacs.org/gdacsapi/api"
    now = datetime.now(timezone.utc)
    from_date = (now - timedelta(days=7)).strftime("%Y-%m-%d")
    to_date = (now + timedelta(days=1)).strftime("%Y-%m-%d")

    def get_json(url, params=None, timeout=15):
        if params:
            url = f"{url}?{urlencode(params)}"
        request = Request(
            url,
            headers={
                "User-Agent": "VARSHA-AI/1.0",
                "Accept": "application/json"
            }
        )
        with urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))

    def number(value):
        try:
            return float(value)
        except (TypeError, ValueError):
            return None

    def bool_value(value):
        return str(value).strip().lower() == "true"

    try:
        # Search recent tropical-cyclone events.
        # GDACS recommends querying alert levels separately because
        # an event's alert level can change during its lifetime.
        seen = {}

        for level in ("Green", "Orange", "Red"):
            data = get_json(
                f"{GDACS_BASE}/events/geteventlist/SEARCH",
                {
                    "eventlist": "TC",
                    "alertlevel": level,
                    "pageSize": 100,
                    "pageNumber": 1,
                    "fromDate": from_date,
                    "toDate": to_date
                }
            )

            for feature in data.get("features", []):
                props = feature.get("properties", {})
                geometry = feature.get("geometry", {})
                coords = geometry.get("coordinates", [])

                if not props.get("eventid") or len(coords) < 2:
                    continue

                event_id = int(props["eventid"])

                seen[event_id] = {
                    "eventid": event_id,
                    "name": props.get("eventname", "Unknown Cyclone"),
                    "alert_level": props.get("alertlevel", "Green"),
                    "is_current": bool_value(props.get("iscurrent")),
                    "source_agency": props.get("source") or "GDACS",
                    "country": props.get("country"),
                    "latitude": number(coords[1]),
                    "longitude": number(coords[0]),
                    "wind_speed": number(
                        (props.get("severitydata") or {}).get("severity")
                    ),
                    "status": (
                        (props.get("severitydata") or {}).get("severitytext")
                        or "Tropical Cyclone"
                    )
                }

        # Only expose events that GDACS currently marks as active.
        active_events = [
            item for item in seen.values()
            if item["is_current"]
        ]

        storms = []

        for event in active_events[:10]:
            event_id = event["eventid"]
            track = []

            try:
                detail = get_json(
                    f"{GDACS_BASE}/events/geteventdata",
                    {
                        "eventtype": "TC",
                        "eventid": event_id
                    }
                )

                impacts = detail.get("properties", {}).get("impacts", [])

                timeline_url = None
                for impact in impacts:
                    resource = impact.get("resource", {})
                    if resource.get("timeline"):
                        timeline_url = resource["timeline"]
                        break

                if timeline_url:
                    timeline_data = get_json(timeline_url)
                    items = timeline_data.get("channel", {}).get("item", [])

                    for item in items:
                        coords_text = str(item.get("coordinates", ""))
                        parts = [
                            p.strip()
                            for p in coords_text.replace(",", " ").split()
                            if p.strip()
                        ]

                        if len(parts) >= 2:
                            lon = number(parts[0])
                            lat = number(parts[1])

                            if lat is not None and lon is not None:
                                track.append({
                                    "latitude": lat,
                                    "longitude": lon,
                                    "type": (
                                        "current"
                                        if bool_value(item.get("current"))
                                        else (
                                            "forecast"
                                            if not bool_value(item.get("actual"))
                                            else "track"
                                        )
                                    ),
                                    "time": item.get("advisory_datetime"),
                                    "wind_speed": number(
                                        item.get("wind_speed")
                                    )
                                })

                    # The timeline is chronological. Use the latest
                    # observed/current point for the dashboard.
                    observed = [
                        p for p in track
                        if p["type"] in ("current", "track")
                    ]

                    if observed:
                        latest = observed[-1]
                        event["latitude"] = latest["latitude"]
                        event["longitude"] = latest["longitude"]

                        if latest.get("wind_speed") is not None:
                            # GDACS timeline wind_speed is in m/s.
                            event["wind_speed"] = round(
                                latest["wind_speed"] * 3.6, 1
                            )

            except Exception:
                # If timeline details fail, keep the event-level position
                # rather than breaking the entire dashboard.
                track = []

            storms.append({
                "id": str(event_id),
                "name": event["name"],
                "status": event["status"],
                "alert_level": event["alert_level"],
                "wind_speed": event["wind_speed"],
                "pressure": None,
                "latitude": event["latitude"],
                "longitude": event["longitude"],
                "movement": None,
                "country": event["country"],
                "source": f"GDACS ({event['source_agency']})",
                "updated_at": now.isoformat(),
                "track": track
            })

        return {
            "success": True,
            "active": len(storms) > 0,
            "storms": storms,
            "source": "GDACS Near Real-Time Tropical Cyclone Feed",
            "updated_at": now.isoformat()
        }

    except Exception as e:
        # Do not silently show fake cyclone values if the real source
        # cannot be reached.
        return {
            "success": False,
            "active": False,
            "storms": [],
            "source": "GDACS",
            "updated_at": now.isoformat(),
            "error": f"Live feed unavailable: {str(e)}"
        }


# =========================================================
# FRONTEND STATIC FILES
# =========================================================
#
# IMPORTANT:
# index.html, app.js and style.css
# should be in the SAME folder as this main.py.
#
# Current GitHub structure:
#
# Varsha-AI/
# ├── main.py
# ├── index.html
# ├── app.js
# ├── style.css
# └── requirements.txt
#
# =========================================================

app.mount(
    "/",
    StaticFiles(
        directory=BASE_DIR,
        html=True
    ),
    name="frontend"
)
