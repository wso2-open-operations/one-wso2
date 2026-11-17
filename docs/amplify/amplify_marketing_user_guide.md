# Amplify guide for PO, Marketing, SLT and Admin

For people who run Amplify or watch how it's doing. Everyone also gets the **Celebrate** screen, covered in the [Amplify user guide](amplify_user_guide.md). This guide covers what you get on top of that.

## What you can see

Access comes from your Asgardeo group. Amplify checks it on every call, so the menu items are a convenience, not the lock.

| Group (default names) | Post screens (New Post, Current Posts) | Dashboarding boards | CSV export |
|---|---|---|---|
| `amplify_marketing` | Yes | Yes | Yes |
| `amplify_po` | Yes | Yes | Yes |
| `amplify_slt` | No | Yes | Yes |
| `amplify_admin` | No | Yes | Yes |

Group names are configuration on the Amplify service, so a deployment can change them. If a menu item is missing for you, you're not in the group that grants it. Ask the Amplify team.

In the **Amplify** perspective's left menu you'll find:

- **Celebrate**: everyone.
- **New Post** and **Current Posts**: Marketing and PO.
- **Dashboarding** (a collapsible group): At A Glance, Operations, Post Performance, Participation, Team, Scorecard.

## Registering a post (New Post)

Use this when Marketing has published a post on the WSO2 LinkedIn company page and wants employees to amplify it.

1. Open **New Post**.
2. **LinkedIn post.** Easiest route: paste the post's link or URN into **Post ID**. Amplify fills in the post type (`share`, `ugcPost` or `activity`) and the numeric ID for you. Or pick the type and type the digits yourself. It must be a post on the WSO2 company page. Amplify rejects anything else.
3. **Headline.** Up to 200 characters. Shown on every card.
4. **Card summary.** Two or three lines, up to 2,000 characters. Shown on the cards in One WSO2.
5. **Image URL** (optional). An HTTPS link to the post's image. Without one, or if it fails to load, the card shows the black Amplify default image.
6. **Category.** Product, Company news, Customer story, Event, Thought leadership or Careers. Pick one.
7. **Priority** switch. A priority post is marked on every card and sorts to the top of everyone's list. Use it sparingly, or it stops meaning anything.
8. **Track engagement until.** The date Amplify stops counting this post. Blank means 30 days after the post date.
9. Click **Save & share now** or **Save**.

| Button | What happens |
|---|---|
| **Save & share now** | Registers the post and starts an Amplify run right away. Employees see it on Celebrate within minutes, and Novera announces it. |
| **Save** | Registers the post. It goes out with the next scheduled Amplify run (every five minutes by default). |

Both buttons take you to Current Posts afterward.

**If you see a yellow warning** saying no LinkedIn company page is configured, posts can't be registered yet. That's a setup item on the Amplify service (`WSO2ORGANIZATIONURN`). Tell the Amplify team.

## Editing posts (Current Posts)

Current Posts lists every post that isn't archived, three at a time (use the arrows). Each card has a status chip:

| Chip | Meaning |
|---|---|
| **Live** | Open. Employees see it and can amplify it. |
| **Next run** | Registered and waiting for the next Amplify run. |
| **Closed** | Past its tracking date. Employees no longer see it. |

Click **Update post** to change its **Headline**, **Card summary**, **Post URL**, **Image URL**, **Category**, **Priority** flag or **Track engagement until** date. Click **Save**.

Two things to know:

- Amplify only edits its own card. **To change the text of the LinkedIn post itself, edit it on LinkedIn.** That's what the screen's subtitle is reminding you.
- If two people edit the same post at once, the second save is refused with a version conflict. Reload the page and apply your change again.

**Create new post** at the bottom right takes you back to New Post.

Posts are archived, not deleted. There's no archive button on this screen yet. Ask the Amplify team if one needs to go.

## Dashboarding

Five boards, in this order. All of them are read only. Counts are for employees who use Amplify, and times are UTC.

### At A Glance

One screen for the leadership check-in. Bring this one to the meeting.

- **Employee reposts of WSO2 posts**: reposts per month.
- **Employees participating**, **Posts live**, **Share success, this month**.
- **Top 3 people (all time)** and **Top 3 teams**.
- **Best post this month**.

