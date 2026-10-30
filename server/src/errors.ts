export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const unauthorized = (message = "You must be signed in to do that.") =>
  new ApiError(401, message);

export const forbidden = (message = "You do not have access to that.") =>
  new ApiError(403, message);

export const badRequest = (message: string) => new ApiError(400, message);

export const conflict = (message: string) => new ApiError(409, message);

export const notFound = (message = "That could not be found.") => new ApiError(404, message);
