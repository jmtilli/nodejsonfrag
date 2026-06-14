JSONSTREAM_MODE_KEYSTRING = 1;
JSONSTREAM_MODE_KEYSTRING_ESCAPE = 2;
JSONSTREAM_MODE_KEYSTRING_UESCAPE = 3;
JSONSTREAM_MODE_STRING = 4;
JSONSTREAM_MODE_STRING_ESCAPE = 5;
JSONSTREAM_MODE_STRING_UESCAPE = 6;
JSONSTREAM_MODE_TRUE = 7;
JSONSTREAM_MODE_FALSE = 8;
JSONSTREAM_MODE_NULL = 9;
JSONSTREAM_MODE_FIRSTKEY = 10;
JSONSTREAM_MODE_KEY = 11;
JSONSTREAM_MODE_FIRSTVAL = 12;
JSONSTREAM_MODE_VAL = 13;
JSONSTREAM_MODE_COLON = 14;
JSONSTREAM_MODE_COMMA = 15;
JSONSTREAM_MODE_NUMBER = 16;
JSONSTREAM_MODE_ENDWS = 17;

/*
   handler: {
     .start_dict(jsonstream, key)
     .end_dict(jsonstream, key)
     .start_array(jsonstream, key)
     .end_array(jsonstream, key)
     .handle_null(jsonstream, key)
     .handle_string(jsonstream, key, val)
     .handle_number(jsonstream, key, num, is_integer)
     .handle_boolean(jsonstream, key, val)
     .handle_comment(jsonstream, comman_seen, comment)
   }
 */
