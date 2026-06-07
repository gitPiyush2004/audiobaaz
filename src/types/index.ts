export * from "./user";
export * from "./listing";
export * from "./offer";
export * from "./order";
export * from "./dispute";

// API response envelope
export type ApiSuccess<T> = { data: T; error: null };
export type ApiError     = { data: null; error: { message: string; code: string } };
export type ApiResponse<T> = ApiSuccess<T> | ApiError;
