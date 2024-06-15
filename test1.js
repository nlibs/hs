var H = require("./http2");

function onreq(q, res, data)
{
	H.end(res, 200, "yees: " + q.email + q.password);
}

var opts =
[
	{
		"path": "/login",
		"mandatory": "email,password",
		"fn": onreq
	},
	{
		"path": "/forget-password",
		"mandatory": "email",
		"fn": onreq
	}
]

H.register(opts);
H.start(3242);
