const rowController = require("../../../controllers/row")
const appController = require("../../../controllers/application")
const CouchDB = require("../../../../db")
const { AppStatus } = require("../../../../db/utils")
const { BUILTIN_ROLE_IDS } = require("@budibase/auth/roles")

function Request(appId, params) {
  this.appId = appId
  this.params = params
  this.request = {}
}

exports.getAllTableRows = async config => {
  const req = new Request(config.appId, { tableId: config.table._id })
  await rowController.fetch(req)
  return req.body
}

exports.clearAllApps = async () => {
  const req = { query: { status: AppStatus.DEV } }
  await appController.fetch(req)
  const apps = req.body
  if (!apps || apps.length <= 0) {
    return
  }
  for (let app of apps) {
    const { appId } = app
    await appController.delete(new Request(null, { appId }))
  }
}

exports.clearAllAutomations = async config => {
  const automations = await config.getAllAutomations()
  for (let auto of automations) {
    await config.deleteAutomation(auto)
  }
}

exports.createRequest = (request, method, url, body) => {
  let req

  if (method === "POST") req = request.post(url).send(body)
  else if (method === "GET") req = request.get(url)
  else if (method === "DELETE") req = request.delete(url)
  else if (method === "PATCH") req = request.patch(url).send(body)
  else if (method === "PUT") req = request.put(url).send(body)

  return req
}

exports.checkBuilderEndpoint = async ({ config, method, url, body }) => {
  const headers = await config.login("test@test.com", "test", {
    userId: "us_fail",
    builder: false,
  })
  await exports
    .createRequest(config.request, method, url, body)
    .set(headers)
    .expect(403)
}

exports.checkPermissionsEndpoint = async ({
  config,
  method,
  url,
  body,
  passRole,
  failRole,
}) => {
  const password = "PASSWORD"
  let user = await config.createUser("pass@budibase.com", password, passRole)
  const passHeader = await config.login("pass@budibase.com", password, {
    roleId: passRole,
    userId: user.globalId,
  })

  await exports
    .createRequest(config.request, method, url, body)
    .set(passHeader)
    .expect(200)

  let failHeader
  if (failRole === BUILTIN_ROLE_IDS.PUBLIC) {
    failHeader = config.publicHeaders()
  } else {
    user = await config.createUser("fail@budibase.com", password, failRole)
    failHeader = await config.login("fail@budibase.com", password, {
      roleId: failRole,
      userId: user.globalId,
      builder: false,
    })
  }

  await exports
    .createRequest(config.request, method, url, body)
    .set(failHeader)
    .expect(403)
}

exports.getDB = config => {
  return new CouchDB(config.getAppId())
}
