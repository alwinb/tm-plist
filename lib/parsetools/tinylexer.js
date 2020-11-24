// The compiler and runtime
// ------------------------

function State (table, name) {
  this.name = name
  this.regex = new RegExp ('(' + table.map (fst) .join (')|(') + ')', 'sgy')
  this.edges = table.map (compileRow (name))
}

function compile (grammar) {
  const compiled = {}
  for (let state_name in grammar)
    compiled [state_name] = new State (grammar [state_name], state_name)
  return compiled
}

function fst (row) {
  return Array.isArray (row) ? row [0] || '.{0}'
    : 'if' in row ? row.if : '.{0}'
}

function compileRow (symbol) {
  return function (row) {
    let r, emit, goto
    if (Array.isArray) [r = '.{0}', emit, goto = symbol] = row
    else ({ if:r = '.{0}', emit, goto = symbol } = row )
    const g = typeof goto === 'function' ? goto : (symbol, data) => goto
    const e = typeof emit === 'function' ? wrapEmit (emit) : (symbol, data) => [emit, data]
    return { emit:e, goto:g }
  }
}

function wrapEmit (fn) { return function (type, data) {
  return [fn.call (this, type, data), data]
}}


// The Lexer runtime
// -----------------

function TinyLexer (grammar, start, thisArg = { }) {
  const states = compile (grammar)

  this.tokenize = function (input, position = 0, symbol = start) {
    Object.assign (thisArg, { input, position, symbol })
    const stream = tokenize (input, thisArg, position, symbol)
    stream.state = thisArg
    return stream
  }

  function *tokenize (input, thisArg, position, symbol) {
    input = String (input)
    do if (!(symbol in states))
      throw new Error (`Lexer: no such symbol: ${symbol}.`)

    else {
      const state = states [symbol]
      const regex = state.regex
      const match = (regex.lastIndex = position, regex.exec (input))

      if (!match) {
        if (position !== input.length)
          throw new SyntaxError (`Lexer: invalid input at index ${position} in state ${symbol} before ${input.substr (position, 80)}`)
        return
      }

      let i = 1; while (match [i] == null) i++
      const edge = state.edges [i-1]
      const token = edge.emit.call (thisArg, symbol, match[i])
      symbol = edge.goto.call (thisArg, symbol, match[i])
      position = regex.lastIndex
      Object.assign (thisArg, { symbol, position })
      yield token
    }

    while (position <= input.length)
  }
}

module.exports = TinyLexer