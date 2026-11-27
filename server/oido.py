# Pasa la voz a texto en esta compu. Lee un pedido por renglón: {"audio": ruta, "pista": palabras}
import json, sys
sys.stdin.reconfigure(encoding="utf-8"); sys.stdout.reconfigure(encoding="utf-8")
from faster_whisper import WhisperModel
m = WhisperModel("small", device="cpu", compute_type="int8", local_files_only=True)
print(json.dumps({"listo": True}), flush=True)
for line in sys.stdin:
    try:
        r = json.loads(line)
        seg, _ = m.transcribe(r["audio"], language="es", beam_size=4, vad_filter=True, condition_on_previous_text=False, initial_prompt=r.get("pista") or None)
        # Lo que el modelo "oye" en el silencio se descarta
        print(json.dumps({"texto": " ".join(s.text.strip() for s in seg if s.no_speech_prob < 0.7).strip()}, ensure_ascii=False), flush=True)
    except Exception as e:
        print(json.dumps({"error": str(e)[:200]}), flush=True)
