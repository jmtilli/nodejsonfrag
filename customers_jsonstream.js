const nodejsonfrag = require('.');
const fs = require('fs');

var context = [];
var c = {};
var cs = {};
handler = {
  start_dict: function(ctx, key)
  {
    context.push(key);
    if (context.length == 3 && context[0] == null && context[1] == "customers" && context[2] == null)
    {
      c = {};
    }
  },
  end_dict: function(ctx, key)
  {
    context.pop();
  },
  start_array: function(ctx, key)
  {
    context.push(key);
  },
  end_array: function(ctx, key)
  {
    context.pop();
  },
  handle_string: function(ctx, key, val)
  {
    if (key == "name")
    {
      c.name = val;
    }
  },
  handle_number: function(ctx, key, num, is_integer)
  {
    if (key == "id")
    {
      c.id = num;
      cs[String(c.id)] = c;
    }
    else if (key == "accountCount")
    {
      c.accountCount = num;
    }
    else if (key == "totalBalance")
    {
      c.totalBalance = num;
    }
  }
};

async function handleJson() {
  const ctx = nodejsonfrag.jsonstream_new(handler);
  const stream = fs.createReadStream('customers.json', {encoding: 'utf8'});
  for await (const chunk of stream)
  {
    nodejsonfrag.jsonstream_feed(ctx, chunk, 0, chunk.length, false);
  }
  nodejsonfrag.jsonstream_feed(ctx, '', 0, 0, true);
  console.log('STREAM HANDLED');
  console.log(cs);
}

handleJson();
