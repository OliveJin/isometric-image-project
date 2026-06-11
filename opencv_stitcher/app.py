"""
OpenCV 全景拼接 Flask 服务
接收多张图片，用 cv2.Stitcher 拼接为全景图。

启动:
    D:\PanoramaProject\venv\Scripts\python app.py

API:
    POST /stitch     - 上传图片进行拼接
    GET  /health     - 健康检查
"""

import os
import uuid
from pathlib import Path

import cv2
from flask import Flask, request, jsonify

cv2.ocl.setUseOpenCL(False)

app = Flask(__name__)

# 拼接结果保存到 backend/uploads/ 目录
BASE_DIR = Path(__file__).resolve().parent.parent
UPLOADS_DIR = BASE_DIR / "backend" / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

# 临时目录
TEMP_DIR = Path(os.environ.get("TEMP", "/tmp")) / "opencv_stitcher_temp"
TEMP_DIR.mkdir(parents=True, exist_ok=True)


@app.route("/health")
def health():
    return jsonify({"status": "ok"})


@app.route("/stitch", methods=["POST"])
def stitch():
    images = request.files.getlist("images")

    if len(images) < 2:
        return jsonify({
            "status": "error",
            "message": f"至少需要 2 张图片，当前收到 {len(images)} 张",
        }), 400

    temp_paths = []
    images_cv = []

    try:
        # 保存上传的图片到临时文件，并读取为 OpenCV 格式
        for i, file in enumerate(images):
            filename = f"{uuid.uuid4().hex}.jpg"
            temp_path = TEMP_DIR / filename
            file.save(str(temp_path))
            temp_paths.append(temp_path)

            img = cv2.imread(str(temp_path))
            if img is None:
                return jsonify({
                    "status": "error",
                    "message": f"无法读取第 {i + 1} 张图片，请确认文件格式正确",
                }), 400

            # 缩小大图加速拼接（与原项目一致）
            h, w = img.shape[:2]
            max_width = 1200
            if w > max_width:
                scale = max_width / w
                img = cv2.resize(img, None, fx=scale, fy=scale)

            images_cv.append(img)

        print(f"读取图片数量: {len(images_cv)}")

        # --- OpenCV Stitcher（与原项目一致） ---
        stitcher = cv2.Stitcher_create()
        status, panorama = stitcher.stitch(images_cv)

        if status != cv2.Stitcher_OK:
            error_msg = {
                cv2.Stitcher_ERR_NEED_MORE_IMAGES: "图片数量不足",
                cv2.Stitcher_ERR_HOMOGRAPHY_ERR: "图片之间特征匹配失败，请确认照片有足够重叠",
                cv2.Stitcher_ERR_CAMERA_PROJS_ERR: "投影变换计算失败",
            }.get(status, f"拼接失败 (错误码: {status})")

            print(f"拼接失败: {error_msg}")
            # 清理临时文件
            for tp in temp_paths:
                try:
                    tp.unlink(missing_ok=True)
                except OSError:
                    pass
            return jsonify({
                "status": "error",
                "message": error_msg,
            }), 500

        print(f"原始尺寸: {panorama.shape}")

        # --- 去黑边裁剪（与原项目一致） ---
        gray = cv2.cvtColor(panorama, cv2.COLOR_BGR2GRAY)
        _, thresh = cv2.threshold(gray, 1, 255, cv2.THRESH_BINARY)
        coords = cv2.findNonZero(thresh)
        x, y, bw, bh = cv2.boundingRect(coords)
        crop = panorama[y:y+bh, x:x+bw]

        print(f"裁剪后尺寸: {crop.shape}")

        # --- 调整到合适尺寸 ---
        target_width = 2048
        target_height = 1024
        if crop.shape[1] > 0:
            aspect = crop.shape[0] / crop.shape[1]
            h = int(target_width * aspect)
            crop = cv2.resize(crop, (target_width, h), interpolation=cv2.INTER_LANCZOS4)

        if crop.shape[0] > target_height:
            ratio = target_height / crop.shape[0]
            w = int(crop.shape[1] * ratio)
            crop = cv2.resize(crop, (w, target_height), interpolation=cv2.INTER_LANCZOS4)

        # 保存到 uploads 目录
        output_filename = f"panorama-{uuid.uuid4().hex}.jpg"
        output_path = UPLOADS_DIR / output_filename
        cv2.imwrite(str(output_path), crop, [
            cv2.IMWRITE_JPEG_QUALITY,
            95,
        ])

        # 清理临时文件
        for tp in temp_paths:
            try:
                tp.unlink(missing_ok=True)
            except OSError:
                pass

        url = f"/uploads/{output_filename}"
        print(f"保存成功: {url}")

        return jsonify({
            "status": "ok",
            "url": url,
            "width": crop.shape[1],
            "height": crop.shape[0],
        })

    except Exception as e:
        # 清理残留临时文件
        for tp in temp_paths:
            try:
                tp.unlink(missing_ok=True)
            except OSError:
                pass
        print(f"错误: {e}")
        return jsonify({
            "status": "error",
            "message": str(e),
        }), 500


if __name__ == "__main__":
    print("OpenCV Stitcher Service starting on http://0.0.0.0:5000")
    print(f"使用虚拟环境: {os.sys.executable}")
    print(f"OpenCV 版本: {cv2.__version__}")
    print(f"UPLOADS_DIR: {UPLOADS_DIR}")
    print(f"TEMP_DIR: {TEMP_DIR}")
    app.run(host="0.0.0.0", port=5000, debug=False)
