import { NextFunction, Request, Response } from 'express';
import {
  SecurityHeadersMiddleware,
  securityHeaders,
} from './security-headers.middleware';

describe('SecurityHeadersMiddleware', () => {
  it('sets expected security headers and calls next', () => {
    const middleware = new SecurityHeadersMiddleware();
    const setHeader = jest.fn();
    const next = jest.fn() as NextFunction;

    middleware.use(
      {} as Request,
      {
        setHeader,
      } as unknown as Response,
      next,
    );

    const expectedHeaders = securityHeaders();

    for (const [key, value] of Object.entries(expectedHeaders)) {
      expect(setHeader).toHaveBeenCalledWith(key, value);
    }

    expect(next).toHaveBeenCalledTimes(1);
  });
});
