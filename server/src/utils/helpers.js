import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

/** Wrap async route handlers so rejected promises reach the error middleware. */
export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Validate `data` against a zod schema, throwing a 400 with field errors. */
export function validate(schema, data) {
  try {
    return schema.parse(data);
  } catch (err) {
    if (err instanceof ZodError) {
      const fields = {};
      for (const issue of err.issues) {
        const key = issue.path.join('.') || '_';
        if (!fields[key]) fields[key] = issue.message;
      }
      const first = Object.entries(fields)[0];
      throw new HttpError(400, first ? `${first[0]}: ${first[1]}` : 'Invalid input', fields);
    }
    throw err;
  }
}

export function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100) || 'item';
}

export function toInt(v, fallback = null) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

export function pageParams(q, defLimit = 20, maxLimit = 100) {
  const page = Math.max(1, toInt(q.page, 1));
  const limit = Math.min(maxLimit, Math.max(1, toInt(q.limit, defLimit)));
  return { page, limit, offset: (page - 1) * limit };
}

/** Strip anything that is not a digit; keep a leading country code if present. */
export function digitsOnly(v) {
  return String(v || '').replace(/\D/g, '');
}

/** Very small helper to build dynamic WHERE clauses with positional params. */
export class Where {
  constructor() {
    this.parts = [];
    this.params = [];
  }
  add(sqlWithQ, ...values) {
    // sqlWithQ uses `?` for each value; converted to $n.
    let sql = sqlWithQ;
    for (const v of values) {
      this.params.push(v);
      sql = sql.replace('?', `$${this.params.length}`);
    }
    this.parts.push(sql);
    return this;
  }
  get sql() {
    return this.parts.length ? `WHERE ${this.parts.join(' AND ')}` : '';
  }
  next() {
    return `$${this.params.length + 1}`;
  }
}
