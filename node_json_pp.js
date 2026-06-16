const nodejsonfrag = require('.');
const fs = require('fs');

var output_comments = true;
var input_comments = true;
var input_trailing_comma = true;
var use_tabs_for_indentation = false;
var indentation_level = 4; // nonnegative integer or null

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
