var H = require("./http-server.js");
H.post("/", handler);
H.start(2323);

var counter = 0;
function handler(q, res)
{
	var mandatory = 
	{
		"x": "int",
		"y": "number"
	}

	var optional = 
	{
		"z": "int"
	}

	q = H.validate(q, res, mandatory, optional);
	if (!q)
		return;

	counter++;
	H.end(res, 200, JSON.stringify(q) + " hello " + counter)
}
