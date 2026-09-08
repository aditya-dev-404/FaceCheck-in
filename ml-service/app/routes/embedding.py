"""
FastAPI routes exposing the detect + embed pipeline.
This service is stateless and has no DB access — it only takes an image in
and returns detection/embedding data out. The Node backend is responsible
for everything else (storage, comparison, business logic).
"""

from fastapi import APIRouter, UploadFile, File, HTTPException

from app.services.detect import detect_and_align
from app.services.embed import get_embeddings_for_faces

router = APIRouter()


@router.post("/detect")
async def detect(image: UploadFile = File(...)):
    image_bytes = await image.read()
    try:
        faces = detect_and_align(image_bytes)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {
        "face_count": len(faces),
        "faces": [
            {"bbox": f["bbox"], "landmarks": f["landmarks"], "det_score": f["det_score"]}
            for f in faces
        ],
    }


@router.post("/embed")
async def embed(image: UploadFile = File(...)):
    image_bytes = await image.read()
    try:
        faces = detect_and_align(image_bytes)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not faces:
        return {"face_count": 0, "faces": []}

    faces_with_embeddings = get_embeddings_for_faces(faces)

    return {"face_count": len(faces_with_embeddings), "faces": faces_with_embeddings}