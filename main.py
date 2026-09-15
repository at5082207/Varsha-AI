import os
import json
import base64
from typing import Optional

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from openai import OpenAI


# =========================================================
# CONFIG
# =========================================================

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

OPENAI_MODEL = os.getenv(
    "OPENAI_MODEL",
    "gpt-5.6-luna"
)


# =========================================================
# OPENAI CLIENT
# =========================================================

if not OPENAI_API_KEY:
    print("[WARNING] OPENAI_API_KEY is not set.")
    client = None
else:
    client = OpenAI(
        api_key=OPENAI_API_KEY
    )

    print("[OK] OpenAI client initialized")
    print(f"[OK] OpenAI model: {OPENAI_MODEL}")


# =========================================================
# FASTAPI
# =========================================================

app = FastAPI(
    title="VARSHA AI Cyclone Intelligence API"
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# HEALTH
# =========================================================

@app.get("/")
def root():

    return {
        "status": "online",
        "service": "VARSHA AI",
        "model": OPENAI_MODEL
    }


@app.get("/health")
def health():

    return {
        "status": "healthy",
        "openai_configured": client is not None,
        "model": OPENAI_MODEL
    }


# =========================================================
# IMAGE -> DATA URL
# =========================================================

async def image_to_data_url(
    file: UploadFile
):

    contents = await file.read()

    if not contents:
        raise HTTPException(
            status_code=400,
            detail="Uploaded image is empty."
        )


  content_type = file.content_type or "image/jpeg"


    if not content_type.startswith(
        "image/"
    ):

        raise HTTPException(
            status_code=400,
            detail="Please upload a valid image file."
        )


  encoded = base64.b64encode(contents).decode("utf-8")


    return (
        f"data:{content_type};base64,{encoded}"
    )


# =========================================================
# JSON EXTRACTION
# =========================================================

def clean_json_text(text: str):

    text = text.strip()


    if text.startswith("```"):

        text = text.replace(
            "```json",
            ""
        )

        text = text.replace(
            "```",
            ""
        )

        text = text.strip()


    return text


# =========================================================
# CYCLONE DETECTION
# =========================================================

@app.post("/detect-cyclone")
async def detect_cyclone(
    file: UploadFile = File(...)
):

    if client is None:

        raise HTTPException(
            status_code=500,
            detail="OPENAI_API_KEY is not configured on the backend."
        )


 image_data_url = await image_to_data_url(file)
        )


    # =====================================================
    # AI INSTRUCTIONS
    # =====================================================

    system_prompt = """
You are VARSHA AI, an AI assistant for cyclone and
satellite-image analysis.

Analyze the supplied satellite/weather image carefully.

Your job is to estimate:

1. Whether a tropical cyclone or organized storm is visible.
2. Cyclone probability from 0 to 100.
3. Visible storm intensity.
4. Visible cloud organization.
5. Possible movement direction if it can be inferred.
6. Approximate geographic location ONLY if the image contains
   enough visible geographic information.

IMPORTANT LOCATION RULES:

- NEVER invent coordinates.
- NEVER guess random latitude/longitude.
- If the image has no coastline, map labels, geographic grid,
  coordinates, land features, storm label, or other useful
  geographic reference, set location_available to false.
- If geographic references are visible, provide an APPROXIMATE
  location only.
- Location is an AI estimate, not an official warning.
- Confidence must be LOW, MEDIUM, or HIGH.
- If uncertain, choose LOW.
- Do not pretend an approximate location is exact.

The output MUST be valid JSON only.

Return exactly this structure:

{
  "cyclone_detected": true,
  "cyclone_probability": 0,
  "classification": "CYCLONE",
  "intensity": "Unknown",
  "movement": "Unknown",
  "confidence": "LOW",
  "summary": "Short visual summary",
  "reason": "Short explanation",
  "warning": "Short safety/status message",

  "location_available": false,
  "latitude": null,
  "longitude": null,
  "location_confidence": "LOW",
  "location_note": "Why location is or is not available"
}

For cyclone_probability use a number from 0 to 100.

If cyclone_probability is above 50, classification may be
CYCLONE.

If cyclone_probability is 50 or below, classification may be
NO CYCLONE.

Remember:
This is visual AI analysis and must not be represented as
an official meteorological warning.
"""


    user_prompt = """
Analyze this satellite/weather image for cyclone activity.

Pay special attention to:

- spiral cloud structure
- organized convection
- circular circulation
- eye/eyewall if visible
- curved rain/cloud bands
- cloud symmetry
- land/ocean boundary
- visible geographic labels
- latitude/longitude grid
- coastline or recognizable geographic features

For geographic location, only return coordinates when there
is visible evidence supporting the estimate.
"""


    # =====================================================
    # OPENAI VISION REQUEST
    # =====================================================

    try:

        response = client.responses.create(

            model=OPENAI_MODEL,

            input=[
                {
                    "role": "system",
                    "content": [
                        {
                            "type": "input_text",
                            "text": system_prompt
                        }
                    ]
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "input_text",
                            "text": user_prompt
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

        print(
            "[ERROR] OpenAI request failed:",
            repr(e)
        )

        raise HTTPException(
            status_code=500,
            detail=f"OpenAI analysis failed: {str(e)}"
        )


    # =====================================================
    # GET MODEL OUTPUT
    # =====================================================

    try:

        output_text =
            response.output_text

    except Exception:

        output_text = ""


    if not output_text:

        raise HTTPException(
            status_code=500,
            detail="OpenAI returned an empty response."
        )


    print(
        "\n========== OPENAI RAW OUTPUT =========="
    )

    print(output_text)

    print(
        "========================================\n"
    )


    # =====================================================
    # PARSE JSON
    # =====================================================

    try:

        cleaned =
            clean_json_text(
                output_text
            )

        result =
            json.loads(
                cleaned
            )

    except Exception as e:

        print(
            "[ERROR] JSON parsing failed:",
            repr(e)
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "AI returned an invalid JSON response."
            )
        )


    # =====================================================
    # NORMALIZE RESULT
    # =====================================================

    cyclone_probability =
        result.get(
            "cyclone_probability",
            0
        )


    try:

        cyclone_probability =
            float(
                cyclone_probability
            )

    except Exception:

        cyclone_probability = 0


    cyclone_probability =
        max(
            0,
            min(
                100,
                cyclone_probability
            )
        )


    latitude =
        result.get(
            "latitude"
        )

    longitude =
        result.get(
            "longitude"
        )


    location_available =
        result.get(
            "location_available",
            False
        )


    # =====================================================
    # VALIDATE LOCATION
    # =====================================================

    if location_available:

        try:

            latitude =
                float(latitude)

            longitude =
                float(longitude)

        except Exception:

            location_available = False

            latitude = None
            longitude = None


        if (
            latitude is None
            or longitude is None
            or latitude < -90
            or latitude > 90
            or longitude < -180
            or longitude > 180
        ):

            location_available = False

            latitude = None
            longitude = None


    else:

        latitude = None
        longitude = None


    location_confidence =
        str(
            result.get(
                "location_confidence",
                "LOW"
            )
        ).upper()


    if location_confidence not in [
        "LOW",
        "MEDIUM",
        "HIGH"
    ]:

        location_confidence = "LOW"


    # =====================================================
    # FINAL RESPONSE
    # =====================================================

    final_result = {

        "success": True,

        "model": OPENAI_MODEL,

        "cyclone_detected":
            bool(
                result.get(
                    "cyclone_detected",
                    False
                )
            ),

        "cyclone_probability":
            cyclone_probability,

        "classification":
            result.get(
                "classification",
                "UNKNOWN"
            ),

        "intensity":
            result.get(
                "intensity",
                "Unknown"
            ),

        "movement":
            result.get(
                "movement",
                "Unknown"
            ),

        "confidence":
            result.get(
                "confidence",
                "LOW"
            ),

        "summary":
            result.get(
                "summary",
                ""
            ),

        "reason":
            result.get(
                "reason",
                ""
            ),

        "warning":
            result.get(
                "warning",
                "AI estimate only. Follow official meteorological authorities for warnings."
            ),

        # -----------------------------------------------
        # AI LOCATION
        # -----------------------------------------------

        "location_available":
            location_available,

        "latitude":
            latitude,

        "longitude":
            longitude,

        "location_confidence":
            location_confidence,

        "location_note":
            result.get(
                "location_note",
                "No reliable geographic reference was available."
            )
    }


    print(
        "[OK] Cyclone analysis completed."
    )

    print(
        "[LOCATION]",
        final_result["location_available"],
        final_result["latitude"],
        final_result["longitude"]
    )


    return final_result


# =========================================================
# LIVE CYCLONES
# =========================================================

@app.get("/live-cyclones")
def live_cyclones():

    """
    Basic live cyclone endpoint.

    The frontend can use this endpoint for the live map.
    If another live cyclone data source is already connected
    in your existing backend, keep that logic here.
    """

    return {
        "storms": []
    }