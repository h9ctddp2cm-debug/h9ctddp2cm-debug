#!/usr/bin/env node
/**
 * Generates a strong, human-usable shared passcode for the research backend and
 * writes ONLY a slow salted scrypt hash to server/auth.config.json.
 *
 * The plaintext passcode is printed to stdout exactly once and is never written
 * to any file in this repository. Capture it from the terminal and distribute it
 * out of band. Re-running this script invalidates the previous passcode.
 *
 * Usage: node server/generate-passcode.mjs
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(HERE, 'auth.config.json');

// 128-word list (7 bits/word): short, unambiguous, easy to dictate over the phone.
const WORDS = `harbour lantern copper tidal meadow granite willow cobalt saffron ember
falcon pebble marble juniper cedar quartz amber lagoon summit orchid
bamboo cinder violet compass anchor cricket walnut basalt mango pelican
kettle ribbon almond glacier cactus dolphin thistle beacon canyon feather
hazel indigo jasper kelp lilac mosaic nectar opal papyrus quiver
ripple sable tulip umber velvet wombat xenon yarrow zephyr acorn
bluff clover dune elder fjord grotto hollow inlet jetty knoll
ledge marsh nook oasis prairie quarry reef steppe tundra vale
wharf yonder alcove bridge citrus domino echo fable garnet heron
ivory jungle kayak lotus mantis nutmeg oyster pumice quail rattan
silver tandem urchin vector walrus yeast zircon apron bison crater
dahlia eagle fennel gable hammock iris jackal kernel lattice
mallet nimbus oracle plumage quilt rustic sonnet timber upland`
  .split(/\s+/)
  .filter(Boolean);

if (WORDS.length < 128) throw new Error(`word list too small: ${WORDS.length}`);
const LIST = WORDS.slice(0, 128);
const B32 = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Crockford-ish, no ambiguous chars

function pick(alphabet) {
  return alphabet[crypto.randomInt(0, alphabet.length)];
}

function titled(word) {
  return word[0].toUpperCase() + word.slice(1);
}

function generatePasscode() {
  const words = Array.from({ length: 4 }, () => titled(LIST[crypto.randomInt(0, LIST.length)]));
  const suffix = Array.from({ length: 5 }, () => pick(B32)).join('');
  return `${words.join('-')}-${suffix}`;
}

const SCRYPT_PARAMS = { N: 1 << 15, r: 8, p: 1, keylen: 32, maxmem: 96 * 1024 * 1024 };

export function hashPasscode(passcode, saltHex, params = SCRYPT_PARAMS) {
  const salt = Buffer.from(saltHex, 'hex');
  return crypto
    .scryptSync(passcode.normalize('NFKC'), salt, params.keylen, {
      N: params.N,
      r: params.r,
      p: params.p,
      maxmem: params.maxmem,
    })
    .toString('hex');
}

function main() {
  const passcode = generatePasscode();
  const saltHex = crypto.randomBytes(16).toString('hex');
  const hashHex = hashPasscode(passcode, saltHex);
  const config = {
    algorithm: 'scrypt',
    createdAt: new Date().toISOString(),
    note: 'Plaintext passcode is intentionally absent. Regenerate with server/generate-passcode.mjs.',
    params: { N: SCRYPT_PARAMS.N, r: SCRYPT_PARAMS.r, p: SCRYPT_PARAMS.p, keylen: SCRYPT_PARAMS.keylen, maxmem: SCRYPT_PARAMS.maxmem },
    saltHex,
    hashHex,
  };
  fs.writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`);
  process.stdout.write(
    `Wrote ${path.relative(process.cwd(), CONFIG_PATH)} (hash only).\n` +
      `ONE-TIME PLAINTEXT PASSCODE (not stored anywhere): ${passcode}\n`
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
