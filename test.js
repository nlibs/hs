// To test authentication, create a token like:
// var token = H.create_token(["user_id", "role"]);
// Then include {"token": token, "x": 1, "y": 2} in the request body

var H = require("./http-server.js");
H.post("/", handler, true, ["x", "y"], ["z"]);
H.post("/token", tokenHandler, false, [], []);
H.start(2323, "test_secret_key")

var counter = 0;
function handler(q, res, token_payload)
{
	counter++;
	var response = {
		data: q,
		user: token_payload,
		message: "hello " + counter
	};
	H.end(res, 200, JSON.stringify(response))
}

function tokenHandler(q, res)
{
	var token = H.create_token(["user123", "admin"]);
	H.end(res, 200, token)
}
