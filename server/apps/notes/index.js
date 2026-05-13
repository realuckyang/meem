import { initNotesDb } from './repository/init.js'
import { handleNotesApi } from './api/index.js'

export default {
  name: 'notes',
  match: (path) => path.startsWith('/apps/notes') || path.startsWith('/apps/notebooks'),
  initDb: initNotesDb,
  handleApi: handleNotesApi,
}
