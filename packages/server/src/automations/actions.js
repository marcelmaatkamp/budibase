const sendgridEmail = require("./steps/sendgridEmail")
const sendSmtpEmail = require("./steps/sendSmtpEmail")
const createRow = require("./steps/createRow")
const updateRow = require("./steps/updateRow")
const deleteRow = require("./steps/deleteRow")
const executeScript = require("./steps/executeScript")
const bash = require("./steps/bash")
const executeQuery = require("./steps/executeQuery")
const outgoingWebhook = require("./steps/outgoingWebhook")
const serverLog = require("./steps/serverLog")
const env = require("../environment")
const Sentry = require("@sentry/node")
const {
  automationInit,
  getExternalAutomationStep,
} = require("../utilities/fileSystem")

const BUILTIN_ACTIONS = {
  SEND_EMAIL: sendgridEmail.run,
  SEND_EMAIL_SMTP: sendSmtpEmail.run,
  CREATE_ROW: createRow.run,
  UPDATE_ROW: updateRow.run,
  DELETE_ROW: deleteRow.run,
  OUTGOING_WEBHOOK: outgoingWebhook.run,
  EXECUTE_SCRIPT: executeScript.run,
  EXECUTE_BASH: bash.run,
  EXECUTE_QUERY: executeQuery.run,
  SERVER_LOG: serverLog.run,
}
const BUILTIN_DEFINITIONS = {
  SEND_EMAIL: sendgridEmail.definition,
  SEND_EMAIL_SMTP: sendSmtpEmail.definition,
  CREATE_ROW: createRow.definition,
  UPDATE_ROW: updateRow.definition,
  DELETE_ROW: deleteRow.definition,
  OUTGOING_WEBHOOK: outgoingWebhook.definition,
  EXECUTE_SCRIPT: executeScript.definition,
  EXECUTE_QUERY: executeQuery.definition,
  EXECUTE_BASH: bash.definition,
  SERVER_LOG: serverLog.definition,
}

let MANIFEST = null

/* istanbul ignore next */
function buildBundleName(pkgName, version) {
  return `${pkgName}@${version}.min.js`
}

/* istanbul ignore next */
module.exports.getAction = async function (actionName) {
  if (BUILTIN_ACTIONS[actionName] != null) {
    return BUILTIN_ACTIONS[actionName]
  }
  // worker pools means that a worker may not have manifest
  if (env.isProd() && MANIFEST == null) {
    MANIFEST = await module.exports.init()
  }
  // env setup to get async packages
  if (!MANIFEST || !MANIFEST.packages || !MANIFEST.packages[actionName]) {
    return null
  }
  const pkg = MANIFEST.packages[actionName]
  const bundleName = buildBundleName(pkg.stepId, pkg.version)
  return getExternalAutomationStep(pkg.stepId, pkg.version, bundleName)
}

module.exports.init = async function () {
  try {
    MANIFEST = await automationInit()
    module.exports.DEFINITIONS =
      MANIFEST && MANIFEST.packages
        ? Object.assign(MANIFEST.packages, BUILTIN_DEFINITIONS)
        : BUILTIN_DEFINITIONS
  } catch (err) {
    console.error(err)
    Sentry.captureException(err)
  }
  return MANIFEST
}

// definitions will have downloaded ones added to it, while builtin won't
module.exports.DEFINITIONS = BUILTIN_DEFINITIONS
module.exports.BUILTIN_DEFINITIONS = BUILTIN_DEFINITIONS
