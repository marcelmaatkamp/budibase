const fetch = require("node-fetch")

const RequestType = {
  POST: "POST",
  GET: "GET",
  PUT: "PUT",
  DELETE: "DELETE",
  PATCH: "PATCH",
}

const BODY_REQUESTS = [RequestType.POST, RequestType.PUT, RequestType.PATCH]

/**
 * Note, there is some functionality in this that is not currently exposed as it
 * is complex and maybe better to be opinionated here.
 * GET/DELETE requests cannot handle body elements so they will not be sent if configured.
 */

module.exports.definition = {
  name: "Outgoing webhook",
  tagline: "Send a {{inputs.requestMethod}} request",
  icon: "ri-send-plane-line",
  description: "Send a request of specified method to a URL",
  type: "ACTION",
  stepId: "OUTGOING_WEBHOOK",
  inputs: {
    requestMethod: "POST",
    url: "http://",
    requestBody: "{}",
  },
  schema: {
    inputs: {
      properties: {
        requestMethod: {
          type: "string",
          enum: Object.values(RequestType),
          title: "Request method",
        },
        url: {
          type: "string",
          title: "URL",
        },
        requestBody: {
          type: "string",
          title: "JSON Body",
          customType: "wide",
        },
      },
      required: ["requestMethod", "url"],
    },
    outputs: {
      properties: {
        response: {
          type: "object",
          description: "The response from the webhook",
        },
        success: {
          type: "boolean",
          description: "Whether the action was successful",
        },
      },
      required: ["response", "success"],
    },
  },
}

module.exports.run = async function ({ inputs }) {
  let { requestMethod, url, requestBody } = inputs
  if (!url.startsWith("http")) {
    url = `http://${url}`
  }
  const request = {
    method: requestMethod,
  }
  if (
    requestBody &&
    requestBody.length !== 0 &&
    BODY_REQUESTS.indexOf(requestMethod) !== -1
  ) {
    request.body =
      typeof requestBody === "string"
        ? requestBody
        : JSON.stringify(requestBody)
    request.headers = {
      "Content-Type": "application/json",
    }
  }

  try {
    // do a quick JSON parse if there is a body, to generate an error if its invalid
    if (request.body) {
      JSON.parse(request.body)
    }
    const response = await fetch(url, request)
    const contentType = response.headers.get("content-type")
    const success = response.status === 200
    let resp
    if (!success) {
      resp = response.statusText
    } else if (contentType && contentType.indexOf("application/json") !== -1) {
      resp = await response.json()
    } else {
      resp = await response.text()
    }
    return {
      response: resp,
      success: success,
    }
  } catch (err) {
    /* istanbul ignore next */
    return {
      success: false,
      response: err,
    }
  }
}
