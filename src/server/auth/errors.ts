export class UnauthorizedError extends Error {
  constructor(message = "Authentication is required.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class PermissionDeniedError extends Error {
  constructor(message = "Permission denied.") {
    super(message);
    this.name = "PermissionDeniedError";
  }
}
