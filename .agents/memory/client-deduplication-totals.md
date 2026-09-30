---
name: Client deduplication totals
description: Conservative matching and currency verification for duplicate client records.
---

Use exact equality for lifetime orders and revenue when qualifying records for automatic deduplication. When checking aggregate totals before and after removing duplicate rows, normalize currency to cents rather than comparing JavaScript floating-point sums exactly.

**Why:** Identical source values can accumulate to slightly different binary floating-point sums, while relaxing the record-level match could merge distinct client histories.

**How to apply:** Keep the automatic merge gate strict; round only aggregate verification to currency precision unless the source provides stronger transaction-level evidence.