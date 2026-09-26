# Behaviour that looks wrong is reproduced deliberately while both apps run

The old MIS frontend and the One WSO2 port run side by side for one full reporting cycle, and
finance signs off figures from both. While that is true, the ported screens reproduce the source's
behaviour even where it looks like a defect, because a "fix" makes the two apps disagree and every
disagreement has to be investigated as a possible port error before anyone can trust the numbers.

Each such case is recorded in `docs/ported-apps/mis.md` under a dedicated section, following the
convention the earlier port specs established, so the list is a known backlog rather than a mystery.
Fixes land after the old frontend goes dark.
