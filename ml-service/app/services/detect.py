"""
Face detection + alignment using InsightFace's RetinaFace model.
Given a raw image (numpy BGR array, as read by OpenCV), returns a list of
detected faces, each with a bounding box, 5-point landmarks, and an aligned
112x112 face crop ready to be passed to the ArcFace embedding model.
"""

import cv2
import numpy as np
from insightface.app import FaceAnalysis
from insightface.utils import face_align

_face_app: FaceAnalysis | None = None


def get_face_app() -> FaceAnalysis:
    global _face_app
    if _face_app is None:
        _face_app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
        _face_app.prepare(ctx_id=0, det_size=(640, 640))
    return _face_app


def detect_and_align(image_bytes: bytes) -> list[dict]:
    np_arr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Could not decode image bytes")

    app = get_face_app()
    faces = app.get(img)

    results = []
    for face in faces:
        aligned = face_align.norm_crop(img, landmark=face.kps, image_size=112)
        results.append({
            "bbox": face.bbox.astype(int).tolist(),
            "landmarks": face.kps.tolist(),
            "det_score": float(face.det_score),
            "aligned_face": aligned,
        })
    return results