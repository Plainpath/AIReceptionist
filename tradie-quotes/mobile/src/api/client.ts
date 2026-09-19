import axios from "axios";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "tradie-quotes/token";

function devApiUrl() {
  const hostUri = (Constants.expoConfig as any)?.hostUri || (Constants as any).expoGoConfig?.debuggerHost;
  const host = hostUri ? String(hostUri).split(":")[0] : "localhost";
  return `http://${host}:4000`;
}

export const API_URL = __DEV__ ? devApiUrl() : "https://api.example.com";

export const api = axios.create({ baseURL: API_URL });

let currentToken: string | null = null;

export async function loadToken() {
  currentToken = await AsyncStorage.getItem(TOKEN_KEY);
  applyToken(currentToken);
  return currentToken;
}

export async function setToken(token: string | null) {
  currentToken = token;
  if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
  else await AsyncStorage.removeItem(TOKEN_KEY);
  applyToken(token);
}

function applyToken(token: string | null) {
  if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`;
  else delete api.defaults.headers.common.Authorization;
}
