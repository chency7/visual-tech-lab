export type JsonPrimitive = string | number | boolean | null;
export type JsonArray = JsonValue[];
export type JsonObject = { [key: string]: JsonValue };
export type JsonValue = JsonPrimitive | JsonArray | JsonObject;

export interface SearchResult {
  path: string[];
}

export type OnExport = (filename: string, data: JsonValue) => void;