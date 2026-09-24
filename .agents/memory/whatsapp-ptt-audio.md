---
name: WhatsApp PTT audio
description: Evolution API behavior for sending prerecorded WhatsApp voice notes.
---

For outgoing WhatsApp voice notes, Evolution's `sendWhatsAppAudio` endpoint sends PTT media. The business expects a 30-second recording presence before delivery; this is intentional despite the added wait. For bronze-related questions, send the AI's text reply before starting the audio send. With encoding enabled, Evolution converts the source audio to OGG/Opus for WhatsApp; the original asset can remain unchanged.

**Why:** WhatsApp PTT expects a voice-note-compatible codec, while uploaded recordings may be OGG/Vorbis. Sending ordinary audio media does not provide the same voice-note presentation, and omitting the delay skips the visible recording presence. The 30-second duration was explicitly requested to make the recording indicator last longer, so the HTTP timeout must also exceed the recording delay.

**How to apply:** Send the original asset as base64 through Evolution's voice-audio endpoint with encoding enabled and a 30-second delay; set the provider request timeout to at least the recording delay plus network headroom. Treat the delay as a deliberate user-facing wait, and deliver bronze-topic text before starting it. Use the provider's conversion rather than replacing or re-encoding the stored user asset.