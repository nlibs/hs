const AUTH = require("./auth.js");

var endpoints = [];

exports.post = function(path, fn, is_authorized, mandatory, optional) {
  if (typeof is_authorized == "undefined")
    is_authorized = false;
  if (!mandatory) mandatory = [];
  if (!optional) optional = [];

  endpoints.push([path, fn, is_authorized, mandatory, optional]);
}

exports.start = function(port, authKey) {
  // Initialize auth with defaults or provided values
  const defaultKey = authKey || "default_secret_key_change_in_production";
  AUTH.init(defaultKey);

  var UW = require('uWebSockets.js');
  var app = UW.App();

  for (let i = 0; i < endpoints.length; i++) {
    let e = endpoints[i];
    app.post(e[0], function(res, req) {
      var url = req.getUrl();
      read_json(res,
        function(obj) {
          var token_payload = [];
          if (e[2]) { // is_authorized
            if (typeof obj["token"] == "undefined") {
              end(res, 401, '{"error":"missing token"}');
              return;
            }

            try {
              token_payload = AUTH.decode(obj["token"]);
            } catch (err) {
              end(res, 401, '{"error":"invalid token"}');
              return;
            }
          }

          // Validate mandatory fields
          var mandatory = e[3];
          for (var i = 0; i < mandatory.length; i++) {
            var key = mandatory[i];
            if (typeof obj[key] === "undefined") {
              end(res, 400, '{"error":"missing field ' + key + '"}');
              return;
            }
          }

          // Build validated object with mandatory and optional
          var validated_obj = {};
          for (var i = 0; i < mandatory.length; i++) {
            validated_obj[mandatory[i]] = obj[mandatory[i]];
          }
          var optional = e[4];
          for (var i = 0; i < optional.length; i++) {
            var key = optional[i];
            if (typeof obj[key] !== "undefined") {
              validated_obj[key] = obj[key];
            }
          }

          e[1](validated_obj, res, token_payload, req, url);
        },
        function() {
          end(res, 500, '{"error":"internal server error"}');
        });
    });
  }

  app.listen(port, onlisten);

  function onlisten(p) {
    if (p) {
      console.log("http-server started: " + port);
      console.log("number of endpoints registered: " + endpoints.length);
    } else {
      throw "can't listen port " + port;
    }
  }
}

function read_json(res, cb, err) {
  let buffer;
  let alreadyClosed = false;
  res.onData((ab, isLast) => {
    let chunk = Buffer.from(ab);
    if (isLast) {
      let json;
      if (buffer) {
        try {
          json = JSON.parse(Buffer.concat([buffer, chunk]));
        } catch (e) {
          alreadyClosed = true;
          end(res, 401, '{"error":"invalid json"}');
          return;
        }
        cb(json);
      } else {
        try {
          json = JSON.parse(chunk);
        } catch (e) {
          alreadyClosed = true;
          end(res, 401, '{"error":"invalid json"}');
          return;
        }
        cb(json);
      }
    } else {
      if (buffer) {
        buffer = Buffer.concat([buffer, chunk]);
      } else {
        buffer = Buffer.concat([chunk]);
      }
    }
  });

  res.onAborted(() => {
    if (!alreadyClosed) {
      err();
    }
  });
}

var status_map = {
  "200": "200 OK",
  "400": "400 Bad Request",
  "401": "401 Unauthorized",
  "500": "500 Internal Server Error"
}

function write_status(code, res) {
  var status = status_map[code];
  if (typeof status == "undefined")
    throw("invalid status code " + code);

  res.writeStatus(status);
}

function end(res, status, data, mime, redirect_url, encoding) {
  res.cork(function() {
    write_status(status, res);

    if (status == 301 || status == 302)
      res.writeHeader("Location", redirect_url);

    if (mime)
      res.writeHeader("Content-Type", mime);
    else
      res.writeHeader("Content-Type", "application/json; charset=utf-8");

    if (encoding)
      res.writeHeader("Content-Encoding", encoding);

    res.end(data);
  });
}

exports.create_token = function(payload) {
  return AUTH.encode(payload);
}

exports.end = end;

