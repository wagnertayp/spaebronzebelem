---
name: Human handoff rule
description: Product decision for when WhatsApp conversations leave the AI agent.
---

The AI should transfer a WhatsApp conversation when the client explicitly asks for a person; reports allergies, reactions, or health concerns; complains or is dissatisfied; requests an exception to hours or rules; asks for unregistered prices, availability, or special conditions; asks about a service whose attendance flow is undefined; or when the AI cannot answer confidently. Questions about Spa Infantil remain an exception: explain only the confirmed details, then transfer. The user says it is a bath based on moisturizer and sugar, without lead or ammonia, for children ages 2–10.

**Why:** The user approved a new service-flow prompt that explicitly requires escalation for these safety, complaint, exception, and unknown-information cases. Spa Infantil is an offered service with confirmed details, and the user requested a human handoff after explaining it. Avoid saying it contains no chemicals at all; moisturizer and sugar are chemical substances, so that absolute claim would mislead.

**How to apply:** Keep direct human requests and Spa Infantil as deterministic handoff paths. Also honor the model's handoff decision for the approved escalation cases: send a brief, accurate continuation message, then set the conversation to human handling. Never invent a staff name, response time, or completed transfer.