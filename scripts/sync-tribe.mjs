// Syncs the tribe roster from GitHub into src/data/tribe.json.
//
// Roster = org members (needs a token with read:org; membership is private)
//        ∪ INCLUDE, minus EXCLUDE.
// Without a token the members endpoint is empty, so we fall back to
// everyone who contributed to an org repo.
//
// Contributors who are not members land in `friends` (no 3D card, just credit).
//
// Token lookup: $GITHUB_TOKEN, else `gh auth token`.

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ORG = "OogaBoogaX";
const INCLUDE = ["timechainb", "rules-without-rulers", "SaniExp"];
const EXCLUDE = [];
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../src/data/tribe.json");

const token = process.env.GITHUB_TOKEN || ghToken();
const headers = {
  accept: "application/vnd.github+json",
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

const npubRe = /\bnpub1[02-9ac-hj-np-z]{58}\b/i;

function normalizeUrl(raw) {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function profile(user, bananas, repos) {
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
    bananas,
    repos,
  };
}

const org = await gh(`/orgs/${ORG}`);
const repos = (await ghAll(`/orgs/${ORG}/repos?type=public`)).filter((r) => !r.archived);

// login → { bananas, repos[] }
const contributions = new Map();
for (const repo of repos) {
  const list = await ghAll(`/repos/${ORG}/${repo.name}/contributors`);
  for (const c of list) {
    if (c.type !== "User") continue;
    const entry = contributions.get(c.login) ?? { bananas: 0, repos: [] };
    entry.bananas += c.contributions;
    entry.repos.push(repo.name);
    contributions.set(c.login, entry);
  }
}

let members = (await ghAll(`/orgs/${ORG}/members`)).map((m) => m.login);
let source = "org members";
if (members.length === 0) {
  members = [...contributions.keys()];
  source = "contributors (no read:org token)";
}
const memberSet = new Set([...members, ...INCLUDE].filter((l) => !EXCLUDE.includes(l)));

const everyone = new Set([...memberSet, ...contributions.keys()]);
const users = new Map();
for (const login of everyone) {
  const user = await gh(`/users/${login}`, { optional: true });
  if (user) users.set(login, user);
  else console.warn(`skip ${login}: profile not found`);
}

const byBananas = (a, b) => b.bananas - a.bananas || a.login.localeCompare(b.login);
const build = (logins) =>
  logins
    .filter((l) => users.has(l))
    .map((l) => {
      const c = contributions.get(l) ?? { bananas: 0, repos: [] };
      return profile(users.get(l), c.bananas, c.repos);
    })
    .sort(byBananas);

const data = {
  syncedAt: new Date().toISOString(),
  source,
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
  friends: build([...contributions.keys()].filter((l) => !memberSet.has(l))),
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(data, null, 2) + "\n");
console.log(
  `tribe.json: ${data.members.length} members (${source}), ${data.friends.length} friends, ${data.repos.length} repos${token ? "" : " [unauthenticated]"}`,
);
