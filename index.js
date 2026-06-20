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
     .handle_comment(jsonstream, comman_seen, comment, is_multiline)
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
	result.allow_trailing_comma = false;
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
function jsonstream_allow_trailing_comma(jsonstream)
{
	jsonstream.allow_trailing_comma = true;
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
function jsonstream_strip_comment(jsonstream, buf, start, i, sz, eof)
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
				jsonstream.c_comment_seen_star = false;
				jsonstream.val = "";
				i++;
				continue;
			}
			if (buf[start+i] != '/')
			{
				jsonstream.errloc = i;
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
					ret = jsonstream.handler.handle_comment(jsonstream, jsonstream.comma_seen, jsonstream.val, true);
					if (ret != 0)
					{
						//return ret;
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
					ret = jsonstream.handler.handle_comment(jsonstream, jsonstream.comma_seen, jsonstream.val, false);
					if (ret != 0)
					{
						//return ret;
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
		jsonstream.errloc = i;
		throw new Error("Overflow");
	}
	if (eof && (jsonstream.c_comment_seen || jsonstream.comment_seen_preliminary))
	{
		jsonstream.errloc = i;
		throw new Error("Unterminated beginning of comment");
	}
}
function jsonstream_feed(jsonstream, buf, start, sz, eof)
{
	var i;
	if (sz < 0 || start+sz > buf.length)
	{
		throw new Error("out of bounds");
	}
	if (jsonstream.mode == JSONSTREAM_MODE_ENDWS)
	{
		jsonstream_strip_comment(jsonstream, buf, start, -1, sz, eof);
		return eof ? 0 : -1;
	}
	for (i = 0; i < sz; i++)
	{
		//console.log(jsonstream.mode + ": " + buf[start+i]);
		if (jsonstream.mode == JSONSTREAM_MODE_ENDWS)
		{
			i--;
			jsonstream_strip_comment(jsonstream, buf, start, i, sz, eof);
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
						jsonstream_strip_comment(jsonstream, buf, start, i, sz, eof);
						return eof ? 0 : -1;
					}
					continue;
				}
				ret = jsonstream.handler.handle_string(jsonstream, jsonstream_get_key(jsonstream), jsonstream.val);
				if (ret != 0)
				{
					//return ret;
				}
				if (jsonstream.keystack.length <= 0)
				{
					jsonstream_strip_comment(jsonstream, buf, start, i, sz, eof);
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
				jsonstream.uescape = '';
			}
			else
			{
				jsonstream.errloc = i;
				throw new Error("Illegal sequence");
			}
			continue;
		}
		else if (jsonstream.mode == JSONSTREAM_MODE_KEYSTRING_UESCAPE && jsonstream.uescape.length < 4)
		{
			if ((buf[start+i] >= '0' && buf[start+i] <= '9') ||
			    (buf[start+i] >= 'A' && buf[start+i] <= 'F') ||
			    (buf[start+i] >= 'a' && buf[start+i] <= 'f'))
			{
				jsonstream.uescape += buf[start+i];
				if (jsonstream.uescape.length == 4)
				{
					jsonstream.key += String.fromCodePoint(parseInt(jsonstream.uescape,16));
					jsonstream.mode = JSONSTREAM_MODE_KEYSTRING;
				}
				continue;
			}
			else
			{
				throw new Error("Illegal unicode escape");
			}
		}
		else if (jsonstream.mode == JSONSTREAM_MODE_STRING_UESCAPE && jsonstream.uescape.length < 4)
		{
			if ((buf[start+i] >= '0' && buf[start+i] <= '9') ||
			    (buf[start+i] >= 'A' && buf[start+i] <= 'F') ||
			    (buf[start+i] >= 'a' && buf[start+i] <= 'f'))
			{
				jsonstream.uescape += buf[start+i];
				if (jsonstream.uescape.length == 4)
				{
					jsonstream.val += String.fromCodePoint(parseInt(jsonstream.uescape,16));
					jsonstream.mode = JSONSTREAM_MODE_STRING;
				}
				continue;
			}
			else
			{
				throw new Error("Illegal unicode escape");
			}
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
				jsonstream.uescape = '';
			}
			else
			{
				jsonstream.errloc = i;
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
				jsonstream.c_comment_seen_star = false;
				jsonstream.val = "";
				continue;
			}
			if (buf[start+i] != '/')
			{
				jsonstream.errloc = i;
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
					ret = jsonstream.handler.handle_comment(jsonstream, jsonstream.comma_seen, jsonstream.val, true);
					if (ret != 0)
					{
						//return ret;
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
					ret = jsonstream.handler.handle_comment(jsonstream, jsonstream.comma_seen, jsonstream.val, false);
					if (ret != 0)
					{
						//return ret;
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
				jsonstream.errloc = i;
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
		if ((jsonstream.mode == JSONSTREAM_MODE_COMMA || jsonstream.mode == JSONSTREAM_MODE_FIRSTKEY || (jsonstream.allow_trailing_comma && jsonstream.mode == JSONSTREAM_MODE_KEY)) && buf[start+i] == '}')
		{
			if (buf[start+i] == '}')
			{
				if (jsonstream.mode == JSONSTREAM_MODE_COMMA)
				{
					if (!jsonstream.keypresent)
					{
						jsonstream.errloc = i;
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
						jsonstream_strip_comment(jsonstream, buf, start, i, sz, eof);
						return eof ? 0 : -1;
					}
					continue;
				}
				ret = jsonstream.handler.end_dict(jsonstream, jsonstream_get_key(jsonstream));
				if (ret != 0)
				{
					//return ret;
				}
				if (jsonstream.keystack.length <= 0)
				{
					jsonstream_strip_comment(jsonstream, buf, start, i, sz, eof);
					return eof ? 0 : -1;
				}
				continue;
			}
		}
		if ((jsonstream.mode == JSONSTREAM_MODE_COMMA || jsonstream.mode == JSONSTREAM_MODE_FIRSTVAL || (jsonstream.allow_trailing_comma && jsonstream.mode == JSONSTREAM_MODE_VAL)) && buf[start+i] == ']')
		{
			if (buf[start+i] == ']')
			{
				if (jsonstream.mode == JSONSTREAM_MODE_COMMA || jsonstream.mode == JSONSTREAM_MODE_VAL)
				{
					if (jsonstream.keypresent || jsonstream.keystack.length <= 0)
					{
						jsonstream.errloc = i;
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
						jsonstream_strip_comment(jsonstream, buf, start, i, sz, eof);
						return eof ? 0 : -1;
					}
					continue;
				}
				ret = jsonstream.handler.end_array(jsonstream, jsonstream_get_key(jsonstream));
				if (ret != 0)
				{
					//return ret;
				}
				if (jsonstream.keystack.length <= 0)
				{
					jsonstream_strip_comment(jsonstream, buf, start, i, sz, eof);
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
			ret = jsonstream.handler.start_dict(jsonstream, jsonstream_get_key(jsonstream));
			jsonstream_put_keystack_2(jsonstream);
			if (ret != 0)
			{
				//return ret;
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
			ret = jsonstream.handler.start_array(jsonstream, jsonstream_get_key(jsonstream));
			jsonstream_put_keystack_2(jsonstream);
			if (ret != 0)
			{
				//return ret;
			}
			continue;
		}
		if (jsonstream.mode == JSONSTREAM_MODE_TRUE)
		{
			if (buf[start+i] != "true"[jsonstream.sz++])
			{
				jsonstream.errloc = i;
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
					jsonstream_strip_comment(jsonstream, buf, start, i, sz, eof);
					return eof ? 0 : -1;
				}
				continue;
			}
			ret = jsonstream.handler.handle_boolean(jsonstream, jsonstream_get_key(jsonstream), true);
			if (ret != 0)
			{
				//return ret;
			}
			if (jsonstream.keystack.length <= 0)
			{
				jsonstream_strip_comment(jsonstream, buf, start, i, sz, eof);
				return eof ? 0 : -1;
			}
			continue;
		}
		if (jsonstream.mode == JSONSTREAM_MODE_FALSE)
		{
			if (buf[start+i] != "false"[jsonstream.sz++])
			{
				jsonstream.errloc = i;
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
					jsonstream_strip_comment(jsonstream, buf, start, i, sz, eof);
					return eof ? 0 : -1;
				}
				continue;
			}
			ret = jsonstream.handler.handle_boolean(jsonstream, jsonstream_get_key(jsonstream), false);
			if (ret != 0)
			{
				//return ret;
			}
			if (jsonstream.keystack.length <= 0)
			{
				jsonstream_strip_comment(jsonstream, buf, start, i, sz, eof);
				return eof ? 0 : -1;
			}
			continue;
		}
		if (jsonstream.mode == JSONSTREAM_MODE_NULL)
		{
			if (buf[start+i] != "null"[jsonstream.sz++])
			{
				jsonstream.errloc = i;
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
					jsonstream_strip_comment(jsonstream, buf, start, i, sz, eof);
					return eof ? 0 : -1;
				}
				continue;
			}
			ret = jsonstream.handler.handle_null(jsonstream, jsonstream_get_key(jsonstream));
			if (ret != 0)
			{
				//return ret;
			}
			if (jsonstream.keystack.length <= 0)
			{
				jsonstream_strip_comment(jsonstream, buf, start, i, sz, eof);
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
			if ((buf[start+i] == '-' || buf[start+i] == '+') &&
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
					jsonstream_strip_comment(jsonstream, buf, start, i, sz, eof);
					return eof ? 0 : -1;
				}
				continue;
			}
			ret = jsonstream.handler.handle_number(jsonstream, jsonstream_get_key(jsonstream), numval, jsonstream.is_integer);
			if (ret != 0)
			{
				//return ret;
			}
			if (jsonstream.keystack.length <= 0)
			{
				jsonstream_strip_comment(jsonstream, buf, start, i, sz, eof);
				return eof ? 0 : -1;
			}
			continue;
		}
		//console.log(jsonstream.mode);
		jsonstream.errloc = i;
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
			jsonstream.errloc = i;
			throw new Error("invalid JSON");
		}
		ret = jsonstream.handler.handle_number(jsonstream, jsonstream_get_key(jsonstream), Number(jsonstream.val), jsonstream.is_integer);
		if (ret != 0)
		{
			//return ret;
		}
		if (jsonstream.keystack.length <= 0)
		{
			return 0;
		}
		jsonstream.errloc = i;
		throw new Error("invalid JSON");
	}
	if (eof && (jsonstream.c_comment_seen || jsonstream.comment_seen_preliminary))
	{
		jsonstream.errloc = i;
		throw new Error("Unterminated beginning of comment");
	}
	if (jsonstream.keystack.length <= 0 && eof &&
	    jsonstream.mode == JSONSTREAM_MODE_ENDWS)
	{
		return 0;
	}
	if (eof)
	{
		jsonstream.errloc = i;
		throw new Error("invalid JSON, parsing not finished at end");
	}
	return -1;
}
function jsonstream_is_valid_json_errloc(x, allow_comments, allow_trailing_comma)
{
	var handler = {};
	var ctx = jsonstream_new(handler);
	if (allow_comments)
	{
		jsonstream_allow_comments(ctx);
	}
	if (allow_trailing_comma)
	{
		jsonstream_allow_trailing_comma(ctx);
	}
	try {
		var ret = jsonstream_feed(ctx, x, 0, x.length, true);
		return {"valid": (ret == 0)};
	}
	catch {
		var lines = x.substring(0,ctx.errloc).split("\n");
		return {"valid": false, "errloc": ctx.errloc,
		        "errline": lines.length-1,
		        "errcol": lines[lines.length-1].length};
	}
}
function jsonstream_is_valid_json(x, allow_comments, allow_trailing_comma)
{
	var handler = {};
	var ctx = jsonstream_new(handler);
	if (allow_comments)
	{
		jsonstream_allow_comments(ctx);
	}
	if (allow_trailing_comma)
	{
		jsonstream_allow_trailing_comma(ctx);
	}
	try {
		var ret = jsonstream_feed(ctx, x, 0, x.length, true);
		return (ret == 0);
	}
	catch {
		return false;
	}
}
function jsonstream_tree_parse(x, allow_comments, allow_trailing_comma)
{
	var handler = {};
	var result = null;
	var has_result = false;
	var objstack = [];
	handler.start_dict = function(ctx, key)
	{
		var obj = {};
		if (!has_result)
		{
			has_result = true;
			result = obj;
			objstack.push(obj);
			return;
		}
		if (key == null)
		{
			objstack[objstack.length-1].push(obj);
		}
		else
		{
			objstack[objstack.length-1][key] = obj;
		}
		objstack.push(obj);
	};
	handler.end_dict = function(ctx, key)
	{
		objstack.pop();
	};
	handler.start_array = function(ctx, key)
	{
		var obj = [];
		if (!has_result)
		{
			has_result = true;
			result = obj;
			objstack.push(obj);
			return;
		}
		if (key == null)
		{
			objstack[objstack.length-1].push(obj);
		}
		else
		{
			objstack[objstack.length-1][key] = obj;
		}
		objstack.push(obj);
	};
	handler.end_array = function(ctx, key)
	{
		objstack.pop();
	};
	handler.handle_null = function(ctx, key)
	{
		var obj = null;
		if (!has_result)
		{
			has_result = true;
			result = obj;
			objstack.push(obj);
			return;
		}
		if (key == null)
		{
			objstack[objstack.length-1].push(obj);
		}
		else
		{
			objstack[objstack.length-1][key] = obj;
		}
	};
	handler.handle_string = function(ctx, key, val)
	{
		var obj = val;
		if (!has_result)
		{
			has_result = true;
			result = obj;
			objstack.push(obj);
			return;
		}
		if (key == null)
		{
			objstack[objstack.length-1].push(obj);
		}
		else
		{
			objstack[objstack.length-1][key] = obj;
		}
	};
	handler.handle_number = function(ctx, key, val, is_integer)
	{
		var obj = val;
		if (!has_result)
		{
			has_result = true;
			result = obj;
			objstack.push(obj);
			return;
		}
		if (key == null)
		{
			objstack[objstack.length-1].push(obj);
		}
		else
		{
			objstack[objstack.length-1][key] = obj;
		}
	};
	handler.handle_boolean = function(ctx, key, val)
	{
		var obj = val;
		if (!has_result)
		{
			has_result = true;
			result = obj;
			objstack.push(obj);
			return;
		}
		if (key == null)
		{
			objstack[objstack.length-1].push(obj);
		}
		else
		{
			objstack[objstack.length-1][key] = obj;
		}
	};
	handler.handle_comment = null;
	var ctx = jsonstream_new(handler);
	if (allow_comments)
	{
		jsonstream_allow_comments(ctx);
	}
	if (allow_trailing_comma)
	{
		jsonstream_allow_trailing_comma(ctx);
	}
	var ret = jsonstream_feed(ctx, x, 0, x.length, true);
	if (!has_result)
	{
		throw new Error("empty JSON");
	}
	return result;
}

const indent_struct = [
  {"buf": ",\n\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t"},
  {"buf": ",\n                                                                      "},
];

// datasink: function(datasinkctx, str)
function jsonout_new(tabs, indentamount, datasink, datasinkctx)
{
	var result = {};
	result.commanlindentchars = indent_struct[tabs?0:1].buf;
	result.indentamount = indentamount;
	result.curindentlevel = 0;
	result.first = true;
	result.veryfirst = true;
	result.datasink = datasink;
	result.datasinkctx = datasinkctx;
	result.commentcomma = false;
	result.commentnewline = false;
	return result;
}
function isObject(val) {
    if (val === null) { return false;}
    return ( (typeof val === 'function') || (typeof val === 'object') );
}
function jsonout_stringify_one(ctx, key, o)
{
	if (Array.isArray(o))
	{
		if (key == null)
		{
			jsonout_add_start_array(ctx);
		}
		else
		{
			jsonout_put_start_array(ctx, key);
		}
		for (var o2 of o)
		{
			jsonout_stringify_one(ctx, null, o2);
		}
		jsonout_end_array(ctx);
	}
	else if (o == null)
	{
		if (key == null)
		{
			jsonout_add_null(ctx);
		}
		else
		{
			jsonout_put_null(ctx, key);
		}
	}
	else if (typeof(o) === "number" || o instanceof Number)
	{
		if (key == null)
		{
			jsonout_add_number_ex(ctx, o);
		}
		else
		{
			jsonout_put_number_ex(ctx, key, o);
		}
	}
	else if (typeof(o) === "string" || o instanceof String)
	{
		if (key == null)
		{
			jsonout_add_string(ctx, o);
		}
		else
		{
			jsonout_put_string(ctx, key, o);
		}
	}
	else if (typeof(o) === "boolean" || o instanceof Boolean)
	{
		if (key == null)
		{
			jsonout_add_boolean(ctx, o);
		}
		else
		{
			jsonout_put_boolean(ctx, key, o);
		}
	}
	else if (isObject(o))
	{
		if (key == null)
		{
			jsonout_add_start_dict(ctx);
		}
		else
		{
			jsonout_put_start_dict(ctx, key);
		}
		for (var o2 of Object.keys(o))
		{
			jsonout_stringify_one(ctx, o2, o[o2]);
		}
		jsonout_end_dict(ctx);
	}
	else
	{
		throw new Error("Invalid JSON type");
	}
}
function jsonout_stringify(tabs, indentamount, o)
{
	var outs = [];
	var st = [];
	var outctx = jsonout_new(tabs, indentamount, function(sinkctx, s) {
		outs.push(s);
	}, null);
	jsonout_stringify_one(outctx, null, o);
	return outs.join('');
}
function jsonout_indent(ctx, comma)
{
	var toindent = ctx.curindentlevel * ctx.indentamount;
	var first = true;
	var indentchars = ctx.commanlindentchars;
	var off = 2;
	var ret;
	var do_extracomma = false;
	if (!comma)
	{
		indentchars = indentchars.substr(1);
		off--;
	}
	if (ctx.commentcomma)
	{
		comma = false;
		ctx.commentcomma = false;
	}
	if (ctx.indentamount == null)
	{
		if (comma)
		{
			ctx.datasink(ctx.datasinkctx, ",");
			return;
		}
		return;
	}
	if (!ctx.commentnewline)
	{
		if (toindent == 0)
		{
			if (comma)
			{
				ctx.datasink(ctx.datasinkctx, ",\n");
				return;
			}
			ctx.datasink(ctx.datasinkctx, "\n");
			return;
		}
	}
	if (ctx.commentnewline && !comma)
	{
		first = false;
	}
	else if (ctx.commentnewline && comma)
	{
		first = false;
		do_extracomma = true;
	}
	ctx.commentnewline = false;
	while (toindent > 0)
	{
		var thisround = toindent;
		var sub;
		if (thisround > indentchars.length - 2)
		{
			thisround = indentchars.length - 2;
		}
		if (first)
		{
			sub = indentchars.substr(0, thisround+off);
		}
		else
		{
			sub = indentchars.substr(off, thisround);
		}
		ctx.datasink(ctx.datasinkctx, sub);
		toindent -= thisround;
		first = false;
	}
	if (do_extracomma)
	{
		ctx.datasink(ctx.datasinkctx, ", ");
	}
}
function jsonout_internal_put_flop(ctx, val)
{
	var cnv;
	val = Number(val);
	if (!Number.isFinite(val))
	{
		throw new Error("number not finite");
	}
	cnv = JSON.stringify(val);
	if (cnv.indexOf(".") == -1 && cnv.indexOf("e") == -1 && cnv.indexOf("E") == -1)
	{
		cnv += ".0";
	}
	ctx.datasink(ctx.datasinkctx, cnv);
}
function jsonout_internal_put_flop_ex(ctx, val)
{
	var cnv;
	val = Number(val);
	if (!Number.isFinite(val))
	{
		ctx.datasink(ctx.datasinkctx, "null");
		return;
	}
	cnv = JSON.stringify(val);
	if (cnv.indexOf(".") == -1 && cnv.indexOf("e") == -1 && cnv.indexOf("E") == -1)
	{
		cnv += ".0";
	}
	ctx.datasink(ctx.datasinkctx, cnv);
}
function jsonout_internal_put_number(ctx, val)
{
	var cnv;
	val = Number(val);
	if (!Number.isFinite(val))
	{
		throw new Error("number not finite");
	}
	cnv = JSON.stringify(val);
	ctx.datasink(ctx.datasinkctx, cnv);
}
function jsonout_internal_put_number_ex(ctx, val)
{
	var cnv;
	val = Number(val);
	if (!Number.isFinite(val))
	{
		ctx.datasink(ctx.datasinkctx, "null");
		return;
	}
	cnv = JSON.stringify(val);
	ctx.datasink(ctx.datasinkctx, cnv);
}
function jsonout_internal_put_string(ctx, val)
{
	ctx.datasink(ctx.datasinkctx, JSON.stringify(String(val)));
}
function jsonout_put_start_dict(ctx, key)
{
	if (ctx.veryfirst)
	{
		throw new Error("logic error");
	}
	jsonout_indent(ctx, !ctx.first);
	jsonout_internal_put_string(ctx, key);
	ctx.first = true;
	ctx.curindentlevel++;
	if (ctx.indentamount == null)
	{
		ctx.datasink(ctx.datasinkctx, ":{");
	}
	else
	{
		ctx.datasink(ctx.datasinkctx, ": {");
	}
}
function jsonout_put_start_array(ctx, key)
{
	if (ctx.veryfirst)
	{
		throw new Error("logic error");
	}
	jsonout_indent(ctx, !ctx.first);
	jsonout_internal_put_string(ctx, key);
	ctx.first = true;
	ctx.curindentlevel++;
	if (ctx.indentamount == null)
	{
		ctx.datasink(ctx.datasinkctx, ":[");
	}
	else
	{
		ctx.datasink(ctx.datasinkctx, ": [");
	}
}
function jsonout_add_start_dict(ctx)
{
	if (!ctx.veryfirst)
	{
		jsonout_indent(ctx, !ctx.first);
	}
	ctx.veryfirst = false;
	ctx.first = true;
	ctx.curindentlevel++;
	ctx.datasink(ctx.datasinkctx, "{");
}
function jsonout_add_start_array(ctx)
{
	if (!ctx.veryfirst)
	{
		jsonout_indent(ctx, !ctx.first);
	}
	ctx.veryfirst = false;
	ctx.first = true;
	ctx.curindentlevel++;
	ctx.datasink(ctx.datasinkctx, "[");
}
function jsonout_end_dict(ctx)
{
	if (ctx.curindentlevel == 0)
	{
		throw new Error("logic error");
	}
	ctx.curindentlevel--;
	if (!ctx.first)
	{
		jsonout_indent(ctx, false);
	}
	ctx.first = false;
	ctx.datasink(ctx.datasinkctx, "}");
}
function jsonout_end_array(ctx)
{
	if (ctx.curindentlevel == 0)
	{
		throw new Error("logic error");
	}
	ctx.curindentlevel--;
	if (!ctx.first)
	{
		jsonout_indent(ctx, false);
	}
	ctx.first = false;
	ctx.datasink(ctx.datasinkctx, "]");
}
function jsonout_put_string(ctx, key, val)
{
	if (ctx.veryfirst)
	{
		throw new Error("logic error");
	}
	jsonout_indent(ctx, !ctx.first);
	jsonout_internal_put_string(ctx, key);
	if (ctx.indentamount == null)
	{
		ctx.datasink(ctx.datasinkctx, ":");
	}
	else
	{
		ctx.datasink(ctx.datasinkctx, ": ");
	}
	ctx.first = false;
	jsonout_internal_put_string(ctx, val);
}
function jsonout_add_string(ctx, val)
{
	if (!ctx.veryfirst)
	{
		jsonout_indent(ctx, !ctx.first);
	}
	ctx.veryfirst = false;
	jsonout_internal_put_string(ctx, val);
	ctx.first = false;
}
function jsonout_put_boolean(ctx, key, val)
{
	if (ctx.veryfirst)
	{
		throw new Error("logic error");
	}
	jsonout_indent(ctx, !ctx.first);
	jsonout_internal_put_string(ctx, key);
	if (val)
	{
		ctx.datasink(ctx.datasinkctx, (ctx.indentamount == null) ? ":true" : ": true");
	}
	else
	{
		ctx.datasink(ctx.datasinkctx, (ctx.indentamount == null) ? ":false" : ": false");
	}
	ctx.first = false;
}
function jsonout_add_boolean(ctx, val)
{
	if (!ctx.veryfirst)
	{
		jsonout_indent(ctx, !ctx.first);
	}
	ctx.veryfirst = false;
	if (val)
	{
		ctx.datasink(ctx.datasinkctx, "true");
	}
	else
	{
		ctx.datasink(ctx.datasinkctx, "false");
	}
	ctx.first = false;
}
function jsonout_put_null(ctx, key)
{
	if (ctx.veryfirst)
	{
		throw new Error("logic error");
	}
	jsonout_indent(ctx, !ctx.first);
	jsonout_internal_put_string(ctx, key);
	ctx.datasink(ctx.datasinkctx, (ctx.indentamount == null) ? ":null" : ": null");
	ctx.first = false;
}
function jsonout_add_null(ctx)
{
	if (!ctx.veryfirst)
	{
		jsonout_indent(ctx, !ctx.first);
	}
	ctx.veryfirst = false;
	ctx.datasink(ctx.datasinkctx, "null");
	ctx.first = false;
}

function jsonout_comment(ctx, comma_seen, comment, force_multiline)
{
	if (comment.indexOf("\r") != -1 || comment.indexOf("\n") != -1)
	{
		force_multiline = true;
	}
	if (force_multiline)
	{
		if (comma_seen)
		{
			ctx.datasink(ctx.datasinkctx, ", /*");
			ctx.commentcomma = true;
			ctx.first = true;
		}
		else
		{
			ctx.datasink(ctx.datasinkctx, " /*");
		}
		ctx.datasink(ctx.datasinkctx, comment);
		ctx.datasink(ctx.datasinkctx, "*/\n");
		ctx.commentnewline = true;
		return;
	}
	if (comma_seen)
	{
		ctx.datasink(ctx.datasinkctx, ", //");
		ctx.commentcomma = true;
		ctx.first = true;
	}
	else
	{
		ctx.datasink(ctx.datasinkctx, " //");
	}
	ctx.datasink(ctx.datasinkctx, comment);
	ctx.datasink(ctx.datasinkctx, "\n");
	ctx.commentnewline = true;
}

function jsonout_put_number(ctx, key, val)
{
	if (ctx.veryfirst)
	{
		throw new Error("logic error");
	}
	jsonout_indent(ctx, !ctx.first);
	jsonout_internal_put_string(ctx, key);
	if (ctx.indentamount == null)
	{
		ctx.datasink(ctx.datasinkctx, ":");
	}
	else
	{
		ctx.datasink(ctx.datasinkctx, ": ");
	}
	ctx.first = false;
	jsonout_internal_put_number(ctx, val);
}
function jsonout_put_number_ex(ctx, key, val)
{
	if (ctx.veryfirst)
	{
		throw new Error("logic error");
	}
	jsonout_indent(ctx, !ctx.first);
	jsonout_internal_put_string(ctx, key);
	if (ctx.indentamount == null)
	{
		ctx.datasink(ctx.datasinkctx, ":");
	}
	else
	{
		ctx.datasink(ctx.datasinkctx, ": ");
	}
	ctx.first = false;
	jsonout_internal_put_number_ex(ctx, val);
}
function jsonout_put_flop(ctx, key, val)
{
	if (ctx.veryfirst)
	{
		throw new Error("logic error");
	}
	jsonout_indent(ctx, !ctx.first);
	jsonout_internal_put_string(ctx, key);
	if (ctx.indentamount == null)
	{
		ctx.datasink(ctx.datasinkctx, ":");
	}
	else
	{
		ctx.datasink(ctx.datasinkctx, ": ");
	}
	ctx.first = false;
	jsonout_internal_put_flop(ctx, val);
}
function jsonout_put_flop_ex(ctx, key, val)
{
	if (ctx.veryfirst)
	{
		throw new Error("logic error");
	}
	jsonout_indent(ctx, !ctx.first);
	jsonout_internal_put_string(ctx, key);
	if (ctx.indentamount == null)
	{
		ctx.datasink(ctx.datasinkctx, ":");
	}
	else
	{
		ctx.datasink(ctx.datasinkctx, ": ");
	}
	ctx.first = false;
	jsonout_internal_put_flop_ex(ctx, val);
}

function jsonout_add_number(ctx, val)
{
	if (!ctx.veryfirst)
	{
		jsonout_indent(ctx, !ctx.first);
	}
	ctx.veryfirst = false;
	jsonout_internal_put_number(ctx, val);
	ctx.first = false;
}
function jsonout_add_number_ex(ctx, val)
{
	if (!ctx.veryfirst)
	{
		jsonout_indent(ctx, !ctx.first);
	}
	ctx.veryfirst = false;
	jsonout_internal_put_number_ex(ctx, val);
	ctx.first = false;
}
function jsonout_add_flop(ctx, val)
{
	if (!ctx.veryfirst)
	{
		jsonout_indent(ctx, !ctx.first);
	}
	ctx.veryfirst = false;
	jsonout_internal_put_flop(ctx, val);
	ctx.first = false;
}
function jsonout_add_flop_ex(ctx, val)
{
	if (!ctx.veryfirst)
	{
		jsonout_indent(ctx, !ctx.first);
	}
	ctx.veryfirst = false;
	jsonout_internal_put_flop_ex(ctx, val);
	ctx.first = false;
}

function jsonfrag_is(ctx, stack)
{
	var i;
	if (ctx.jsonfrag.keystack.length != stack.length+1)
	{
		return false;
	}
	// ctx.jsonfrag.keystack[0] is always null
	for (i = 0; i < ctx.jsonfrag.keystack.length; i++)
	{
		if (ctx.jsonfrag.keystack[i+1] != stack[i])
		{
			return false;
		}
	}
	return true;
}
function jsonfrag_start_fragment_collection(ctx)
{
	if (ctx.jsonfrag.isdict)
	{
		ctx.jsonfrag.n.push({});
	}
	else
	{
		ctx.jsonfrag.n.push([]);
	}
}
function jsonfrag_start_dict(ctx, key)
{
	var obj;
	ctx.jsonfrag.keystack.push(key);
	if (ctx.jsonfrag.n.length == 0)
	{
		if (ctx.jsonfrag.handler.start_dict)
		{
			ctx.jsonfrag.isdict = true;
			ctx.jsonfrag.handler.start_dict(ctx, key);
		}
		return;
	}
	obj = {};
	if (key == null)
	{
		ctx.jsonfrag.n[ctx.jsonfrag.n.length-1].push(obj);
	}
	else
	{
		ctx.jsonfrag.n[ctx.jsonfrag.n.length-1][key] = obj;
	}
	ctx.jsonfrag.n.push(obj);
}
function jsonfrag_end_dict(ctx, key)
{
	var last;
	if (ctx.jsonfrag.n.length == 0)
	{
		if (ctx.jsonfrag.handler.end_dict)
		{
			ctx.jsonfrag.handler.end_dict(ctx, key, null);
		}
		ctx.jsonfrag.keystack.pop();
		return;
	}
	last = ctx.jsonfrag.n.pop();
	if (ctx.jsonfrag.n.length == 0)
	{
		if (ctx.jsonfrag.handler.end_dict)
		{
			ctx.jsonfrag.handler.end_dict(ctx, key, last);
		}
	}
	ctx.jsonfrag.keystack.pop();
}
function jsonfrag_start_array(ctx, key)
{
	var obj;
	ctx.jsonfrag.keystack.push(key);
	if (ctx.jsonfrag.n.length == 0)
	{
		if (ctx.jsonfrag.handler.start_array)
		{
			ctx.jsonfrag.isdict = false;
			ctx.jsonfrag.handler.start_array(ctx, key);
		}
		return;
	}
	obj = [];
	if (key == null)
	{
		ctx.jsonfrag.n[ctx.jsonfrag.n.length-1].push(obj);
	}
	else
	{
		ctx.jsonfrag.n[ctx.jsonfrag.n.length-1][key] = obj;
	}
	ctx.jsonfrag.n.push(obj);
}
function jsonfrag_end_array(ctx, key)
{
	var last;
	if (ctx.jsonfrag.n.length == 0)
	{
		if (ctx.jsonfrag.handler.end_array)
		{
			ctx.jsonfrag.handler.end_array(ctx, key, null);
		}
		ctx.jsonfrag.keystack.pop();
		return;
	}
	last = ctx.jsonfrag.n.pop();
	if (ctx.jsonfrag.n.length == 0)
	{
		if (ctx.jsonfrag.handler.end_array)
		{
			ctx.jsonfrag.handler.end_array(ctx, key, last);
		}
	}
	ctx.jsonfrag.keystack.pop();
}
function jsonfrag_handle_null(ctx, key)
{
	if (ctx.jsonfrag.n.length == 0)
	{
		if (ctx.jsonfrag.handler.handle_null)
		{
			ctx.jsonfrag.handler.handle_null(ctx, key);
		}
		return;
	}
	if (key == null)
	{
		ctx.jsonfrag.n[ctx.jsonfrag.n.length-1].push(null);
	}
	else
	{
		ctx.jsonfrag.n[ctx.jsonfrag.n.length-1][key] = null;
	}
}
function jsonfrag_handle_string(ctx, key, val)
{
	if (ctx.jsonfrag.n.length == 0)
	{
		if (ctx.jsonfrag.handler.handle_string)
		{
			ctx.jsonfrag.handler.handle_string(ctx, key, val);
		}
		return;
	}
	if (key == null)
	{
		ctx.jsonfrag.n[ctx.jsonfrag.n.length-1].push(val);
	}
	else
	{
		ctx.jsonfrag.n[ctx.jsonfrag.n.length-1][key] = val;
	}
}
function jsonfrag_handle_number(ctx, key, val, is_integer)
{
	if (ctx.jsonfrag.n.length == 0)
	{
		if (ctx.jsonfrag.handler.handle_number)
		{
			ctx.jsonfrag.handler.handle_number(ctx, key, val, is_integer);
		}
		return;
	}
	if (key == null)
	{
		ctx.jsonfrag.n[ctx.jsonfrag.n.length-1].push(val);
	}
	else
	{
		ctx.jsonfrag.n[ctx.jsonfrag.n.length-1][key] = val;
	}
}
function jsonfrag_handle_boolean(ctx, key, val)
{
	if (ctx.jsonfrag.n.length == 0)
	{
		if (ctx.jsonfrag.handler.handle_boolean)
		{
			ctx.jsonfrag.handler.handle_boolean(ctx, key, val);
		}
		return;
	}
	if (key == null)
	{
		ctx.jsonfrag.n[ctx.jsonfrag.n.length-1].push(val);
	}
	else
	{
		ctx.jsonfrag.n[ctx.jsonfrag.n.length-1][key] = val;
	}
}

function jsonfrag_new(fraghandler)
{
	var evhandler = {
		'start_dict': jsonfrag_start_dict,
		'end_dict': jsonfrag_end_dict,
		'start_array': jsonfrag_start_array,
		'end_array': jsonfrag_end_array,
		'handle_null': jsonfrag_handle_null,
		'handle_string': jsonfrag_handle_string,
		'handle_number': jsonfrag_handle_number,
		'handle_boolean': jsonfrag_handle_boolean,
	};
	var ctx = jsonstream_new(evhandler);
	ctx.jsonfrag = {};
	ctx.jsonfrag.handler = fraghandler;
	ctx.jsonfrag.n = [];
	ctx.jsonfrag.keystack = [];
	return ctx;
}
function jsonfrag_parse(s, fraghandler, allow_comments, allow_trailing_comma)
{
	var ctx = jsonfrag_new(fraghandler);
	if (allow_comments)
	{
		jsonstream_allow_comments(ctx);
	}
	if (allow_trailing_comma)
	{
		jsonstream_allow_trailing_comma(ctx);
	}
	jsonstream_feed(ctx, s, 0, s.length, true);
}

// settings:
// {
//   "allow_trailing_comma": true,
//   "use_tabs_for_indentation": false,
//   "indentation_level: 4, // or null for no pretty print
//   "allow_comments": true,
//   "output_comments": true
// }
function jsonstream_pretty_print(str, settings)
{
	if (!settings) settings = {};
	var strout = '';
	const ctxout = jsonout_new(settings.use_tabs_for_indentation, settings.indentation_level, function(ctx, str) {
		strout += str;
	}, null);
	const handler =
	{
	  start_dict: function(ctx, key)
	  {
	    if (key != null)
	    {
	      jsonout_put_start_dict(ctxout, key);
	    }
	    else
	    {
	      jsonout_add_start_dict(ctxout);
	    }
	  },
	  end_dict: function(ctx, key)
	  {
	    jsonout_end_dict(ctxout);
	  },
	  start_array: function(ctx, key)
	  {
	    if (key != null)
	    {
	      jsonout_put_start_array(ctxout, key);
	    }
	    else
	    {
	      jsonout_add_start_array(ctxout);
	    }
	  },
	  end_array: function(ctx, key)
	  {
	    jsonout_end_array(ctxout);
	  },
	  handle_string: function(ctx, key, val)
	  {
	    if (key != null)
	    {
	      jsonout_put_string(ctxout, key, val);
	    }
	    else
	    {
	      jsonout_add_string(ctxout, val);
	    }
	  },
	  handle_number: function(ctx, key, num, is_integer)
	  {
	    if (key != null)
	    {
	      if (is_integer)
	      {
		jsonout_put_number(ctxout, key, num);
	      }
	      else
	      {
		jsonout_put_flop(ctxout, key, num);
	      }
	    }
	    else
	    {
	      if (is_integer)
	      {
		jsonout_add_number(ctxout, num);
	      }
	      else
	      {
		jsonout_add_flop(ctxout, num);
	      }
	    }
	  },
	  handle_null: function(ctx, key)
	  {
	    if (key != null)
	    {
	      jsonout_put_null(ctxout, key);
	    }
	    else
	    {
	      jsonout_add_null(ctxout);
	    }
	  },
	  handle_boolean: function(ctx, key, val)
	  {
	    if (key != null)
	    {
	      jsonout_put_boolean(ctxout, key, val);
	    }
	    else
	    {
	      jsonout_add_boolean(ctxout, val);
	    }
	  },
	  handle_comment: function(ctx, comma_seen, comment, is_multiline)
	  {
	    if (settings.output_comments)
	    {
	      jsonout_comment(ctxout, comma_seen, comment, is_multiline);
	    }
	  }
	};
	const ctx = jsonstream_new(handler);
	if (settings.allow_comments)
	{
		jsonstream_allow_comments(ctx);
	}
	if (settings.allow_trailing_comma)
	{
		jsonstream_allow_trailing_comma(ctx);
	}
	jsonstream_feed(ctx, str, 0, str.length, true);
	return strout;
}

module.exports = {
	jsonstream_new,
	jsonstream_allow_comments,
	jsonstream_allow_trailing_comma,
	jsonstream_feed,
	//
	jsonstream_is_valid_json_errloc,
	jsonstream_is_valid_json,
	//
	jsonstream_tree_parse,
	//
	jsonstream_pretty_print,
	//
	jsonout_stringify,
	//
	jsonfrag_is,
	jsonfrag_start_fragment_collection,
	jsonfrag_new,
	jsonfrag_parse,
	//
	jsonout_new,
	jsonout_put_start_dict,
	jsonout_put_start_array,
	jsonout_add_start_dict,
	jsonout_add_start_array,
	jsonout_end_dict,
	jsonout_end_array,
	jsonout_put_string,
	jsonout_add_string,
	jsonout_put_boolean,
	jsonout_add_boolean,
	jsonout_put_null,
	jsonout_add_null,
	jsonout_comment,
	jsonout_put_number,
	jsonout_put_number_ex, // convert NaN/Inf to null
	jsonout_put_flop,
	jsonout_put_flop_ex, // convert NaN/Inf to null
	jsonout_add_number,
	jsonout_add_number_ex, // convert NaN/Inf to null
	jsonout_add_flop,
	jsonout_add_flop_ex, // convert NaN/Inf to null
};
