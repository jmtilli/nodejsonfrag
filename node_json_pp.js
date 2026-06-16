const nodejsonfrag = require('.');
const fs = require('fs');

var args = process.argv.slice(2);
var commentargcnt = 0;
var input_trailing_comma = false;
var use_tabs_for_indentation = false;
var nopretty = false;
var indentation_level = -1; // nonnegative integer or null

function usage()
{
  console.error("Usage: node node_json_pp.js [-t] [-n] [-C [-C]] [-c count]");
  process.exit(1);
}

for (var i = 0; i < args.length; i++)
{
  var arg = args[i];
  if (arg == "--")
  {
    if (i != args.length-1)
    {
      usage();
    }
    break;
  }
  else if (arg == "-C")
  {
    commentargcnt++;
  }
  else if (arg == "-T")
  {
    input_trailing_comma = true;
  }
  else if (arg == "-t")
  {
    use_tabs_for_indentation = true;
  }
  else if (arg == "-n")
  {
    nopretty = true;
  }
  else if (arg == "-c")
  {
    i++;
    indentation_level = Number(args[i]);
    if (indentation_level < 0 || !Number.isInteger(indentation_level))
    {
      usage();
    }
    continue;
  }
  else if (arg == "-h")
  {
    usage();
  }
  else if (arg && arg[0] == "-")
  {
    usage();
  }
  else
  {
    // non-option
    usage();
  }
}

var output_comments = (commentargcnt >= 2);
var input_comments = (commentargcnt >= 1);

if (indentation_level < 0)
{
  if (use_tabs_for_indentation)
  {
    indentation_level = 1;
  }
  else
  {
    indentation_level = 4;
  }
}
if (nopretty)
{
  indentation_level = null;
}

const ctxout = nodejsonfrag.jsonout_new(use_tabs_for_indentation, indentation_level, function(ctx, str) {
  process.stdout.write(str);
}, null);

handler = {
  start_dict: function(ctx, key)
  {
    if (key != null)
    {
      nodejsonfrag.jsonout_put_start_dict(ctxout, key);
    }
    else
    {
      nodejsonfrag.jsonout_add_start_dict(ctxout);
    }
  },
  end_dict: function(ctx, key)
  {
    nodejsonfrag.jsonout_end_dict(ctxout);
  },
  start_array: function(ctx, key)
  {
    if (key != null)
    {
      nodejsonfrag.jsonout_put_start_array(ctxout, key);
    }
    else
    {
      nodejsonfrag.jsonout_add_start_array(ctxout);
    }
  },
  end_array: function(ctx, key)
  {
    nodejsonfrag.jsonout_end_array(ctxout);
  },
  handle_string: function(ctx, key, val)
  {
    if (key != null)
    {
      nodejsonfrag.jsonout_put_string(ctxout, key, val);
    }
    else
    {
      nodejsonfrag.jsonout_add_string(ctxout, val);
    }
  },
  handle_number: function(ctx, key, num, is_integer)
  {
    if (key != null)
    {
      if (is_integer)
      {
        nodejsonfrag.jsonout_put_number(ctxout, key, num);
      }
      else
      {
        nodejsonfrag.jsonout_put_flop(ctxout, key, num);
      }
    }
    else
    {
      if (is_integer)
      {
        nodejsonfrag.jsonout_add_number(ctxout, num);
      }
      else
      {
        nodejsonfrag.jsonout_add_flop(ctxout, num);
      }
    }
  },
  handle_null: function(ctx, key)
  {
    if (key != null)
    {
      nodejsonfrag.jsonout_put_null(ctxout, key);
    }
    else
    {
      nodejsonfrag.jsonout_add_null(ctxout);
    }
  },
  handle_boolean: function(ctx, key, val)
  {
    if (key != null)
    {
      nodejsonfrag.jsonout_put_boolean(ctxout, key, val);
    }
    else
    {
      nodejsonfrag.jsonout_add_boolean(ctxout, val);
    }
  },
  handle_comment: function(ctx, comma_seen, comment, is_multiline)
  {
    if (output_comments)
    {
      nodejsonfrag.jsonout_comment(ctxout, comma_seen, comment, is_multiline);
    }
  }
};

const ctx = nodejsonfrag.jsonstream_new(handler);
if (input_comments)
{
  nodejsonfrag.jsonstream_allow_comments(ctx);
}
if (input_trailing_comma)
{
  nodejsonfrag.jsonstream_allow_trailing_comma(ctx);
}

process.stdin.setEncoding('utf8');
process.stdin.on('data', function(x) {
  nodejsonfrag.jsonstream_feed(ctx, x, 0, x.length, false);
});
process.stdin.on('end', function() {
  nodejsonfrag.jsonstream_feed(ctx, '', 0, 0, true);
  process.stdout.write('\n');
});
