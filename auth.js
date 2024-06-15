const CRYPTO = require('crypto');

var g_secret_key;
var g_default_expire_duration;

var alphabet = '0123456789abcdefghijklmnopqrstuwvxyzABCDEFGHIJKLMNOPQRSTUWVXYZ';
var alph_map = 
{"0": 0, "1": 1,"2":  2, "3": 3,"4": 4, "5": 5, "6": 6, "7": 7,
"8":  8, "9": 9,"a": 10,"b": 11,"c": 12,"d": 13,"e": 14,"f": 15,
"g": 16,"h": 17,"i": 18,"j": 19,"k": 20,"l": 21,"m": 22,"n": 23,
"o": 24,"p": 25,"q": 26,"r": 27,"s": 28,"t": 29,"u": 30,"w": 31,
"v": 32,"x": 33,"y": 34,"z": 35,"A": 36,"B": 37,"C": 38,"D": 39,
"E": 40,"F": 41,"G": 42,"H": 43,"I": 44,"J": 45,"K": 46,"L": 47,
"M": 48,"N": 49,"O": 50,"P": 51,"Q": 52,"R": 53,"S": 54,"T": 55,
"U": 56,"W": 57,"V": 58,"X": 59,"Y": 60,"Z": 61}

function init(key, expire_duration)
{
	g_secret_key = key;
	g_default_expire_duration = expire_duration;
}

function encode(payload, check_only)
{
	if (!Array.isArray(payload))
		throw("payload must be an array");

	if (!check_only)
		payload.unshift(seed());

	var s = payload.join(".");
	var sum = CRYPTO.createHash('sha1');
	sum.update(s + g_secret_key);

	token = sum.digest('hex').substring(0,16);
	token += "_" + s;

	return token;
}

function decode(token, expiration)
{
	if (typeof expiration == "undefined")
		expiration = g_default_expire_duration;

	var parts = token.split("_");
	var payload = parts[1].split(".");
	var ts = str_to_time(payload[0])

	if ((Date.now()/1000|0) - ts > expiration)
		throw("expired");
	
	if (encode(payload, true).split("_")[0] == parts[0])
	{
		payload.splice(0, 1);
		return payload;
	}

	throw("payload mismatch");
}

function seed()
{
	return time_to_str(Math.floor((Date.now()) / 1000));
}

function time_to_str(time)
{
	function int2str(i)
	{
		var r = "";
		while(i > alphabet.length - 1)
		{
			r = alphabet[i % alphabet.length] + r;
			i = Math.floor(i / alphabet.length);
		}
		r = alphabet[i] + r;
		return r;
	}

	var id = int2str(time);
	return id;
}

function str_to_time(str)
{
	var l = alphabet.length;
	var m = 1;
	var v = 0;
	
	for (var i=str.length-1;i>-1;i--)
	{
		var c = alph_map[str[i]];
		if (typeof c == "undefined")
			throw("invalid str");

		v += m * c;
		m = m * l;
	}

	return v;
}

exports.init = init;
exports.encode = encode;
exports.decode = decode;
