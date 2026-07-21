const axios = require("axios");

const GATEWAY_URL = process.env.GATEWAY_URL;
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

const internalClient = axios.create({
  baseURL: GATEWAY_URL,
  headers: { "x-internal-api-key": INTERNAL_API_KEY },
  timeout: 5000,
});

async function findUserByEmail(email) {
  try {
    const { data } = await internalClient.get(`/internal/users/by-email/${encodeURIComponent(email)}`);
    return data;
  } catch (err) {
    if (err.response?.status === 404) return null;
    throw err;
  }
}

async function createUser({ email, name }) {
  const { data } = await internalClient.post("/internal/users", { email, name });
  return data;
}

async function getUserById(userId) {
  try {
    const { data } = await internalClient.get(`/internal/users/${userId}`);
    return data;
  } catch (err) {
    if (err.response?.status === 404) return null;
    throw err;
  }
}

module.exports = { findUserByEmail, createUser, getUserById };
