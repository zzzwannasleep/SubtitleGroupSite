import { apiOk } from '~/server/utils/api'
import { getCurrentUser } from '~/server/utils/auth'
import { getPublicRuntimeConfig } from '~/server/utils/public-config'

export default defineEventHandler(async (event) => {
  const user = await getCurrentUser(event)
  const publicRuntime = getPublicRuntimeConfig()

  return apiOk({
    authenticated: Boolean(user),
    user,
    auth: publicRuntime.auth,
    turnstile: publicRuntime.turnstile,
  })
})
