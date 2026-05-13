import { initMemosDb } from './repository/init.js'
import { handleMemosApi } from './api/index.js'

export default {
  name: 'memos',
  match: (path) => path.startsWith('/apps/memos/'),
  initDb: initMemosDb,
  handleApi: handleMemosApi,
}
