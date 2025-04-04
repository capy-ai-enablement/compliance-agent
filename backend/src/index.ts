import express, { Express, Request, Response } from 'express';

const app: Express = express();
const port = process.env.PORT || 3001; // Use 3001 to avoid conflict with frontend default (5173)

app.get('/', (req: Request, res: Response) => {
  res.send('Compliance Agent Backend');
});

app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});
