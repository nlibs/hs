const crypto = require('crypto');

// Configuration
let SECRET_KEY = "my_super_secret_key_change_in_production!";
let DEFAULT_EXPIRATION = 86400; // 1 day in seconds

function init(secretKey, defaultExpiration) {
  SECRET_KEY = secretKey;
  DEFAULT_EXPIRATION = defaultExpiration;
}

function secureEncode(payloadArray, secret = SECRET_KEY) {
  if (!Array.isArray(payloadArray)) {
    throw new Error("Payload must be an array");
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const fullPayloadArray = [timestamp, ...payloadArray];
  const dataString = fullPayloadArray.join('.');
  const dataBase64 = Buffer.from(dataString).toString('base64url');

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(dataBase64);
  const mac = hmac.digest('hex').substring(0, 32);

  return `${mac}${dataBase64}`;
}

function secureDecode(token, secret = SECRET_KEY, expiration = DEFAULT_EXPIRATION) {
  if (token.length < 32) {
    throw new Error("Invalid token format");
  }

  const receivedMac = token.substring(0, 32);
  const dataBase64 = token.substring(32);

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(dataBase64);
  const expectedMac = hmac.digest('hex').substring(0, 32);

  const receivedMacBuffer = Buffer.from(receivedMac, 'utf8');
  const expectedMacBuffer = Buffer.from(expectedMac, 'utf8');

  if (receivedMacBuffer.length !== 32 || expectedMacBuffer.length !== 32) {
    throw new Error("Invalid MAC length");
  }
  if (!crypto.timingSafeEqual(receivedMacBuffer, expectedMacBuffer)) {
    throw new Error("Invalid MAC");
  }

  const dataString = Buffer.from(dataBase64, 'base64url').toString('utf8');
  const fullPayloadArray = dataString.split('.');
  const timestamp = parseInt(fullPayloadArray[0], 10);
  const userPayloadArray = fullPayloadArray.slice(1);

  const currentTime = Math.floor(Date.now() / 1000);
  if (currentTime - timestamp > expiration) {
    throw new Error("Token expired");
  }

  return userPayloadArray;
}

module.exports = {
  init,
  encode: secureEncode,
  decode: secureDecode
};
