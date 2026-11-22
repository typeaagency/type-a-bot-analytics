# Type A Bot Analytics

See which AI bots read your site, and how often people share your pages in chat and social apps.

Type A Bot Analytics is two small Cloudflare Workers:

- **The rule** runs on your site's routes. It looks at each request's user agent. If the request is a GET or HEAD from an AI bot or from an app's link preview, the rule sends one small hit to your dashboard. It does not wait for the dashboard, and it never changes your page.
- **The dashboard** keeps the counts in a D1 database and shows them on one page.

Everything runs in your own Cloudflare account. The code sends nothing to Type A or to anyone else.

The hosted version, with verified bot visits and AI prompt tracking, is at [report.typeamedia.net](https://report.typeamedia.net). Type A is at [typeamedia.net](https://typeamedia.net).

## What it counts

**AI bot visits**, in three groups. The agents are in [`tables/ai_crawler_agents.yml`](tables/ai_crawler_agents.yml).

| Group      | What the bot does                     | Examples                     |
| ---------- | ------------------------------------- | ---------------------------- |
| Training   | collects pages to train a model       | GPTBot, ClaudeBot, CCBot     |
| AI search  | builds an AI search index             | OAI-SearchBot, PerplexityBot |
| User fetch | reads a page the moment a person asks | ChatGPT-User, Claude-User    |

**Link shares.** When a person pastes your link into iMessage, WhatsApp, Slack, LinkedIn and other apps, the app fetches the page once to make its preview card. One preview fetch is one share. The apps are in [`tables/link_share_apps.yml`](tables/link_share_apps.yml).

The dashboard shows AI bot visits by group and by bot, link shares by app, and the top 20 pages, for the last 7, 30 or 90 days.

**What it stores.** One row for each day, bot or app, host and path, with a count. It stores no IP address and no full user agent.

**What it does not do.** It does not check that a visit really came from the bot it names: a user agent is easy to fake. The hosted version checks each visit against the operator's published IP addresses and networks.

## Install

You need a Cloudflare account with your site on it, and Node.js 22.5 or later.

```sh
git clone https://github.com/typeaagency/type-a-bot-analytics.git
cd type-a-bot-analytics
npm install
npx wrangler login
```

### 1. Deploy the dashboard

```sh
npm run deploy:dashboard
```

The first deploy makes the D1 database `bot-analytics`, then applies the migration. Wrangler prints the dashboard's address, for example `https://bot-analytics-dashboard.<your-subdomain>.workers.dev`.

If your Wrangler version asks for a `database_id`, run `npx wrangler d1 create bot-analytics`, put the id it prints into `dashboard/wrangler.toml`, and run the command again.

Set the two secrets. Use a long random value for the hit token, for example from `openssl rand -hex 32`.

```sh
cd dashboard
npx wrangler secret put HIT_TOKEN           # the rule sends this with each hit
npx wrangler secret put DASHBOARD_PASSWORD  # the password for the page (any user name)
cd ..
```

### 2. Deploy the rule

In `rule/wrangler.toml`, put one route in `routes` for each host that you want to count, for example `{ pattern = "www.example.com/*", zone_name = "example.com" }`.

The rule sends each hit to the dashboard through a service binding (`DASHBOARD`). This needs no address, and it works because both Workers are in the same account. A rule cannot reach a `workers.dev` address of its own account with a plain fetch (Cloudflare error 1042). If your dashboard is in a different account, remove `services` and set `DASHBOARD_URL` to its address.

Then deploy it, and give it the same hit token:

```sh
npm run deploy:rule
cd rule && npx wrangler secret put HIT_TOKEN && cd ..
```

In the Cloudflare dashboard, set the failure mode of each route to **Fail open**. If your account ever goes past its Workers request limit, visitors then get your site as if the Worker were not there.

### 3. Check it

```sh
curl -s -o /dev/null -A "GPTBot/1.2" https://www.example.com/
curl -s -o /dev/null -A "facebookexternalhit/1.1 Facebot Twitterbot/1.0" https://www.example.com/
```

Open the dashboard. It shows one GPTBot visit under Training and one iMessage share.

Test the rule on a route of your own zone, not on a `workers.dev` address. On `workers.dev` the rule has no origin, so its fetch of the page calls the rule again, and one curl counts many times.

## Cost

Each request on the rule's routes is one Workers request. The Workers free plan includes 100,000 requests a day. The paid plan is $5 a month with 10 million requests, then $0.30 for each million. The hit to the dashboard is a subrequest, and Cloudflare does not bill subrequests. See [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/).

## Develop

```sh
npm test        # the tests, on Node's own SQLite
npm run lint    # ESLint and Prettier
```

To run both Workers on your computer, put `HIT_TOKEN=...` in `rule/.dev.vars` and `dashboard/.dev.vars`, and `DASHBOARD_PASSWORD=...` in `dashboard/.dev.vars`. Then:

```sh
cd dashboard && npx wrangler d1 migrations apply DB --local && npx wrangler dev --port 8797
cd rule && npx wrangler dev --port 8798 --host example.com --var DASHBOARD_URL:http://127.0.0.1:8797
```

The two tables come from Type A's own repo. A CI step there opens a pull request here when either table changes. Please do not edit them in this repo. To suggest a bot or an app, open an issue with a real user agent from your logs.

## Licence

MIT. See [LICENSE](LICENSE).
