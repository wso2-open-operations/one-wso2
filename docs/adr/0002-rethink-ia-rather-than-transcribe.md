# The MIS port re-thinks the information architecture rather than transcribing the screens

Every app ported into One WSO2 so far was re-placed or consolidated rather than copied — personal
claim submission moved to Me while approving moved to Finance, four menu entries became one entry
with two tabs — and MIS carries inconsistencies of its own worth not importing (an "ARR Dashboard"
that is three screens next to a "Flash Dashboard" that is one). So the port re-thinks placement,
naming and grouping. But MIS users are not filling in a form: they navigate by muscle memory, know
figures by position, and hold bookmarked URLs carrying serialised filter state, so the re-think is
kept narrow and is argued in `docs/ported-apps/mis.md` and signed off by a named finance stakeholder
before code lands, rather than decided screen by screen during implementation.

## Considered options

- **Faithful port, re-skinned.** Rejected: imports MIS's own naming inconsistencies into a
  persona-first IA, and runs against all nine precedents.
- **Full redesign.** Rejected: there is no mandate for it, and verifying number parity during the
  parallel period needs a screen-for-screen mapping a redesign would destroy.
