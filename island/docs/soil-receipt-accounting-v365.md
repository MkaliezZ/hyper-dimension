# V365 · Compost accounting with autonomous NPC work

The retained Intel Mac V363 report reached harvest and reload, then failed its
hardcoded total-compost-zero assertion. Its canonical ledger contains exactly
one player craft (+1), one player fertilizer use (-1), and one NPC craft (+1).
The NPC entry charges the complete compost recipe cost. The remaining bag is
normal autonomous production, not a replayed player reward. NPC work was enabled
throughout this control and remains enabled.

The final check now reconciles canonical receipts. It still requires the exact
player production and consumption entries, their costs and categories. Any
additional bag must have a distinct NPC craft operation and the complete recipe
cost. Actual inventory must equal exactly that paid NPC output. Unexplained
inventory, extra player output, duplicate fertilizer use, missing receipts, free
NPC output and wrong costs fail. The wheat, soil charges and unique action
receipt assertions remain unchanged. There are no timeout or production changes.

Eight controls exercise real production resource commits and an actual
authorized NPC craft, plus explicit invalid accounting cases. Retained local
native saves and the hosted canonical balance are checked with the new
validator; this replay is distinct from a fresh native walkthrough. V364 already
ran both complete native controls locally. No additional long native cycle or
human/physical-device acceptance is claimed. Hosted recovery remains pending.

V362 sealed archives remain unchanged; this is a source-only CI follow-up.
