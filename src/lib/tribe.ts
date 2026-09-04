import data from "@/data/tribe.json";

export interface Member {
  login: string;
  id: number;
  name: string | null;
  avatar: string;
  url: string;
  bio: string | null;
  location: string | null;
  company: string | null;
  website: string | null;
  twitter: string | null;
  email: string | null;
  nostr: string | null;
  followers: number;
  publicRepos: number;
  createdAt: string;
  bananas: number;
  repos: string[];
}

export interface Repo {
  name: string;
  url: string;
  homepage: string | null;
  description: string | null;
  stars: number;
  forks: number;
  openIssues: number;
  defaultBranch: string;
  language: string | null;
  pushedAt: string;
}

export const tribe = data;
export const members: Member[] = data.members;
export const friends: Member[] = data.friends;
export const repos: Repo[] = data.repos;
export const org = data.org;

export const totalBananas = [...members, ...friends].reduce((n, m) => n + m.bananas, 0);

export const RANKS = [
  { min: 200, name: "silverback", blurb: "carries the tribe on their back" },
  { min: 100, name: "alpha", blurb: "ships before the space ends" },
  { min: 30, name: "hunter", blurb: "brings back code most nights" },
  { min: 10, name: "fire keeper", blurb: "keeps the repo warm" },
  { min: 1, name: "rock thrower", blurb: "first commit landed on rock" },
  { min: 0, name: "cave guest", blurb: "in the cave, sharpening a spear" },
] as const;

export type Rank = (typeof RANKS)[number];

export function rankOf(bananas: number): Rank {
  return RANKS.find((r) => bananas >= r.min) ?? RANKS[RANKS.length - 1];
}

export function displayName(m: Pick<Member, "name" | "login">): string {
  return m.name ?? m.login;
}

export function avatarUrl(m: Pick<Member, "avatar">, size: number): string {
  const url = new URL(m.avatar);
  url.searchParams.set("s", String(size));
  return url.toString();
}

export function memberPath(m: Pick<Member, "login">): string {
  return `/tribe/${m.login.toLowerCase()}/`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}
