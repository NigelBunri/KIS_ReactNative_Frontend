export type ApiResult<T = any> = {
  success: boolean;
  data?: T;
  message?: string;
  status?: number;
  [key: string]: any;
};

export type HeadersInit = Record<string, string>;
