---
name: WhatsApp PTT audio
description: Evolution API behavior for sending prerecorded WhatsApp voice notes.
---

For any client question about bronze, answer the main question in text and attempt the prerecorded bronze audio once per conversation. After confirmed delivery, say that the audio explains bronzeamento Neon; if delivery fails or the clip was already attempted, do not claim it was sent and continue with confirmed details in text. For a confirmed visit, first ask discreetly whether the client is pregnant or could be; only after she says no, send the towel-and-bikini reminder, Neon banner, and configured address. If she says yes or possibly, decline tanning. Track attempts separately for each clip and never replay one, including after pending or failed attempts. Evolution's `sendWhatsAppAudio` endpoint sends PTT media and keeps a 30-second recording presence; with encoding enabled it converts the source to OGG/Opus.

For incoming audio, preserve a bounded inline audio base64 payload while its webhook is pending or retrying; remove it from the durable inbox after successful processing. The fallback Evolution media-download endpoint may fail when the provider does not retain the message, so stripping the only inline media copy before transcription can make every incoming voice note unreadable.

**Why:** The user explicitly wants bronze inquiries to receive the Neon audio, while avoiding false delivery claims and repeated clips. The recording indicator duration and pregnancy restriction are also user-confirmed.

**How to apply:** Keep the text reply before the bronze PTT, then explain it is about Neon only after successful delivery. Persist attempts—not just successful sends—so retries do not replay the same clip. Keep the pregnancy check and visit bundle sequential: no towel/bikini, banner, or address until the client confirms she is not pregnant.

**Why:** The durable webhook queue removes inline media to keep stored event payloads small, but the incoming-audio path can use the webhook's inline base64 directly. If the provider-side media store is unavailable, the prior sanitization discarded the only usable audio copy.

**How to apply:** Keep audio base64 only for active/retryable audio jobs and under a bounded size; strip it when the job completes. Keep provider download as fallback and log media retrieval/transcription failures without exposing raw error details to the client.