import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { readConfig } from './config.ts';
import { createConsolePrinter } from './consolePrinter.ts';
import { migrate, openDatabase } from './db/database.ts';
import { createEnableBanking } from './enableBanking.ts';
import { createExpenseTracker } from './expenseTracker.ts';
import { createApp } from './http/app.ts';
import { startServer } from './http/startServer.ts';
import { createService } from './service.ts';

const config = readConfig();

function warnAboutIncompleteSetup() {
  if (!config.expenseTracker) console.warn('EXPENSE_TRACKER_URL is not set: transactions are printed, not imported');
  if (!existsSync(join(config.staticDir, 'index.html')))
    console.warn(`No frontend in ${config.staticDir}/: run npm run build, or use npm run dev`);
}

const db = openDatabase(config.dbPath);
migrate(db);
console.log(`Database ${config.dbPath}`);

const service = createService({
  db,
  bank: createEnableBanking(config.enableBanking),
  tracker: config.expenseTracker ? createExpenseTracker(config.expenseTracker) : createConsolePrinter(),
  redirectUrl: config.enableBanking.redirectUrl,
  fetchDays: config.fetchDays,
});
warnAboutIncompleteSetup();

const app = createApp({ service, staticDir: config.staticDir, logRequests: true });
const server = startServer(app, config);

for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    server.close();
    db.close();
    process.exit(0);
  });
