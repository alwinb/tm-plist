# TextMate Plists

A library for parsing the [property list][plist] file format that is used by the TextMate code editor. TextMate uses a format that is extremely close to so called 'old-style' property lists, aka. ASCII property lists, but there are a few small differences. 

The library also contains a basic object model for TextMate grammars. 

[plist]: https://en.wikipedia.org/wiki/Property_list


## API

A single function `parse` that takes a string and returns an object. 

```javascript
const tmplist = require ('tm-plist')

var sample = `{
  key1 = 1;
  key2 = 2;
  array = (4, :true, 5, 6)
}
`
console.log (tmplist.parse (sample))
```

## File format

The partial grammar below was found in the TextMate source code [here][source]. Additional information was found in the TextMate 1 documentation [here][tm1].

The last however implies that unquoted keys cannot start with leading digits even though this does happen in practice. (For example, capture names in TextMate grammar files are stored as dicts with numeric keys.) 

The NeXTSTEP format allowed unquoted strings with characters in the set `[a-zA-Z0-9_$+/:.\-]`. This must be different from the TextMate format because TextMate uses `:true` and `:false` as booleans. This library allows unquoted strings with characters in the set `[a-zA-Z0-9_$+/.\-]`. 

```
array:    '(' (element ',')* (element)? ')'
dict:     '{' (key '=' value ';')* '}'
integer:  ('-'|'+')? ('0x'|'0')? [0-9]+
float:    '-'? [0-9]* '.' [0-9]+
boolean:  :true | :false
string:   ["] … ["] | ['] … ['] | [a-zA-Z_-]+
data:     <DEADBEEF>
date:     @2010-05-10 20:34:12 +0000
```


[source]: https://github.com/textmate/textmate/blob/master/Frameworks/plist/src/ascii.rl
[tm1]: https://macromates.com/manual/en/appendix#property_list_format


## Licence

MIT. Enjoy!