"""KS Photo to GLB producer, launched inside the isolated Colab Python 3.10 env."""

import io
import sys
import uuid
from pathlib import Path

ROOT = Path("/content/TripoSG")
sys.path.insert(0, str(ROOT))

import gradio as gr
import numpy as np
import torch
import trimesh
from huggingface_hub import snapshot_download
from PIL import Image
from rembg import new_session, remove
from triposg.pipelines.pipeline_triposg import TripoSGPipeline


if not torch.cuda.is_available():
    raise RuntimeError(
        "GPU bulunamadı. Çalışma zamanı > Çalışma zamanı türünü değiştir > T4 GPU seçin."
    )

print(f"KS motoru Python {sys.version.split()[0]} ve {torch.cuda.get_device_name(0)} ile başlıyor.")
weights = ROOT / "pretrained_weights/TripoSG"
snapshot_download(repo_id="VAST-AI/TripoSG", local_dir=str(weights))
pipe = TripoSGPipeline.from_pretrained(str(weights)).to("cuda", torch.float16)
rmbg = new_session("u2netp")


def prepare(image):
    raw = io.BytesIO()
    Image.fromarray(image).save(raw, format="PNG")
    rgba = Image.open(io.BytesIO(remove(raw.getvalue(), session=rmbg))).convert("RGBA")
    bbox = rgba.getchannel("A").getbbox()
    if bbox:
        rgba = rgba.crop(bbox)
    width, height = rgba.size
    side = max(width, height)
    pad = max(12, int(side * 0.12))
    size = side + 2 * pad
    canvas = Image.new("RGBA", (size, size), (255, 255, 255, 0))
    canvas.alpha_composite(rgba, ((size - width) // 2, (size - height) // 2))
    result = Image.new("RGB", canvas.size, "white")
    result.paste(canvas.convert("RGB"), mask=canvas.getchannel("A"))
    return result


def generate(image, quality, seed, progress=gr.Progress()):
    if image is None:
        raise gr.Error("Önce fotoğraf yükleyin.")
    progress(0.1, desc="Arka plan hazırlanıyor")
    prepared = prepare(image)
    steps, target_faces = (35, 120_000) if quality == "Hızlı" else (50, 250_000)
    progress(0.25, desc="3D geometri üretiliyor")
    with torch.no_grad():
        output = pipe(
            image=prepared,
            generator=torch.Generator(device="cuda").manual_seed(int(seed)),
            num_inference_steps=steps,
            guidance_scale=7.0,
        ).samples[0]
    mesh = trimesh.Trimesh(
        output[0].astype(np.float32), np.ascontiguousarray(output[1]), process=False
    )
    if len(mesh.faces) > target_faces:
        try:
            mesh = mesh.simplify_quadric_decimation(face_count=target_faces)
        except Exception as error:
            print(f"Yüzey azaltma atlandı: {error}")
    result_path = f"/content/KS_OUTPUT_{uuid.uuid4().hex[:8]}.glb"
    mesh.export(result_path)
    torch.cuda.empty_cache()
    progress(1, desc="GLB hazır")
    return result_path, result_path


with gr.Blocks(title="KS Fotoğraf → GLB") as app:
    gr.Markdown(
        "## KS Fotoğraf → GLB\n"
        "Havacılık aracını mümkünse sade arka plan önünde ve tamamı görünecek şekilde yükleyin."
    )
    with gr.Row():
        source_image = gr.Image(label="Araç fotoğrafı", type="numpy")
        preview = gr.Model3D(label="Üretilen 3D model")
    with gr.Row():
        quality = gr.Radio(
            ["Hızlı", "Kaliteli"], value="Kaliteli", label="Kalite"
        )
        seed = gr.Number(value=42, precision=0, label="Varyasyon")
    button = gr.Button("3D MODELİ ÜRET", variant="primary")
    download = gr.File(label="GLB dosyasını indir")
    button.click(generate, [source_image, quality, seed], [preview, download])

app.launch(share=True, debug=False)
