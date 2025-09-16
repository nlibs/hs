const crypto = require('crypto');

// Configuration
let SECRET_KEY = "my_super_secret_key_change_in_production!";
let DEFAULT_EXPIRATION = 3600; // 1 hour in seconds

function init(secretKey, defaultExpiration) {
  SECRET_KEY = secretKey;
  DEFAULT_EXPIRATION = defaultExpiration;
}

function secureEncode(payloadArray, secret = SECRET_KEY) {
  if (!Array.isArray(payloadArray)) {
    throw new Error("Payload must be an array");
  }

  const timestamp = Math.floor(Date.now() / 1000);

  // Prepend the timestamp to the user's payload array
  const fullPayloadArray = [timestamp, ...payloadArray];

  // Join the array with dots to create the data string
  const dataString = fullPayloadArray.join('.');

  // Encode the data string to base64url for a more compact token
  const dataBase64 = Buffer.from(dataString).toString('base64url');

  // Use a proper HMAC with a strong hash (SHA-256), truncated to 128 bits for smaller tokens
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(dataBase64);
  const mac = hmac.digest('hex').substring(0, 32); // 32 hex chars = 16 bytes = 128 bits

  // Format: [32-char-hex-HMAC][base64url-encoded-data]
  return `${mac}${dataBase64}`;
}

function secureDecode(token, secret = SECRET_KEY, expiration = DEFAULT_EXPIRATION) {
  if (token.length < 32) {
    throw new Error("Invalid token format");
  }

  const receivedMac = token.substring(0, 32);
  const dataBase64 = token.substring(32);

  // Recalculate the MAC using the same secure method
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(dataBase64);
  const expectedMac = hmac.digest('hex').substring(0, 32); // Truncate to 32 chars like in encode

  // Use a constant-time comparison to prevent timing attacks
  const receivedMacBuffer = Buffer.from(receivedMac, 'utf8');
  const expectedMacBuffer = Buffer.from(expectedMac, 'utf8');

  if (receivedMacBuffer.length !== 32 || expectedMacBuffer.length !== 32) {
    throw new Error("Invalid MAC length");
  }
  if (!crypto.timingSafeEqual(receivedMacBuffer, expectedMacBuffer)) {
    throw new Error("Invalid MAC");
  }

  // Decode the base64url data back to the original string
  const dataString = Buffer.from(dataBase64, 'base64url').toString('utf8');

  // Split the string back into an array
  const fullPayloadArray = dataString.split('.');

  // Extract the timestamp (first element) and the rest of the payload
  const timestamp = parseInt(fullPayloadArray[0], 10);
  const userPayloadArray = fullPayloadArray.slice(1);

  // Check expiration
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
