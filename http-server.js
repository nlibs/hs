const AUTH = require("./auth.js");

var endpoints = [];

exports.post = function(path, fn, is_authorized) {
  if (typeof is_authorized == "undefined")
    is_authorized = false;

  endpoints.push([path, fn, is_authorized]);
}

exports.start = function(port, host, authKey, authExpire) {
  // Initialize auth with defaults or provided values
  const defaultKey = authKey || "default_secret_key_change_in_production";
  const defaultExpire = authExpire || 86400;
  AUTH.init(defaultKey, defaultExpire);

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

          e[1](obj, res, token_payload, req, url);
        },
        function() {
          end(res, 500, '{"error":"internal server error"}');
        });
    });
  }

  if (typeof host == "undefined")
    app.listen(port, onlisten);
  else
    app.listen(host, port, onlisten);

  function onlisten(p) {
    if (p) {
      console.log("http-server started: " + port);
      if (typeof host != "undefined")
        console.log("http-server on host: " + host);
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

function parse_fields(q, res, mandatory_keys, optional_keys) {
  var obj = {};
  for (var i = 0; i < mandatory_keys.length; i++) {
    var key = mandatory_keys[i];
    if (typeof q[key] === "undefined") {
      end(res, 401, '{"error":"missing field ' + key + '"}');
      return false;
    }
    obj[key] = q[key];
  }

  for (var i = 0; i < optional_keys.length; i++) {
    var key = optional_keys[i];
    if (typeof q[key] !== "undefined") {
      obj[key] = q[key];
    }
  }
  return obj;
}

exports.validate = parse_fields;
