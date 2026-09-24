---
name: WhatsApp PTT audio
description: Evolution API behavior for sending prerecorded WhatsApp voice notes.
---

For outgoing WhatsApp voice notes, Evolution's `sendWhatsAppAudio` endpoint sends PTT media. It only emits the `recording` presence when a nonzero `delay` is supplied. With encoding enabled, Evolution converts the source audio to OGG/Opus for WhatsApp; the original asset can remain unchanged.

**Why:** WhatsApp PTT expects a voice-note-compatible codec, while uploaded recordings may be OGG/Vorbis. Sending ordinary audio media does not provide the same voice-note presentation, and omitting the delay skips the visible recording presence.

**How to apply:** Send the original asset as base64 through Evolution's voice-audio endpoint with encoding enabled and a short nonzero delay. Keep the delay brief; matching a prerecorded clip's full duration would make replies unnecessarily slow. Use the provider's conversion rather than replacing or re-encoding the stored user asset.