import { Content, frontmatter, rawContent, getHeadings } from "@/data/manifesto.md";
import { formatDate } from "@/lib/tribe";

interface Frontmatter {
  title: string;
  subtitle: string;
  description: string;
  author: string;
  authorHandle: string;
  date: string;
}

const fm = frontmatter as Frontmatter;
const body = rawContent();

// Prose only: drop raw HTML blocks (figures, message box) and heading markers before counting.
const prose = body.replace(/<[^>]+>/g, " ").replace(/^#+\s+/gm, "");
const words = prose.split(/\s+/).filter(Boolean).length;
const minutes = Math.max(1, Math.round(words / 220));

const firstParagraph = body.split(/\n\s*\n/).find((block) => block.trim() && !/^[<#]/.test(block.trim())) ?? "";
const sentences = firstParagraph.trim().split(/(?<=[.!?])\s+/);
const excerpt = `${sentences.slice(0, 2).join(" ")}${sentences.length > 2 ? " …" : ""}`;

export const manifesto = {
  ...fm,
  path: "/manifesto/",
  dateLabel: formatDate(`${fm.date}T12:00:00`),
  words,
  minutes,
  opening: firstParagraph.trim(),
  excerpt,
  headings: getHeadings().filter((h) => h.depth === 2),
  Content,
};
