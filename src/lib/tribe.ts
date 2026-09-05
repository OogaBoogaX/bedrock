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
  score: number;
  contributions: ContributionTotals;
  repos: RepoContribution[];
}

export interface ContributionTotals {
  commits: number;
  mergedPulls: number;
  reviews: number;
  resolvedIssues: number;
}

export interface RepoContribution extends ContributionTotals {
  name: string;
  score: number;
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
export const scoring = data.scoring;

export const totalScore = [...members, ...friends].reduce((total, member) => total + member.score, 0);

export const RANKS = [
  { min: 500, name: "silverback", blurb: "sustained impact across the caves" },
  { min: 200, name: "cave architect", blurb: "ships and helps others ship" },
  { min: 75, name: "fire keeper", blurb: "keeps the repositories moving" },
  { min: 20, name: "rock shaper", blurb: "turns ideas into merged work" },
  { min: 1, name: "contributor", blurb: "made a verified GitHub contribution" },
  { min: 0, name: "cave guest", blurb: "in the cave, sharpening a spear" },
] as const;

export type Rank = (typeof RANKS)[number];

export function rankOf(score: number): Rank {
  return RANKS.find((rank) => score >= rank.min) ?? RANKS[RANKS.length - 1];
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

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}
