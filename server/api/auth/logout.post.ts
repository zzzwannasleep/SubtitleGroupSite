import { apiOk } from '~/server/utils/api'
import { invalidateCurrentSession } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  await invalidateCurrentSession(event)

  return apiOk({
    loggedOut: true,
  })
})
