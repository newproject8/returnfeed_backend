declare namespace Express {
  export interface User {
    id: number;
    username: string;
    email: string;
    role?: string;
    google_id?: string;
  }

  export interface Request {
    user?: User;
  }
}