import { initTodosDb } from './repository/init.js'
import { handleTodosApi } from './api/index.js'

export default {
  name: 'todos',
  match: (path) => path.startsWith('/apps/todos'),
  initDb: initTodosDb,
  handleApi: handleTodosApi,
}
