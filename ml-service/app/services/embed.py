"""
Face embedding generation using InsightFace's ArcFace model.
Takes an aligned 112x112 face crop (as produced by detect.py) and returns
a 512-dimensional L2-normalized embedding vector. Cosine similarity between
two such vectors is what the Node backend uses for matching (tau=0.40).
"""

import numpy as np
from app.services.detect import get_face_app


def get_embedding(aligned_face: np.ndarray) -> list[float]:
    app = get_face_app()
    rec_model = app.models["recognition"]
    embedding = rec_model.get_feat(aligned_face)

    embedding = np.asarray(embedding).flatten()
    norm = np.linalg.norm(embedding)
    if norm > 0:
        embedding = embedding / norm

    return embedding.astype(float).tolist()


def get_embeddings_for_faces(faces: list[dict]) -> list[dict]:
    output = []
    for face in faces:
        embedding = get_embedding(face["aligned_face"])
        output.append({
            "bbox": face["bbox"],
            "landmarks": face["landmarks"],
            "det_score": face["det_score"],
            "embedding": embedding,
        })
    return output