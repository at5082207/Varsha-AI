from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="VARSHA AI Cyclone Intelligence API"
)
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
