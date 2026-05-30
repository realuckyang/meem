#!/usr/bin/env node
import { shutdownClient, startClient } from './system/client.js';

process.on('SIGINT', () => {
  console.log('\n[client] shutting down');
  shutdownClient();
  process.exit(0);
});

startClient();
