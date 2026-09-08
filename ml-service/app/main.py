# FastAPI app entrypoint for the FaceCheck-in ML microservice.
# This service is stateless: pure image-in / embedding-out, no DB access.
# The Node/Express backend is the only client that talks to this service.

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.embedding import router as embedding_router

app = FastAPI(
    title="FaceCheck-in ML Service",
    description="Stateless face detection + embedding microservice (RetinaFace + ArcFace)",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(embedding_router, prefix="/api/v1", tags=["face"])


@app.get("/health")
def health():
    return {"status": "ok"}