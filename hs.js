var AUTH = require("./auth.js");
var FS = require("fs");
var S = require("sheet");

var endpoints = [];
var cors_enabled = true;
var cors_header = "*"

function parse_headers(req, should_parse)
{
	if (!should_parse)
		return {};

	var headers = {};
	req.forEach(function(k, v){ headers[k] = v; })
	return headers;
}

function handle_request(e, app)
{
	if (e.method == "get") handle_get(e, app);
	if (e.method == "post") handle_post(e, app);
	if (e.method == "bin") handle_bin(e, app);
}

function finalize(e, res, q, data)
{
	for (var i=0;i<e.mandatory.length;i++)
	{
		if (typeof q[e.mandatory[i]] === "undefined")
		{
			end(res, 400, '{"error":"missing field '+e.mandatory[i]+'"}');
			return;
		}
	}

	e.fn(q, res, data);
}

function handle_get(e, app)
{
	app.get(e.path, onreq);
	function onreq(res, req)
	{
		res.onAborted(() => {res.is_aborted = true;});
		var headers = parse_headers(req, e.parse_headers);
		var url = req.getUrl();
		var q = parse_uws_query(req);
		var payload = [];

		if (e.authorized)
		{
			if(typeof q["token"] == "undefined")
			{
				end(res, 401);
				return;
			}

			try{ payload = AUTH.decode(q["token"]); }
			catch(err) { end(res, 401); return; }
		}

		var data = 
		{
			"url": url,
			"headers": headers,
			"payload": payload
		}

		finalize(e, res, q, data);
	}
}

function handle_post(e, app)
{
	app.post(e.path, onreq);
	function onreq(res, req)
	{
		res.onAborted(() => {res.is_aborted = true;});
		var headers = parse_headers(req, e.parse_headers);
		var url = req.getUrl();
		var q = parse_uws_query(req);
		var payload = [];
		read_json(res, onread, onerr);

		function onread(q)
		{
			if (e.authorized)
			{
				if(typeof q["token"] == "undefined")
				{
					end(res, 401);
					return;
				}

				try{ payload = AUTH.decode(q["token"]); }
				catch(err) { end(res, 401); return; }
			}

			var data = 
			{
				"url": url,
				"headers": headers,
				"payload": payload
			}

			finalize(e, res, q, data);
		}

		function onerr()
		{
			end(res, 500);
		}
	}
}

function handle_bin(e, app)
{
	app.post(e.path, onreq);
	function onreq(res, req)
	{
		res.onAborted(() => {res.is_aborted = true;});
		var headers = parse_headers(req, e.parse_headers);
		var url = req.getUrl();
		var payload = [];
		read_buffer(res, onread, onerr);

		function onread(buffer)
		{
			if (e.authorized)
			{
				if(typeof q["token"] == "undefined")
				{
					end(res, 401);
					return;
				}

				try{ payload = AUTH.decode(q["token"]); }
				catch(err) { end(res, 401); return; }
			}

			var data = 
			{
				"url": url,
				"headers": headers,
				"payload": payload,
				"buffer": buffer
			}

			finalize(e, res, q, data);
		}

		function onerr()
		{
			end(res, 500);
		}
	}
}

function start(port, host)
{
	var UW = require('uWebSockets.js');
	var app = UW.App();
	for (let i=0;i<endpoints.length;i++)
		handle_request(endpoints[i], app);

	app.options("/*", function(res, req)
	{
		add_cors(res, cors_header);
		res.end();
	});

	if (typeof host == "undefined")
		app.listen(port, onlisten);
	else
		app.listen(host, port, onlisten);

	function onlisten(p)
	{
		if (p)
		{ 
			console.log("http-server started: " + port);
			if (typeof host != "undefined")
				console.log("http-server on host: " + host);

			console.log("number of endpoints registered: " + endpoints.length);
		}
		else{ throw "can't listen port " + port; }
	}
}

function parse_uws_query(req)
{
	var qs = req.getQuery();
	if (typeof qs == "undefined")
		return {};

	var obj = {};
	var parts = qs.split("&");
	for (var i=0;i<parts.length;i++)
	{
		var p = parts[i];
		var pair = p.split("=");
		if (pair.length != 2)
			return obj;

		obj[pair[0]] = decodeURIComponent(pair[1]);
	}
	return obj;
}

function read_buffer(res, cb, err)
{
	let buffer;
	res.onData((ab, isLast) =>
	{
		let chunk = Buffer.from(ab);
		if (isLast)
		{
			if (buffer)
			{
				try
				{
					buffer = Buffer.concat([buffer, chunk])
				}
				catch (e)
				{
					res.close();
					return;
				}
				cb(buffer);
			}
			else
			{
				cb(chunk);
			}
		}
		else
		{
			if (buffer)
			{
				buffer = Buffer.concat([buffer, chunk]);
			}
			else
			{
				buffer = Buffer.concat([chunk]);
			}
		}
	});

	res.onAborted(err);
}

