// One-Liner Marathon entry writer — program/v1, Node 22, standard library only.
//
// Writes a single original joke to $MAKEFUN_OUTPUT_DIR/entry.txt
// (or /output/entry.txt when the variable is unset), then reads the file
// back and proves the bytes on disk are exactly the bytes we meant to
// write. No network, no dependencies, no secrets.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// The joke: a screen-time report reframed as a romance stat. The setup is
// a boring phone-usage number; the punchline turns it into a confession
// that the phone has seen more eye contact this year than any person has.
const JOKE =
  "My screen-time report says I spent six hours staring at my phone today, which is the most eye contact I've had in any relationship this year.";

// The gate, as the competition states it: 1–280 characters, one line,
// not only white space, exactly one sentence.
const RULES = {
  minChars: 1,
  maxChars: 280,
  sentences: 1,
  outputFile: "entry.txt",
  fallbackDir: "/output",
} as const;

interface Problem {
  check: string;
  detail: string;
}

// Every check reports its own problem instead of bailing at the first
// failure, so a broken entry tells you everything wrong with it at once.
function collectProblems(text: string): Problem[] {
  const problems: Problem[] = [];
  // Count code points, not UTF-16 units, so the length we report is the
  // length a reader (and the gate) sees.
  const chars = [...text];

  if (text.includes("\n") || text.includes("\r")) {
    problems.push({
      check: "single line",
      detail: "contains a line break",
    });
  }
  if (chars.length < RULES.minChars || chars.length > RULES.maxChars) {
    problems.push({
      check: "length",
      detail: `must be ${RULES.minChars} to ${RULES.maxChars} characters, got ${chars.length}`,
    });
  }
  if (text.trim().length === 0) {
    problems.push({ check: "non-blank", detail: "must not be only white space" });
  }
  if (text !== text.trim()) {
    problems.push({
      check: "no padding",
      detail: "must not start or end with white space",
    });
  }
  // Invisible control characters would survive a printout and still fail
  // the gate, so catch them here instead of after submission.
  if (/[\u0000-\u001f\u007f]/.test(text)) {
    problems.push({
      check: "printable",
      detail: "contains a control character",
    });
  }
  const stops = chars.filter((ch) => ch === ".").length;
  if (stops !== RULES.sentences || !text.endsWith(".")) {
    problems.push({
      check: "one sentence",
      detail: `must be exactly one sentence ending in a full stop, found ${stops} full stop(s)`,
    });
  }
  return problems;
}

function fail(problems: Problem[]): never {
  const lines = problems.map((p) => `  - ${p.check}: ${p.detail}`);
  throw new Error(`entry rejected (${problems.length} problem(s)):\n${lines.join("\n")}`);
}

function main(): void {
  const problems = collectProblems(JOKE);
  if (problems.length > 0) {
    fail(problems);
  }

  const words = JOKE.trim().split(/\s+/).length;
  const bytes = Buffer.byteLength(JOKE, "utf8");
  console.log(`joke: ${JOKE}`);
  console.log(`size: ${[...JOKE].length} characters, ${words} words, ${bytes} bytes`);

  const folder = process.env.MAKEFUN_OUTPUT_DIR ?? RULES.fallbackDir;
  mkdirSync(folder, { recursive: true });
  const target = join(folder, RULES.outputFile);
  writeFileSync(target, JOKE, "utf8");

  // Read it back as raw bytes: the file must be byte-for-byte the joke,
  // not merely the same string after a lossy round-trip.
  const onDisk = readFileSync(target);
  if (!onDisk.equals(Buffer.from(JOKE, "utf8"))) {
    throw new Error(`entry rejected: round-trip mismatch in ${target}`);
  }
  console.log(`wrote ${target} (${[...JOKE].length} characters, verified byte-for-byte)`);
}

main();
