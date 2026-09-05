// Syncs the tribe roster and contribution scores from GitHub into
// src/data/tribe.json.
//
// Roster = org members (needs a token with read:org; membership is private)
//        ∪ INCLUDE, minus EXCLUDE.
// The previous checked-in roster is retained when the workflow token cannot
// see private org membership.
//
// Score = default-branch commits + merged PRs + substantive PR reviews
//       + resolved issues, using the transparent weights below.
// Contributors who are not members land in `friends` (no 3D card, just credit).
//
// Token lookup: $GITHUB_TOKEN, else `gh auth token`.

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ORG = "OogaBoogaX";
const INCLUDE = ["timechainb", "rules-without-rulers", "SaniExp"];
const EXCLUDE = ["FNBIP"];
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../src/data/tribe.json");
const SCORE_METRICS = {
  commit: { field: "commits", points: 1 },
  mergedPull: { field: "mergedPulls", points: 5 },
  review: { field: "reviews", points: 2 },
  resolvedIssue: { field: "resolvedIssues", points: 2 },
};
const SCORE_WEIGHTS = Object.fromEntries(
  Object.entries(SCORE_METRICS).map(([metric, config]) => [metric, config.points]),
);

const token = process.env.GITHUB_TOKEN || ghToken();
const headers = {
  accept: "application/vnd.github+json",
  "x-github-api-version": "2022-11-28",
  "user-agent": "oogabooga-site-sync",
  ...(token ? { authorization: `Bearer ${token}` } : {}),
};