function read_json(res, cb, err)
{
	let buffer;
	res.onData((ab, isLast) =>
	{
		let chunk = Buffer.from(ab);
		if (isLast)
		{
			let json;
			if (buffer)
			{
				try
				{
					json = JSON.parse(Buffer.concat([buffer, chunk]));
				}
				catch (e)
				{
					/* res.close calls onAborted */
					res.close();
					return;
				}
				cb(json);
			}
			else
			{
				try
				{
					json = JSON.parse(chunk);
				}
				catch (e)
				{
					/* res.close calls onAborted */
					res.close();
					return;
				}
				cb(json);
			}
		}
		else
		{
			if (buffer)
			{
				buffer = Buffer.concat([buffer, chunk]);
			}
			else
			{
				buffer = Buffer.concat([chunk]);
			}
		}
	});

	res.onAborted(err);
}

var status_map =
{
	"200": "200 OK",
	"204": "204 No Content",
	"206": "206 Partial Content",
	"301": "301 Moved Permanently",
	"302": "302 Found",
	"304": "304 Not Modified",
	"400": "400 Bad Request",
	"401": "401 Unauthorized",
	"402": "402 Payment Required",
	"403": "403 Forbidden",
	"404": "404 Not Found",
	"405": "405 Method Not Allowed",
	"406": "406 Not Acceptable",
	"408": "408 Request Timeout",
	"500": "500 Internal Server Error",
	"502": "502 Bad Gateway",
	"503": "503 Service Unavailable"
}

function write_status(code, res)
{
	var status = status_map[code];
	if (typeof status == "undefined")
		throw("invalid status code " + code);

	res.writeStatus(status);
}

function add_cors(res)
{
	res.writeHeader('Access-Control-Allow-Origin', "*");
	res.writeHeader('Access-Control-Request-Method', "*");
	res.writeHeader('Access-Control-Allow-Headers', "*");
	res.writeHeader('Access-Control-Allow-Methods', 'OPTIONS, GET, POST, DELETE');
}

function end(res, status, data, headers)
{
	res.cork(function()
	{
		write_status(status, res);
		add_cors(res);

		if (typeof headers == "undefined")
			headers = {};

		if (headers["Content-Type"] == "undefined")
			headers["Content-Type"] = "application/json; charset=utf-8";

		for (var key in headers)
			res.writeHeader(key, headers[key]);

		res.end(data);
	});
}

function init(conf)
{
	for (var i=0;i<conf.length;i++)
	{
		if (typeof conf[i].mandatory == "undefined")
			conf[i].mandatory = "";

		if (typeof conf[i].method == "undefined")
			conf[i].method = "get";

		conf[i].mandatory = conf[i].mandatory.split(",");
		endpoints.push(conf[i]);
	}
}

function init2(path, endpoints)
{
	var content = FS.readFileSync(path, "utf8");
	var conf;
	try{
		conf = JSON.parse(content);
	} catch(e) { console.log("invalid conf json"); process.exit(); }
	

	for (var i=0;i<conf.length;i++)
	{
		var fn = endpoints[conf[i].path];
		if (typeof fn == "undefined")
		{
			console.log("missing handler for ", conf[i].path);
			process.exit();
		}

		conf[i].fn = fn;
	}

	init(conf);
}

function write_config_file(doc_id, sheet, path)
{
	S.fetch(doc_id, sheet, onfetch);

	function onfetch(data)
	{
		var fields = [];
		var r = []

		for (var i=0;i<data[0].length;i++)
		{
			var d = data[0][i];
			fields.push(d);
		}

		for (var i=1;i<data.length;i++)
		{
			// var key = data[i][0];
			// r[key] = {};
			var obj = {};
			for (var j=0;j<data[i].length;j++)
			{
				var v = data[i][j];
				var f = fields[j];
				if (f == "authorized") v = v === "true";
				if (f == "parse_headers") v = v === "true";
				obj[f] = v;
			}
			r.push(obj);
		}

		FS.writeFileSync(path, JSON.stringify(r, null, "\t"), "utf8");
		console.log("conf file written to ", path);
	}
}

exports.start = start;
exports.end = end;
exports.enable_auth = function(key, expire) { AUTH.init(key, expire); }
exports.create_token = function(payload) { return AUTH.encode(payload); }
exports.init = init;
exports.init2 = init2;
exports.write_config_file = write_config_file;

