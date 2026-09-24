---
name: WhatsApp PTT audio
description: Evolution API behavior for sending prerecorded WhatsApp voice notes.
---

For outgoing WhatsApp voice notes, Evolution's `sendWhatsAppAudio` endpoint sends PTT media and uses a `recording` presence. With encoding enabled, Evolution converts the source audio to OGG/Opus for WhatsApp; the original asset can remain unchanged.

**Why:** WhatsApp PTT expects a voice-note-compatible codec, while uploaded recordings may be OGG/Vorbis. Sending ordinary audio media does not provide the same voice-note presentation.

**How to apply:** Send the original asset as base64 through Evolution's voice-audio endpoint with encoding enabled. Use the provider's conversion rather than replacing or re-encoding the stored user asset.