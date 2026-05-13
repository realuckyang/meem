import { getTaskById } from '../../repository/task/records.js'

export const getTaskDetail = ({ id }) => getTaskById(id)
