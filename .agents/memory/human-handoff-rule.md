---
name: Human handoff rule
description: Product decision for when WhatsApp conversations leave the AI agent.
---

The AI should transfer a WhatsApp conversation to a human only when the client explicitly asks for an attendant, person, or human service. Complaints, negotiations, rescheduling, clinical limits, and missing information stay in the AI conversation.

**Why:** The desired experience is continuous, friendly AI assistance rather than automatic escalation whenever a topic is difficult or negative.

**How to apply:** Keep handoff detection limited to explicit human-request language. Manual operator actions remain allowed, but model handoff flags must not override this rule.