function ghToken() {
  try {
    return execFileSync("gh", ["auth", "token"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

async function gh(path, { optional = false } = {}) {
  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (!res.ok) {
    if (optional) return null;
    throw new Error(`GET ${path} → ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function ghAll(path) {
  const out = [];
  for (let page = 1; ; page++) {
    const sep = path.includes("?") ? "&" : "?";
    const batch = await gh(`${path}${sep}per_page=100&page=${page}`);
    out.push(...batch);
    if (batch.length < 100) return out;
  }
}

async function forEachLimit(items, limit, task) {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++];
      await task(item);
    }
  });
  await Promise.all(workers);
}

const npubRe = /\bnpub1[02-9ac-hj-np-z]{58}\b/i;

function normalizeUrl(raw) {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function profile(user, activity) {
  const bio = user.bio?.trim() || null;
  return {
    login: user.login,
    id: user.id,
    name: user.name?.trim() || null,
    avatar: user.avatar_url,
    url: user.html_url,
    bio,
    location: user.location?.trim() || null,
    company: user.company?.trim() || null,
    website: normalizeUrl(user.blog),
    twitter: user.twitter_username || null,
    email: user.email || null,
    nostr: bio?.match(npubRe)?.[0] ?? null,
    followers: user.followers ?? 0,
    publicRepos: user.public_repos ?? 0,
    createdAt: user.created_at,
    score: activity.score,
    contributions: activity.contributions,
    repos: activity.repos,
  };
}

function previousMembers() {
  try {
    const previous = JSON.parse(readFileSync(OUT, "utf8"));
    return Array.isArray(previous.members) ? previous.members.map((member) => member.login) : [];
  } catch {
    return [];
  }
}

function blankRepo(name) {
  return { name, commits: 0, mergedPulls: 0, reviews: 0, resolvedIssues: 0, score: 0 };
}

function blankActivity() {
  return {
    score: 0,
    contributions: { commits: 0, mergedPulls: 0, reviews: 0, resolvedIssues: 0 },
    repos: new Map(),
  };
}

const activities = new Map();

function activityFor(login) {
  const key = login.toLowerCase();
  const current = activities.get(key) ?? { login, ...blankActivity() };
  activities.set(key, current);
  return current;
}

function credit(login, repoName, metric, amount = 1) {
  if (!login || amount <= 0) return;
  const config = SCORE_METRICS[metric];
  if (!config) throw new Error(`Unknown score metric: ${metric}`);
  const activity = activityFor(login);
  const repo = activity.repos.get(repoName) ?? blankRepo(repoName);
  activity.contributions[config.field] += amount;
  repo[config.field] += amount;
  const points = config.points * amount;
  activity.score += points;
  repo.score += points;
  activity.repos.set(repoName, repo);
}

const org = await gh(`/orgs/${ORG}`);
const repos = (await ghAll(`/orgs/${ORG}/repos?type=public`)).filter((r) => !r.archived);

for (const repo of repos) {
  const [contributors, pulls, issues] = await Promise.all([
    ghAll(`/repos/${ORG}/${repo.name}/contributors`),
    ghAll(`/repos/${ORG}/${repo.name}/pulls?state=all&sort=created&direction=asc`),
    ghAll(`/repos/${ORG}/${repo.name}/issues?state=closed&sort=created&direction=asc`),
  ]);

  for (const c of contributors) {
    if (c.type !== "User") continue;
    credit(c.login, repo.name, "commit", c.contributions);
  }

  for (const pull of pulls) {
    if (pull.merged_at && pull.user?.type === "User") credit(pull.user.login, repo.name, "mergedPull");
  }

  await forEachLimit(pulls, 8, async (pull) => {
    const reviews = await ghAll(`/repos/${ORG}/${repo.name}/pulls/${pull.number}/reviews`);
    const author = pull.user?.login.toLowerCase();
    const reviewers = new Set(
      reviews
        .filter(
          (review) =>
            review.user?.type === "User" && review.state !== "PENDING" && review.user.login.toLowerCase() !== author,
        )
        .map((review) => review.user.login.toLowerCase()),
    );
    for (const login of reviewers) credit(login, repo.name, "review");
  });

  for (const issue of issues) {
    if (!issue.pull_request && issue.user?.type === "User") credit(issue.user.login, repo.name, "resolvedIssue");
  }
}

const visibleMembers = (await ghAll(`/orgs/${ORG}/members`)).map((member) => member.login);
const roster = new Map();
for (const login of [...previousMembers(), ...visibleMembers, ...INCLUDE]) roster.set(login.toLowerCase(), login);
for (const login of EXCLUDE) roster.delete(login.toLowerCase());
const memberSet = new Set(roster.keys());
const source = visibleMembers.length ? "GitHub org members + saved roster" : "saved roster + GitHub activity";

const everyone = new Map(roster);
for (const [key, activity] of activities) everyone.set(key, activity.login);
const users = new Map();
for (const [key, login] of everyone) {
  const user = await gh(`/users/${login}`, { optional: true });
  if (user) users.set(key, user);
  else console.warn(`skip ${login}: profile not found`);
}

const byScore = (a, b) => b.score - a.score || a.login.localeCompare(b.login);
const build = (logins) =>
  logins
    .filter((login) => users.has(login))
    .map((login) => {
      const activity = activities.get(login) ?? blankActivity();
      const normalized = {
        ...activity,
        repos: [...activity.repos.values()].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)),
      };
      return profile(users.get(login), normalized);
    })
    .sort(byScore);

const data = {
  syncedAt: new Date().toISOString(),
  source,
  scoring: {
    name: "impact score",
    source: "GitHub",
    cadenceMinutes: 15,
    weights: SCORE_WEIGHTS,
  },
  org: {
    login: org.login,
    name: org.name || org.login,
    url: org.html_url,
    avatar: org.avatar_url,
    followers: org.followers,
    createdAt: org.created_at,
  },
  repos: repos.map((r) => ({
    name: r.name,
    url: r.html_url,
    homepage: normalizeUrl(r.homepage),
    description: r.description,
    stars: r.stargazers_count,
    forks: r.forks_count,
    openIssues: r.open_issues_count,
    defaultBranch: r.default_branch,
    language: r.language,
    pushedAt: r.pushed_at,
  })),
  members: build([...memberSet]),
  friends: build([...activities.keys()].filter((login) => !memberSet.has(login))),
};

const people = [...data.members, ...data.friends];
const seen = new Set();
for (const person of people) {
  const key = person.login.toLowerCase();
  if (seen.has(key)) throw new Error(`Duplicate profile in score snapshot: ${person.login}`);
  seen.add(key);

  const expected = Object.values(SCORE_METRICS).reduce(
    (sum, config) => sum + person.contributions[config.field] * config.points,
    0,
  );
  if (person.score !== expected) throw new Error(`Score mismatch for ${person.login}: ${person.score} !== ${expected}`);

  const repoTotal = person.repos.reduce((sum, repo) => sum + repo.score, 0);
  if (repoTotal !== person.score) throw new Error(`Repository score mismatch for ${person.login}`);
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(data, null, 2) + "\n");
console.log(
  `tribe.json: ${data.members.length} members (${source}), ${data.friends.length} friends, ${data.repos.length} repos${token ? "" : " [unauthenticated]"}`,
);
