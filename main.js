const jsonstream = require('./nodejsonstream');
const fs = require('fs');

handler = {
};
ctx = jsonstream.jsonstream_new(handler);
jsonstream.jsonstream_allow_comments(ctx);
//buf = fs.readFileSync('pp.json', 'utf8');
buf = "//foo\n /* fof */ { //bar\n  \"foo\": [1 //baz\n, /*2,*/ 3 //quux\n], \"bar\": 4, \"baz\": {}, \"barf\": []   , \"quux\": [true, false, null]  } // endcomment";
console.log(jsonstream.jsonstream_is_valid_json(buf, true));
jsonstream.jsonstream_feed(ctx, buf, 0, buf.length, true);