### Operations

"What's live, who's sharing, and is anything stuck?" This is the one to watch day to day.

- **Points awarded**, switchable between **Month** and **Year**, plus how many people have points.
- **Posts live**, **Reposts / Reposts with Comments**, **Employees connected**.
- **Share health, this month**: how many shares are published, queued and failed. Failed ones are the ones to chase.
- **Connections**: how many LinkedIn links are active, expiring, expired and revoked. Expiring and expired links are people who can't amplify until they link again.
- **Posts** table: each live or recently closed post with category, window, reposts, reposts with comments, and its **Novera** announcement status. If an announcement shows as failed, it needs a retry. See the Amplify operations runbook (`docs/runbooks/operations.md` in the wso2-amplify workspace repo).

### Post Performance

"Which posts are people sharing, and how fast?"

- **Reposts per post**: a bar per post. Click a bar to open the post's detail window.
- **Reposts by category**: which kinds of content get shared.

The post detail window shows reposts, reposts with comments, share of connected employees, the first 24 hours, a reposts-per-day chart, and who shared (with comments listed separately). Use the left and right arrow keys to step between posts. Click a person's name to open their detail.

The person detail shows points this month, reposts, reposts with comments, the posts they shared and a category breakdown.

### Participation

"Where do employees drop off, and which teams lead?"

- **Employee journey**: a funnel from employees, to connected LinkedIn, to reposted at least once, to active in the last 30 days.
- **Team leaderboard** and **House leaderboard**: points, participants, headcount and participation rate. Click a column heading to sort. The team board can be narrowed by business unit.
- **Export**: choose **Week**, **Month** or **Year**, or set **From** and **To** dates, and click **Download CSV**. You get the raw rows behind the boards for that range.

Handle the export like any employee data. Keep it in WSO2's tools and don't forward it.

### Team

"Who is in the company, and how many points does each person have?"

- A table of everyone in the people directory, with their points and company rank. People who haven't earned points yet are listed too, with 0 points and no rank.
- **Search** by name or email, **sort** by company rank, points or name, and page through the list.
- A note above the table says how many people are active out of the total. If the people directory is down, the list shows only people with points and says so.
- Click a name to open the person detail (only for people who have a standing).

### Scorecard

"Are we hitting our participation targets?" Each measure shows its current value, its target and an **On track** or **Watch** chip, with a summary count at the top. A measure on **Watch** is behind target. The targets are Amplify settings, not hard-coded.

## Points and who earns them

Point values for the pilot (from the business, 2026-10-19):

| Action | Points |
|---|---|
| Repost, no added text | 2 |
| Repost with the employee's own thoughts | 5 |
| Original WSO2 post (phase 3) | 10 |
| Featured by WSO2 channels or an SLT member (phase 3) | 25 total (10 + 15 bonus) |
| Amplify Challenge entry | 10 (awarded by PO as an adjustment) |
| Amplify Challenge winner | 25 (awarded by PO as an adjustment) |

Phase 1 only awards the first two. Points show on the leaderboards as points only; there is no Coin value yet.

**Monthly winners:** the top three company-wide, with a 100-point minimum. Ties are broken by post reach, which the Post Performance board helps with.

## Not in the screens yet

The Amplify service has more than the One WSO2 screens show. These work through the API only for now, so ask the Amplify team if you need one:

- Reviewing employee-submitted external shares (approve, reject, mark amplified)
- Point adjustments and reversals, and changing point values (PO)
- Admin settings and retrying a failed Novera announcement (Admin)
- Reports (phase 2)

## Troubleshooting

| What you see | What to do |
|---|---|
| New Post, Current Posts or Dashboarding is missing from the menu | You're not in the group that grants it. Ask the Amplify team to add you. |
| "Couldn't load" on a board | Click **Retry**. If it keeps failing, check the Operations board and tell the Amplify team. |
| A saved post isn't on Celebrate yet | Saved with **Save**? It waits for the next run. Use **Save & share now** to start one immediately. |
| Employees say Amplify won't let them share | Check **Connections** on Operations. Their link may be expired or revoked. They link again from the Amplify pop-up. |
| Shares show as failed | See **Share health** on Operations. Failed shares retry when the employee clicks Amplify again. |
