const TinyLexer = require ('./parsetools/tinylexer')
const TreeBuilder = require ('./parsetools/treebuilder')
const { setPrototypeOf: setProto } = Object
const log = console.log.bind (console)
const raw = String.raw


// TextMate Plist Parser
// =====================

function* ids (a, z = Infinity) { while (a <= z) yield a++<<3 }

// ### Types and Roles

// Using ints as token identifiers.
// The three low bits are used for the role, being Start / End / Skip.
// The rest is used for the type.

const [ARRAY, DICT, DATA, CHARS, STRING, KEY, COMMENT, HEXINT, INT, FLOAT, BOOL, DATE, ESC, EQ, SEP, SPACE, NEWLINE] = ids (1)
const [Start, End, Skip] = [1, 2, 4]

const roleMask = 0b111
const typeMask = ~roleMask

// ### Grammar

const dateExp   = raw `@[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2} \+[0-9]{4}`
const keyExp    = raw `[a-zA-Z0-9_$+/.\-]+` // NB allows leading digits and digit-only keys
const spaceExp  = raw `[ \t\n\r]+`
const stringExp = raw `"[^"]*"`

// TODO
// Properly parse string-valued keys
// Support multiline comments /* */
// Try to find out which escape sequences are used in double quoted strings

const spaceRules = [
  [ '\n\r?',  newline ],
  [ spaceExp, SPACE|Skip ],
  [ raw `[/][/][^\n]*`, COMMENT|Skip ],
  // [ raw `/\*`, 'comment-start', 'comment' ],
]

const grammar = {

  main: [
    ...spaceRules,

    [ raw `\(`,  ARRAY|Start, open ('array') ],
    [ raw `\{`,   DICT|Start, open  ('dict') ],
    [ `<`,        DATA|Start,        'data'  ],
    [ `"`,      STRING|Start,      'string'  ],
    [ `'`,      STRING|Start,     'sstring'  ],

    [ raw `[+\-]?0x[0-9a-fA-F]+`, HEXINT, afterValue ],
    [ raw `[+\-]?(?:0x)?[0-9]+`,  INT,    afterValue ],
    [ raw `-?[0-9]*\.[0-9]+`,     FLOAT,  afterValue ],
    [ raw `:true\b|:false\b`,     BOOL,   afterValue ],
    [ dateExp,                    DATE,   afterValue ]],

  data: [
    ...spaceRules,
    ['[0-9a-fA-F]{1,8}', DATA,       'data'    ],
    ['>',                DATA|End,  afterValue ]],

  string: [
    [raw `[^"\\]+`,       CHARS,      'string'   ],
    [raw `\\["\\/bfnrt]`, ESC,          'string' ],
    ['"',                 STRING|End, afterValue ]],

  // single quoted strings are verbatim, without escape sequences,
  // except for the single quote itself which is escaped by doubling it. 

  sstring: [
    [raw `[^'\\]+`, CHARS,       'sstring' ],
    [raw `''`,      ESC,         'sstring' ],
    ["'",           STRING|End, afterValue ]], 

  arrayTail: [
    ...spaceRules,
    [ raw `,`,     SEP|Skip, 'afterComma' ],
    [ raw `\)`,  ARRAY|End,   close       ]],

  afterComma: [ // one trailing comma allowed
    ...spaceRules,
    [ raw `,`,      SEP|Skip, 'arrayEnd' ],
    [ raw `\)`,   ARRAY|End,   close     ],
    [ raw `.{0}`, SPACE|Skip, 'main'     ]],

  arrayEnd: [
    ...spaceRules,
    [ raw `\)`, ARRAY|End,  close ]],

  dictTail: [
    ...spaceRules,
    [ raw `;`,   SEP|Skip, 'beforeKey' ],
    [ raw `\}`, DICT|End,   close      ]], // TODO require exactly one trailing semicolon

  beforeKey: [
    ...spaceRules,
    [ keyExp,    KEY,       'afterKey' ],
    [ stringExp, KEY,       'afterKey' ], // TODO interpret key-strings
    [ raw `\}`,  DICT|End,   close     ]],

  afterKey: [
    ...spaceRules,
    [ '=', EQ|Skip, 'main' ]],

  end: [
    ...spaceRules ]
}


// Lexer
// -----

// The Lexer class wraps a TinyLexer, using the grammar above,
// and keeps track of a bit of additional state.

class Lexer {

  constructor () {
    this.stack = []
    this.line = 1
    this.lastNewline = 0
  }

  static tokens (input) {
    const l = new Lexer ()
    const _stream = new TinyLexer (grammar, 'main', l) .tokenize (input)

    const stream = (function* () {
      try { yield* _stream }
      catch (e) { 
        const { line, column } = l.info
        throw new SyntaxError (`tm-plist.parse: error at line ${line}:${column}`)
      }})()
    return Object.defineProperty (stream, 'state', { get:$=>l.info })
  }

  get info () {
    return { line:this.line, column:this.position - this.lastNewline }
  }

}

// It uses the following additional methods to modify the state.
// These are called by the TinyLexer with `this` bound to the Lexer object. 

function afterValue () {
  const l = this.stack.length
  return l ? this.stack[l-1] : 'end'
}

function open (tag) { return function () {
  this.stack.push (tag + 'Tail')
  return tag === 'dict' ? 'beforeKey' : 'main'
}}

function close () {
  this.stack.pop ()
  const l = this.stack.length
  return l ? this.stack[l-1] : 'end'
}

function newline () { // token with side effect
  this.lastNewline = this.position + 1 // +1 for the '\n' itself
  this.line++
  return NEWLINE|Skip
}


// Parser
// ------

// The parser is implemented as a configuration for
// my generic TreeBuilder component.

const { START, END, SKIP } = TreeBuilder.constants
const _tb = { [Start]:START, [End]:END, [Skip]:SKIP }

function tokenInfo ([type, value]) {
  const role = _tb [type & roleMask]
  return [role, type & typeMask]
}

const _escape = ([_,c]) =>
    c === 'n' ? '\n'
  : c === 'b' ? '\b'
  : c === 'f' ? '\f'
  : c === 'r' ? '\r'
  : c === 't' ? '\t'
  : c

const handlers = {
  [ARRAY]:  { start: () => [] },
  [DICT]:   { start: () => [] },
  [INT]:    { eval: v => parseInt (v) },
  [HEXINT]: { eval: v => parseInt (v, 16) },
  [FLOAT]:  { eval: v => parseFloat (v) },
  [BOOL]:   { eval: _ => _ === ':true' ? true : false },
  [STRING]: { eval: _ => _.content.join ('') },
  // key:   { eval: _ => _ },
  [CHARS]:  { eval: _ => _ },
  [ESC]:    { eval:_escape },
  // date // TODO
  // data // TODO
}


function parse (input) {
  let key
  const _handlers = setProto ({ [DICT]: { start:() => ({}), push:_set }}, handlers);
  const tb = new TreeBuilder (tokenInfo, _handlers)
  for (let t of Lexer.tokens (input)) tb.write (t)
  return tb.root.content[0]

  function _set (n, [t,v]) {
    if (t === KEY) key = v[1]
    else n [key] = v
  }

}


// Exports
// -------

module.exports = { parse, Lexer }