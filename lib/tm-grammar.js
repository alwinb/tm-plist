
// TextMate Grammar
// ================

// A basic object model for TextMate Grammars


// Grammar
// -------

function Grammar (dict) {
  this.comment            = dict.comment
  this.name               = dict.name
  this.uuid               = dict.uuid
  this.fileTypes          = dict.fileTypes
  this.firstLineMatch     = dict.firstLineMatch
  this.keyEquivalent      = dict.keyEquivalent
  this.scopeName          = dict.scopeName
  this.firstLineMatch     = dict.firstLineMatch
  this.foldingStartMarker = dict.foldingStartMarker
  this.foldingStopMarker  = dict.foldingStopMarker
  this.patterns           = new RuleSet (dict.patterns)
  this.repository         = new Repository (dict.repository)
}


// Module
// ------

function Module (name, dict = { }) {
  this.name       = name // key-name
  this.patterns   = new RuleSet (dict.patterns)
  this.repository = new Repository (dict.repository)
}


// Repository
// ----------

// A Repository is a collection of key-value pairs where the values
// are either a single rule or a module. At the moment, I always wrap
// single rules in a module. 

class Repository extends Map {
  constructor (dict = { }) {
    super ()
    for (let k in dict) {
      const item = 'patterns' in dict[k] ? dict[k] : { patterns: [ dict[k] ] }
      this.set (k, new Module (k, item))
    }
  }
}


// RuleSet
// -------

class RuleSet extends Array {
  constructor (array = []) {
    super ()
    array .forEach ((dict, i) => this[i] = _rule (dict))
  }
}

// helpers

function _rule (dict) {
  if ('match' in dict && 'captures' in dict)
    return new CompoundRule ({ ...dict, captures: _captures (dict.captures) })

  else if ('match' in dict)
    return new SimpleRule (dict)

  else if ('begin' in dict) {
    const { comment, name, contentName, patterns, include } = dict
    const beginCaptures = _captures (dict.beginCaptures || dict.captures)
    const endCaptures   = _captures (dict.endCaptures || dict.captures)
    const begin         = new Rule ({ match:dict.begin, captures:beginCaptures , _type:'BEGIN' })
    const end           = new Rule ({ match:dict.end, captures:endCaptures, _type:'END' })
    return new BeginEndRule (dict)
  }

  else if ('include' in dict)
    return new IncludeRule (dict.include)

  else
    throw new Error ('Cannot create rule; invalid argument')
}

function _captures (obj) {
  if (obj == null) return
  const r =  []
  for (let [k,v] of Object.entries (obj)) r [+k - 1] = v.name
  return r
}


// Rules
// -----

function IncludeRule (name) {
  this.name = name
}

function Rule ({ match, captures = [], _type, comment}) {
  if (comment) this.comment = comment
  this.match = match
  this.captures = captures // just an array of names
  this._type = _type // 
}

function SimpleRule ({ comment, name, match }) {
  if (comment) this.comment = comment
  if (!name) throw new Error ('SimpleRule constructor called on a dict without a name attribute')
  this.name = name // should not be null
  this.match = match
}

function CompoundRule ({ comment, name, match, captures }) {
  if (comment) this.comment = comment
  this.name = name
  this.match = match
  this.captures = captures // just an array of names
}

// Begin/ End Rules

class BeginEndRule {

  constructor (dict) {
    this._dict = dict  // backing store
    const { comment, name, contentName, include } = dict // TODO include??

    if (comment) this.comment = comment
    this.name = name
    this.contentName = contentName

    this.patterns = new RuleSet (dict.patterns)
    this._begin = null // cached getter
    this._end = null // cached getter
  }

  // Q: Can BeginEndRules have Repositories?

  get begin () {
    if (this._begin) return this._begin
    let beginCaptures = _captures (this._dict.beginCaptures || this._dict.captures)
    this._begin = new Rule ({ match:this._dict.begin, captures:beginCaptures, _type:'BEGIN' })
    return this._begin
  }

  get end () {
    if (this._end) return this._end
    let endCaptures = _captures (this._dict.endCaptures || this._dict.captures)
    this._end = new Rule ({ match:this._dict.end, captures:endCaptures, _type:'END' })
    return this._end
  }

}

// TODO There are also begin/ while rules.
// These are used in the Markdown grammar. 


// Exports
// -------

module.exports = { Grammar, Repository, Module, Rule, BeginEndRule, IncludeRule, SimpleRule, CompoundRule }