function jsonstream_new(handler)
{
	var result = {};
	result.mode = JSONSTREAM_MODE_VAL;
	result.sz = 0;
	result.uescape = "";
	result.c_comment_seen = false;
	result.c_comment_seen_star = false;
	result.cpp_comment_seen = false;
	result.comment_seen_preliminary = false;
	result.comments = false;
	result.keypresent = false;
	result.key = "";
	result.keystack = [];
	result.val = "";
	result.handler = handler;
	result.is_integer = false;
	return result;
}
function jsonstream_allow_comments(jsonstream)
{
	jsonstream.comments = true;
}
function jsonstream_put_key(jsonstream, ch)
{
	jsonstream.key += ch;
}
function jsonstream_put_val(jsonstream, ch)
{
	jsonstream.val += ch;
}
function jsonstream_get_keystack(jsonstream)
{
	if (jsonstream.keystack[jsonstream.keystack.length-1].key == null)
	{
		jsonstream.keypresent = false;
		jsonstream.keystack.pop();
		return;
	}
	jsonstream.keypresent = true;
	jsonstream.key = jsonstream.keystack[jsonstream.keystack.length-1].key;
	jsonstream.keystack.pop();
}
function jsonstream_put_keystack_1(jsonstream)
{
	if (!jsonstream.keypresent)
	{
		jsonstream.keystack.push({key: null});
		jsonstream.keypresent = false;
		return;
	}
	jsonstream.keystack.push({key: jsonstream.key});
	return;
}
function jsonstream_put_keystack_2(jsonstream)
{
	jsonstream.keypresent = false;
}
function jsonstream_get_key(jsonstream)
{
	if (!jsonstream.keypresent)
	{
		return null;
	}
	return jsonstream.key;
}
function jsonstream_strip_comment(jsonstream, buf, start, i, sz)
{
	i++;
	jsonstream.mode = JSONSTREAM_MODE_ENDWS;
	while (i < sz)
	{
		if (jsonstream.comments &&
		    !jsonstream.comment_seen_preliminary &&
		    !jsonstream.cpp_comment_seen &&
		    !jsonstream.c_comment_seen &&
		    buf[start+i] == '/' && (
		      jsonstream.mode == JSONSTREAM_MODE_COLON ||
		      jsonstream.mode == JSONSTREAM_MODE_COMMA ||
		      jsonstream.mode == JSONSTREAM_MODE_FIRSTKEY ||
		      jsonstream.mode == JSONSTREAM_MODE_FIRSTVAL ||
		      jsonstream.mode == JSONSTREAM_MODE_KEY ||
		      jsonstream.mode == JSONSTREAM_MODE_VAL ||
		      jsonstream.mode == JSONSTREAM_MODE_ENDWS))
		{
			jsonstream.comment_seen_preliminary = true;
			jsonstream.val = "";
			i++;
			continue;
		}
		if (jsonstream.comment_seen_preliminary)
		{
			if (buf[start+i] == '*')
			{
				jsonstream.comment_seen_preliminary = false;
				jsonstream.c_comment_seen = true;
				jsonstream.val = "";
				i++;
				continue;
			}
			if (buf[start+i] != '/')
			{
				throw new Error("illegal comment");
			}
			jsonstream.comment_seen_preliminary = false;
			jsonstream.cpp_comment_seen = true;
			jsonstream.val = "";
			i++;
			continue;
		}
		if (jsonstream.c_comment_seen)
		{
			if (buf[start+i] == '*')
			{
				jsonstream.c_comment_seen_star = true;
			}
			else if (jsonstream.c_comment_seen_star && buf[start+i] == '/')
			{
				jsonstream.c_comment_seen = false;
				jsonstream.c_comment_seen_star = false;
				if (jsonstream.handler.handle_comment)
				{
					ret = jsonstream.handler.handle_comment(jsonstream, jsonstream.comma_seen, jsonstream.val);
					if (ret != 0)
					{
						return ret;
					}
				}
			}
			else
			{
				if (jsonstream.c_comment_seen_star)
				{
					jsonstream_put_val(jsonstream, '*');
				}
				jsonstream.c_comment_seen_star = false;
				jsonstream_put_val(jsonstream, buf[start+i]);
			}
			i++;
			continue;
		}
		if (jsonstream.cpp_comment_seen)
		{
			if (buf[start+i] == '\n')
			{
				jsonstream.cpp_comment_seen = false;
				if (jsonstream.handler.handle_comment)
				{
					ret = jsonstream.handler.handle_comment(jsonstream, jsonstream.comma_seen, jsonstream.val);
					if (ret != 0)
					{
						return ret;
					}
				}
			}
			else
			{
				jsonstream_put_val(jsonstream, buf[start+i]);
			}
			i++;
			continue;
		}
		if (buf[start+i] == ' ' || buf[start+i] == '\n' || buf[start+i] == '\r' || buf[start+i] == '\t')
		{
			i++;
			continue;
		}
		throw new Error("Overflow");
	}
}
function jsonstream_feed(jsonstream, buf, start, sz, eof)
{
	var i;
	if (sz < 0 || start+sz > buf.length)
	{
		throw new Error("out of bounds");
	}
	for (i = 0; i < sz; i++)
	{
		//console.log(jsonstream.mode + ": " + buf[start+i]);
		if (jsonstream.mode == JSONSTREAM_MODE_ENDWS)
		{
			i--;
			jsonstream_strip_comment(jsonstream, buf, start, i, sz);
			return eof ? 0 : -1;
		}
		if (jsonstream.mode == JSONSTREAM_MODE_KEYSTRING)
		{
			if (buf[start+i] == '\\')
			{
				jsonstream.mode = JSONSTREAM_MODE_KEYSTRING_ESCAPE;
			}
			else if (buf[start+i] == '"')
			{
				jsonstream.keypresent = true;
				jsonstream.mode = JSONSTREAM_MODE_COLON;
			}
			else
			{
				jsonstream_put_key(jsonstream, buf[start+i]);
			}
			continue;
		}
		else if (jsonstream.mode == JSONSTREAM_MODE_STRING)
		{
			if (buf[start+i] == '\\')
			{
				jsonstream.mode = JSONSTREAM_MODE_STRING_ESCAPE;
			}
			else if (buf[start+i] == '"')
			{
				jsonstream.mode = JSONSTREAM_MODE_COMMA;
				if (!jsonstream.handler.handle_string)
				{
					if (jsonstream.keystack.length <= 0)
					{
						jsonstream_strip_comment(jsonstream, buf, start, i, sz);
						return eof ? 0 : -1;
					}
					continue;
				}
				ret = jsonstream.handler.handle_string(jsonstream, jsonstream_get_key(jsonstream), jsonstream.val);
				if (ret != 0)
				{
					return ret;
				}
				if (jsonstream.keystack.length <= 0)
				{
					jsonstream_strip_comment(jsonstream, buf, start, i, sz);
					return eof ? 0 : -1;
				}
			}
			else
			{
				jsonstream_put_val(jsonstream, buf[start+i]);
			}
			continue;
		}
		else if (jsonstream.mode == JSONSTREAM_MODE_KEYSTRING_ESCAPE)
		{
			if (buf[start+i] == 'b')
			{
				jsonstream_put_key(jsonstream, '\b');
			}
			else if (buf[start+i] == 'f')
			{
				jsonstream_put_key(jsonstream, '\f');
			}
			else if (buf[start+i] == 'n')
			{
				jsonstream_put_key(jsonstream, '\n');
			}
			else if (buf[start+i] == 'r')
			{
				jsonstream_put_key(jsonstream, '\r');
			}
			else if (buf[start+i] == 't')
			{
				jsonstream_put_key(jsonstream, '\t');
			}
			else if (buf[start+i] == 'u')
			{
				jsonstream.mode = JSONSTREAM_MODE_KEYSTRING_UESCAPE;
				jsonstream.sz = 0;
			}
			else
			{
				throw new Error("Illegal sequence");
			}
			continue;
		}
		else if (jsonstream.mode == JSONSTREAM_MODE_KEYSTRING_UESCAPE)
		{
			// FIXME implement
		}
		else if (jsonstream.mode == JSONSTREAM_MODE_STRING_UESCAPE)
		{
			// FIXME implement
		}
		else if (jsonstream.mode == JSONSTREAM_MODE_STRING_ESCAPE)
		{
			if (buf[start+i] == 'b')
			{
				jsonstream_put_val(jsonstream, '\b');
			}
			else if (buf[start+i] == 'f')
			{
				jsonstream_put_val(jsonstream, '\f');
			}
			else if (buf[start+i] == 'n')
			{
				jsonstream_put_val(jsonstream, '\n');
			}
			else if (buf[start+i] == 'r')
			{
				jsonstream_put_val(jsonstream, '\r');
			}
			else if (buf[start+i] == 't')
			{
				jsonstream_put_val(jsonstream, '\t');
			}
			else if (buf[start+i] == 'u')
			{
				jsonstream.mode = JSONSTREAM_MODE_STRING_UESCAPE;
				jsonstream.sz = 0;
			}
			else
			{
				throw new Error("Illegal sequence");
			}
			continue;
		}
		if (jsonstream.comments &&
		    !jsonstream.comment_seen_preliminary &&
		    !jsonstream.cpp_comment_seen &&
		    !jsonstream.c_comment_seen &&
		    buf[start+i] == '/' && (
		      jsonstream.mode == JSONSTREAM_MODE_COLON ||
		      jsonstream.mode == JSONSTREAM_MODE_COMMA ||
		      jsonstream.mode == JSONSTREAM_MODE_FIRSTKEY ||
		      jsonstream.mode == JSONSTREAM_MODE_FIRSTVAL ||
		      jsonstream.mode == JSONSTREAM_MODE_KEY ||
		      jsonstream.mode == JSONSTREAM_MODE_VAL))
		{
			jsonstream.comment_seen_preliminary = true;
			jsonstream.val = "";
			continue;
		}
		if (jsonstream.comment_seen_preliminary)
		{
			if (buf[start+i] == '*')
			{
				jsonstream.comment_seen_preliminary = false;
				jsonstream.c_comment_seen = true;
				jsonstream.val = "";
				continue;
			}
			if (buf[start+i] != '/')
			{
				throw new Error("illegal comment");
			}
			jsonstream.comment_seen_preliminary = false;
			jsonstream.cpp_comment_seen = true;
			jsonstream.val = "";
			continue;
		}
		if (jsonstream.c_comment_seen)
		{
			if (buf[start+i] == '*')
			{
				jsonstream.c_comment_seen_star = true;
			}
			else if (jsonstream.c_comment_seen_star && buf[start+i] == '/')
			{
				jsonstream.c_comment_seen = false;
				jsonstream.c_comment_seen_star = false;
				if (jsonstream.handler.handle_comment)
				{
					ret = jsonstream.handler.handle_comment(jsonstream, jsonstream.comma_seen, jsonstream.val);
					if (ret != 0)
					{
						return ret;
					}
				}
			}
			else
			{
				if (jsonstream.c_comment_seen_star)
				{
					jsonstream_put_val(jsonstream, '*');
				}
				jsonstream.c_comment_seen_star = false;
				jsonstream_put_val(jsonstream, buf[start+i]);
			}
			continue;
		}
		if (jsonstream.cpp_comment_seen)
		{
			if (buf[start+i] == '\n')
			{
				jsonstream.cpp_comment_seen = false;
				if (jsonstream.handler.handle_comment)
				{
					ret = jsonstream.handler.handle_comment(jsonstream, jsonstream.comma_seen, jsonstream.val);
					if (ret != 0)
					{
						return ret;
					}
				}
			}
			else
			{
				jsonstream_put_val(jsonstream, buf[start+i]);
			}
			continue;
		}

		if ((buf[start+i] == ' ' || buf[start+i] == '\n' || buf[start+i] == '\r' || buf[start+i] == '\t') && (
		      jsonstream.mode == JSONSTREAM_MODE_COLON ||
		      jsonstream.mode == JSONSTREAM_MODE_COMMA ||
		      jsonstream.mode == JSONSTREAM_MODE_FIRSTKEY ||
		      jsonstream.mode == JSONSTREAM_MODE_FIRSTVAL ||
		      jsonstream.mode == JSONSTREAM_MODE_KEY ||
		      jsonstream.mode == JSONSTREAM_MODE_VAL))
		{
			continue;
		}
		if (jsonstream.mode == JSONSTREAM_MODE_COLON)
		{
			if (buf[start+i] != ':')
			{
				throw new Error("Invalid JSON");
			}
			jsonstream.mode = JSONSTREAM_MODE_VAL;
			continue;
		}
		if (jsonstream.mode == JSONSTREAM_MODE_COMMA && buf[start+i] == ',')
		{
			if (buf[start+i] == ',')
			{
				jsonstream.comma_seen = true;
				if (jsonstream.keypresent)
				{
					jsonstream.mode = JSONSTREAM_MODE_KEY;
					jsonstream.keypresent = false;
				}
				else
				{
					jsonstream.mode = JSONSTREAM_MODE_VAL;
				}
				continue;
			}
		}
		jsonstream.comma_seen = false;
		if ((jsonstream.mode == JSONSTREAM_MODE_COMMA || jsonstream.mode == JSONSTREAM_MODE_FIRSTKEY) && buf[start+i] == '}')
		{
			if (buf[start+i] == '}')
			{
				if (jsonstream.mode == JSONSTREAM_MODE_COMMA)
				{
					if (!jsonstream.keypresent)
					{
						throw new Error("invalid JSON");
					}
					// could be array or dict
				}
				jsonstream.mode = JSONSTREAM_MODE_COMMA;
				jsonstream_get_keystack(jsonstream);
				if (!jsonstream.handler.end_dict)
				{
					if (jsonstream.keystack.length <= 0)
					{
						jsonstream_strip_comment(jsonstream, buf, start, i, sz);
						return eof ? 0 : -1;
					}
					continue;
				}
				ret = jsonstream.handler.end_dict(jsonstream, jsonstream_get_key(jsonstream));
				if (ret != 0)
				{
					return ret;
				}
				if (jsonstream.keystack.length <= 0)
				{
					jsonstream_strip_comment(jsonstream, buf, start, i, sz);
					return eof ? 0 : -1;
				}
				continue;
			}
		}
		if ((jsonstream.mode == JSONSTREAM_MODE_COMMA || jsonstream.mode == JSONSTREAM_MODE_FIRSTVAL) && buf[start+i] == ']')
		{
			if (buf[start+i] == ']')
			{
				if (jsonstream.mode == JSONSTREAM_MODE_COMMA)
				{
					if (jsonstream.keypresent)
					{
						throw new Error("invalid JSON");
					}
					// could be array or dict
				}
				jsonstream.mode = JSONSTREAM_MODE_COMMA;
				jsonstream_get_keystack(jsonstream);
				if (!jsonstream.handler.end_array)
				{
					if (jsonstream.keystack.length <= 0)
					{
						jsonstream_strip_comment(jsonstream, buf, start, i, sz);
						return eof ? 0 : -1;
					}
					continue;
				}
				ret = jsonstream.handler.end_array(jsonstream, jsonstream_get_key(jsonstream));
				if (ret != 0)
				{
					return ret;
				}
				if (jsonstream.keystack.length <= 0)
				{
					jsonstream_strip_comment(jsonstream, buf, start, i, sz);
					return eof ? 0 : -1;
				}
				continue;
			}
		}
		if ((jsonstream.mode == JSONSTREAM_MODE_FIRSTVAL || jsonstream.mode == JSONSTREAM_MODE_VAL) && buf[start+i] == '{')
		{
			jsonstream_put_keystack_1(jsonstream);
			jsonstream.mode = JSONSTREAM_MODE_FIRSTKEY;
			if (!jsonstream.handler.start_dict)
			{
				jsonstream_put_keystack_2(jsonstream);
				continue;
			}
			ret = jsonstream.handler.start_dict(jsonstream.handler, jsonstream_get_key(jsonstream));
			jsonstream_put_keystack_2(jsonstream);
			if (ret != 0)
			{
				return ret;
			}
			continue;
		}
		if ((jsonstream.mode == JSONSTREAM_MODE_FIRSTVAL || jsonstream.mode == JSONSTREAM_MODE_VAL) && buf[start+i] == '[')
		{
			jsonstream_put_keystack_1(jsonstream);
			jsonstream.mode = JSONSTREAM_MODE_FIRSTVAL;
			if (!jsonstream.handler.start_array)
			{
				jsonstream_put_keystack_2(jsonstream);
				continue;
			}
			ret = jsonstream.handler.start_array(jsonstream.handler, jsonstream_get_key(jsonstream));
			jsonstream_put_keystack_2(jsonstream);
			if (ret != 0)
			{
				return ret;
			}
			continue;
		}
		if (jsonstream.mode == JSONSTREAM_MODE_TRUE)
		{
			if (buf[start+i] != "true"[jsonstream.sz++])
			{
				throw new Error("invalid JSON");
			}
			if (jsonstream.sz < 4)
			{
				continue;
			}
			jsonstream.mode = JSONSTREAM_MODE_COMMA;
			if (!jsonstream.handler.handle_boolean)
			{
				if (jsonstream.keystack.length <= 0)
				{
					jsonstream_strip_comment(jsonstream, buf, start, i, sz);
					return eof ? 0 : -1;
				}
				continue;
			}
			ret = jsonstream.handler.handle_boolean(jsonstream, jsonstream_get_key(jsonstream), true);
			if (ret != 0)
			{
				return ret;
			}
			if (jsonstream.keystack.length <= 0)
			{
				jsonstream_strip_comment(jsonstream, buf, start, i, sz);
				return eof ? 0 : -1;
			}
			continue;
		}
		if (jsonstream.mode == JSONSTREAM_MODE_FALSE)
		{
			if (buf[start+i] != "false"[jsonstream.sz++])
			{
				throw new Error("invalid JSON");
			}
			if (jsonstream.sz < 5)
			{
				continue;
			}
			jsonstream.mode = JSONSTREAM_MODE_COMMA;
			if (!jsonstream.handler.handle_boolean)
			{
				if (jsonstream.keystack.length <= 0)
				{
					jsonstream_strip_comment(jsonstream, buf, start, i, sz);
					return eof ? 0 : -1;
				}
				continue;
			}
			ret = jsonstream.handler.handle_boolean(jsonstream, jsonstream_get_key(jsonstream), false);
			if (ret != 0)
			{
				return ret;
			}
			if (jsonstream.keystack.length <= 0)
			{
				jsonstream_strip_comment(jsonstream, buf, start, i, sz);
				return eof ? 0 : -1;
			}
			continue;
		}
		if (jsonstream.mode == JSONSTREAM_MODE_NULL)
		{
			if (buf[start+i] != "null"[jsonstream.sz++])
			{
				throw new Error("invalid JSON");
			}
			if (jsonstream.sz < 4)
			{
				continue;
			}
			jsonstream.mode = JSONSTREAM_MODE_COMMA;
			if (!jsonstream.handler.handle_null)
			{
				if (jsonstream.keystack.length <= 0)
				{
					jsonstream_strip_comment(jsonstream, buf, start, i, sz);
					return eof ? 0 : -1;
				}
				continue;
			}
			ret = jsonstream.handler.handle_null(jsonstream, jsonstream_get_key(jsonstream));
			if (ret != 0)
			{
				return ret;
			}
			if (jsonstream.keystack.length <= 0)
			{
				jsonstream_strip_comment(jsonstream, buf, start, i, sz);
				return eof ? 0 : -1;
			}
			continue;
		}
		if ((jsonstream.mode == JSONSTREAM_MODE_VAL || jsonstream.mode == JSONSTREAM_MODE_FIRSTVAL) && buf[start+i] == 'n')
		{
			jsonstream.mode = JSONSTREAM_MODE_NULL;
			jsonstream.sz = 1;
			continue;
		}
		if ((jsonstream.mode == JSONSTREAM_MODE_VAL || jsonstream.mode == JSONSTREAM_MODE_FIRSTVAL) && buf[start+i] == 'f')
		{
			jsonstream.mode = JSONSTREAM_MODE_FALSE;
			jsonstream.sz = 1;
			continue;
		}
		if ((jsonstream.mode == JSONSTREAM_MODE_VAL || jsonstream.mode == JSONSTREAM_MODE_FIRSTVAL) && buf[start+i] == 't')
		{
			jsonstream.mode = JSONSTREAM_MODE_TRUE;
			jsonstream.sz = 1;
			continue;
		}
		if ((jsonstream.mode == JSONSTREAM_MODE_KEY || jsonstream.mode == JSONSTREAM_MODE_FIRSTKEY) && buf[start+i] == '"')
		{
			jsonstream.mode = JSONSTREAM_MODE_KEYSTRING;
			jsonstream.key = "";
			continue;
		}
		if ((jsonstream.mode == JSONSTREAM_MODE_VAL || jsonstream.mode == JSONSTREAM_MODE_FIRSTVAL) && buf[start+i] == '"')
		{
			jsonstream.mode = JSONSTREAM_MODE_STRING;
			jsonstream.val = "";
			continue;
		}
		if ((jsonstream.mode == JSONSTREAM_MODE_VAL || jsonstream.mode == JSONSTREAM_MODE_FIRSTVAL) && (buf[start+i] == '-' || (buf[start+i] >= '0' && buf[start+i] <= '9')))
		{
			jsonstream.mode = JSONSTREAM_MODE_NUMBER;
			jsonstream.is_integer = true;
			jsonstream.val = "";
		}
		if (jsonstream.mode == JSONSTREAM_MODE_NUMBER)
		{
			if (jsonstream.val == "" && buf[start+i] == '-')
			{
				jsonstream.val += buf[start+i];
				continue;
			}
			if ((jsonstream.val == "" || jsonstream.val == "-") && 
			    (buf[start+i] >= '0' && buf[start+i] <= '9'))
			{
				jsonstream.val += buf[start+i];
				continue;
			}
			if ((jsonstream.val != "0" && jsonstream.val != "-0") &&
			    (buf[start+i] >= '0' && buf[start+i] <= '9'))
			{
				jsonstream.val += buf[start+i];
				continue;
			}
			if (buf[start+i] == '.' && jsonstream.val.indexOf(".") == -1 &&
			    jsonstream.val.indexOf("E") == -1 && jsonstream.val.indexOf("e") == -1)
			{
				jsonstream.is_integer = false;
				jsonstream.val += buf[start+i];
				continue;
			}
			if ((buf[start+i] == 'E' || buf[start+i] == 'e') &&
			    jsonstream.val.indexOf("E") == -1 && jsonstream.val.indexOf("e") == -1)
			{
				jsonstream.is_integer = false;
				jsonstream.val += buf[start+i];
				continue;
			}
			if ((buf[start+i] == '-' || buf[start+i] == '+') &&
			    (jsonstream.val.indexOf("E") == jsonstream.val.length-1 ||
			     jsonstream.val.indexOf("e") == jsonstream.val.length-1))
			{
				jsonstream.val += buf[start+i];
				continue;
			}
			numval = Number(jsonstream.val);
			jsonstream.mode = JSONSTREAM_MODE_COMMA;
			i--;
			if (!jsonstream.handler.handle_number)
			{
				if (jsonstream.keystack.length <= 0)
				{
					jsonstream_strip_comment(jsonstream, buf, start, i, sz);
					return eof ? 0 : -1;
				}
				continue;
			}
			ret = jsonstream.handler.handle_number(jsonstream, jsonstream_get_key(jsonstream), numval, jsonstream.is_integer);
			if (ret != 0)
			{
				return ret;
			}
			if (jsonstream.keystack.length <= 0)
			{
				jsonstream_strip_comment(jsonstream, buf, start, i, sz);
				return eof ? 0 : -1;
			}
			continue;
		}
		//console.log(jsonstream.mode);
		throw new Error("invalid JSON");
	}
	if (jsonstream.mode == JSONSTREAM_MODE_NUMBER && eof)
	{
		jsonstream.mode = JSONSTREAM_MODE_COMMA;
		if (!jsonstream.handler.handle_number)
		{
			if (jsonstream.keystack.length <= 0)
			{
				return 0;
			}
			throw new Error("invalid JSON");
		}
		ret = jsonstream.handler.handle_number(jsonstream, jsonstream_get_key(jsonstream), Number(jsonstream.val), jsonstream.is_integer);
		if (ret != 0)
		{
			return ret;
		}
		if (jsonstream.keystack.length <= 0)
		{
			return 0;
		}
		throw new Error("invalid JSON");
	}
	return -1;
}
function jsonstream_is_valid_json(x, allow_comments)
{
	var handler = {};
	var ctx = jsonstream_new(handler);
	if (allow_comments)
	{
		jsonstream_allow_comments(ctx);
	}
	try {
		var ret = jsonstream_feed(ctx, x, 0, x.length, true);
		return (ret == 0);
	}
	catch {
		return false;
	}
}
module.exports = {
	jsonstream_new,
	jsonstream_allow_comments,
	jsonstream_feed,
	jsonstream_is_valid_json
};
