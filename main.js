const jsonstream = require('.');
const fs = require('fs');

handler = {
};
ctx = jsonstream.jsonstream_new(handler);
jsonstream.jsonstream_allow_comments(ctx);
jsonstream.jsonstream_allow_trailing_comma(ctx);
//buf = fs.readFileSync('pp.json', 'utf8');
buf = "//foo\n /* fof */ { //bar\n  \"foo\": [1 //baz\n, /*2,*/ 3 //quux\n], \"bar\": 4, \"baz\": {}, \"barf\": []   , \"quux\": [true, false, null,],  } // endcomment";
console.log(jsonstream.jsonstream_is_valid_json(buf, true, true));
console.log(jsonstream.jsonstream_feed(ctx, buf, 0, buf.length, false));
console.log(jsonstream.jsonstream_feed(ctx, '  ', 0, '  '.length, true));
console.log(jsonstream.jsonstream_tree_parse(buf, true, true));

console.log(jsonstream.jsonout_stringify(false, 4, jsonstream.jsonstream_tree_parse(buf, true, true)));
console.log(jsonstream.jsonout_stringify(false, 4, new String("foo")));
console.log(jsonstream.jsonout_stringify(false, 4, new Number(2)));
console.log(jsonstream.jsonout_stringify(false, 4, new Boolean(true)));
