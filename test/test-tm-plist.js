const raw = String.raw
const log = console.log.bind (console)
const { parse, Lexer } = require ('../lib/tm-plist')

var sample = '( 1 , 2 , 3 )'
var sample = raw `
{
  a1 = 1; f="fo\"o";
  b = :true;
  c = (1,2,3);
  c=(2,4,5); d=<20adFde> 
}`

var sample = `{
  key1 = 1;
  key2 = 2;
  array = (4, :true, 5, 6)
}
`

//* Quick test lexer
log (sample)


const toks = Lexer.tokens (sample)
for (let t of toks)
  log (t, toks.state)

//*/

//* Quick test parser
const util = require ('util')

log (
  util.inspect(parse (sample), { depth:100 })
)

//*/
