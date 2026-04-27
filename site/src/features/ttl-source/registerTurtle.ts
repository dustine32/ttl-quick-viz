/**
 * Register a Turtle grammar on `prism-react-renderer`'s bundled Prism so
 * `<Highlight language="turtle">` produces colored tokens.
 *
 * The grammar covers the things a debugger actually wants to distinguish
 * at a glance: comments, string literals (single + multi-line), IRIs in
 * `<...>` form, prefixed names (`ex:foo`), `@prefix`/`@base`/`a` keywords,
 * numbers, booleans, and structural punctuation. It is not a complete
 * Turtle 1.1 grammar — escapes inside strings, language tags, and
 * datatype suffixes are intentionally simplified. Phase 5's N3.js path
 * would replace this entirely if line-precision becomes mandatory.
 */
import { Prism } from 'prism-react-renderer';

type PrismLanguages = Record<string, unknown>;

(Prism.languages as PrismLanguages).turtle = {
  comment: {
    pattern: /#.*/,
    greedy: true,
  },
  'multiline-string': {
    pattern: /"""[\s\S]*?"""/,
    greedy: true,
    alias: 'string',
  },
  string: {
    pattern: /"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'/,
    greedy: true,
  },
  url: {
    pattern: /<[^<>"{}|^`\\\s]*>/,
    alias: 'url',
    inside: {
      punctuation: /^<|>$/,
    },
  },
  'prefixed-name': {
    pattern: /(?:[A-Za-z][\w-]*)?:(?:[A-Za-z_][\w-]*)?/,
    alias: 'function',
  },
  boolean: /\b(?:true|false)\b/,
  number: /[+-]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/,
  keyword: /@base\b|@prefix\b|(?<![\w-])a(?![\w-])/,
  punctuation: /[(){}.;,[\]]/,
  operator: /\^\^/,
};

(Prism.languages as PrismLanguages).ttl = (Prism.languages as PrismLanguages).turtle;
