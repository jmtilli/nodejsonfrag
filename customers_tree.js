import * as nodejsonfrag from './index.js';
import * as fs from 'fs';

var buf = fs.readFileSync('customers.json', 'utf8');
console.log(nodejsonfrag.jsonstream_tree_parse(buf));
