const nodejsonfrag = require('.');
const fs = require('fs');

buf = fs.readFileSync('customers.json', 'utf8');
console.log(nodejsonfrag.jsonstream_tree_parse(buf));
