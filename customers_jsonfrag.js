const nodejsonfrag = require('.');
const fs = require('fs');

function my_start_dict(ctx, key)
{
        if (nodejsonfrag.jsonfrag_is(ctx, ["customers", null]))
        {
                nodejsonfrag.jsonfrag_start_fragment_collection(ctx);
        }
}
function my_end_dict(ctx, key, n)
{
        if (nodejsonfrag.jsonfrag_is(ctx, ["customers", null]))
        {
                console.log("id " + n.id);
                console.log("account count " + n.accountCount);
                console.log("total balance " + n.totalBalance);
                console.log("name " + n.name);
        }
}
const fraghandler = {
        'start_dict': my_start_dict,
        'end_dict': my_end_dict,
};

async function handleJson() {
  const ctx = nodejsonfrag.jsonfrag_new(fraghandler);
  const stream = fs.createReadStream('customers.json', {encoding: 'utf8'});
  for await (const chunk of stream)
  {
    nodejsonfrag.jsonstream_feed(ctx, chunk, 0, chunk.length, false);
  }
  nodejsonfrag.jsonstream_feed(ctx, '', 0, 0, true);
  console.log('STREAM HANDLED');
}

handleJson();
